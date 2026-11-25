import crypto from "node:crypto";
import type { PoolConnection, RowDataPacket } from "@backend/lib/postgres";
import { executeSql, parseJsonValue, queryOne, queryRows, toPostgresDatetime, withTransaction } from "./postgres";
import { logAdminActivity } from "./admin-auth";

export function generateTrackingCode(prefix: "APP" | "APT" | "INQ" | "ORD"): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `YEL-${prefix}-${year}-${rand}`;
}

export type BookingKind = "none" | "car" | "short_stay" | "sanitation";

export type SanitationQuoteInput = {
  serviceName: string;
  capacityTier?: "small" | "medium" | "large";
  frequency?: "one_off" | "weekly" | "monthly";
  urgency?: "standard" | "emergency";
};

const SANITATION_BASE_RATES: Record<string, number> = {
  "Septic Tank Cleaning (Exhauster)": 8500,
  "Garbage Collection": 3500,
  "Waste Management Solutions": 14000,
  "Commercial & Residential Cleaning": 12000,
  "Skip Bin & Construction Waste Disposal": 18000,
};

const CAPACITY_MULTIPLIER: Record<string, number> = {
  small: 1.0,
  medium: 1.35,
  large: 1.75,
};

const FREQUENCY_DISCOUNT: Record<string, number> = {
  one_off: 1.0,
  weekly: 0.9,
  monthly: 0.85,
};

export function calculateSanitationQuote(input: SanitationQuoteInput): {
  baseKes: number;
  estimatedKes: number;
  breakdown: {
    base: number;
    capacityMultiplier: number;
    frequencyDiscountPercent: number;
    emergencySurchargePercent: number;
  };
} {
  const base = SANITATION_BASE_RATES[input.serviceName] ?? 9500;
  const capacityMult = CAPACITY_MULTIPLIER[input.capacityTier || "medium"] ?? 1.0;
  const freqMult = FREQUENCY_DISCOUNT[input.frequency || "one_off"] ?? 1.0;
  const urgencyMult = input.urgency === "emergency" ? 1.25 : 1.0;

  const estimatedKes = Math.round((base * capacityMult * freqMult * urgencyMult) / 100) * 100;
  return {
    baseKes: base,
    estimatedKes,
    breakdown: {
      base,
      capacityMultiplier: capacityMult,
      frequencyDiscountPercent: Math.round((1 - freqMult) * 100),
      emergencySurchargePercent: urgencyMult > 1 ? 25 : 0,
    },
  };
}

export function computeBookingMultiplier(
  bookingKind: BookingKind,
  details: Record<string, string>,
): { units: number; startMs: number | null; endMs: number | null; label: string } {
  if (bookingKind === "short_stay") {
    const startMs = Date.parse(`${details.check_in || ""}T00:00:00Z`);
    const endMs = Date.parse(`${details.check_out || ""}T00:00:00Z`);
    if (!details.check_in || !details.check_out || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      throw new Error("Choose a valid check-in and check-out date.");
    }
    const nights = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
    if (nights > 90) throw new Error("Short-stay bookings cannot exceed 90 nights online.");
    return { units: nights, startMs, endMs, label: `${nights} night${nights > 1 ? "s" : ""}` };
  }
  if (bookingKind === "car") {
    const startMs = Date.parse(details.pickup_at || "");
    const endMs = Date.parse(details.return_at || "");
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      throw new Error("Choose a valid car pickup and return date/time.");
    }
    const days = Math.max(1, Math.ceil((endMs - startMs) / 86_400_000));
    if (days > 90) throw new Error("Vehicle hire bookings cannot exceed 90 days online.");
    return { units: days, startMs, endMs, label: `${days} day${days > 1 ? "s" : ""}` };
  }
  return { units: 1, startMs: null, endMs: null, label: "" };
}

async function ensureNoBookingConflict(
  conn: PoolConnection,
  productId: string,
  bookingKind: BookingKind,
  stockQuantity: number,
  requestedQty: number,
  details: Record<string, string>,
) {
  if (bookingKind !== "car" && bookingKind !== "short_stay") return;
  const { startMs, endMs } = computeBookingMultiplier(bookingKind, details);
  if (startMs === null || endMs === null) return;

  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT oi.quantity, oi.booking_details
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = ?
       AND o.status IN ('Placed', 'Confirmed', 'In progress')`,
    [productId],
  );

  let overlappingUnits = 0;
  for (const row of rows) {
    const existing = parseJsonValue<Record<string, string>>(row.booking_details, {});
    const exStart = bookingKind === "short_stay"
      ? Date.parse(`${existing.check_in || ""}T00:00:00Z`)
      : Date.parse(existing.pickup_at || "");
    const exEnd = bookingKind === "short_stay"
      ? Date.parse(`${existing.check_out || ""}T00:00:00Z`)
      : Date.parse(existing.return_at || "");
    if (Number.isFinite(exStart) && Number.isFinite(exEnd) && exStart < endMs && exEnd > startMs) {
      overlappingUnits += Number(row.quantity || 1);
    }
  }

  if (overlappingUnits + requestedQty > stockQuantity) {
    throw new Error("Selected dates are already booked for this listing. Please adjust your dates.");
  }
}

export async function createCheckoutOrder(params: {
  customerId: string;
  checkoutKey: string;
  items: Array<{ product_id: string; quantity: number; booking_details?: Record<string, string> }>;
  notes?: string;
}) {
  if (!params.items.length) throw new Error("Your cart is empty.");

  return withTransaction(async (conn) => {
    const [existingOrderRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_number, total_amount, payment_status, status
       FROM orders
       WHERE customer_id = ? AND checkout_key = ?
       FOR UPDATE`,
      [params.customerId, params.checkoutKey],
    );

    if (existingOrderRows.length > 0) {
      const existing = existingOrderRows[0];
      return {
        order_id: existing.id as string,
        order_number: existing.order_number as string,
        total_amount: Number(existing.total_amount),
      };
    }

    let totalAmount = 0;
    const preparedItems: Array<{
      productId: string;
      title: string;
      division: string;
      quantity: number;
      unitAmount: number;
      lineTotal: number;
      bookingDetails: Record<string, string>;
    }> = [];

    for (const item of params.items) {
      const qty = Math.trunc(Number(item.quantity || 1));
      if (qty < 1 || qty > 20) throw new Error("Quantity must be between 1 and 20.");

      const [prodRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, title, division, amount_kes, price_unit, stock_quantity, status, purchasable, booking_kind
         FROM products
         WHERE id = ?
         FOR UPDATE`,
        [item.product_id],
      );
      const product = prodRows[0];
      if (!product || !product.purchasable || product.status !== "available") {
        throw new Error("One or more items in your cart are no longer available.");
      }
      if (qty > Number(product.stock_quantity || 0)) {
        throw new Error(`Only ${product.stock_quantity} unit(s) available for ${product.title}.`);
      }

      const details = item.booking_details || {};
      const bookingKind = product.booking_kind as BookingKind;
      const { units } = computeBookingMultiplier(bookingKind, details);
      await ensureNoBookingConflict(
        conn,
        product.id,
        bookingKind,
        Number(product.stock_quantity || 1),
        qty,
        details,
      );

      const unitAmount = Number(product.amount_kes);
      const lineTotal = unitAmount * qty * units;
      if (lineTotal <= 0) throw new Error("Invalid item price.");

      totalAmount += lineTotal;
      preparedItems.push({
        productId: product.id,
        title: product.title,
        division: product.division,
        quantity: qty,
        unitAmount,
        lineTotal,
        bookingDetails: {
          ...details,
          ...(units > 1 ? { duration_units: String(units) } : {}),
        },
      });
    }

    const orderId = crypto.randomUUID();
    const orderNumber = generateTrackingCode("ORD");
    await conn.execute(
      `INSERT INTO orders (id, order_number, customer_id, checkout_key, status, payment_status, currency, total_amount, notes)
       VALUES (?, ?, ?, ?, 'Pending payment', 'pending', 'KES', ?, ?)`,
      [orderId, orderNumber, params.customerId, params.checkoutKey, totalAmount, params.notes?.trim() || null],
    );

    for (const line of preparedItems) {
      await conn.execute(
        `INSERT INTO order_items (id, order_id, product_id, title, division, quantity, unit_amount, line_total, booking_details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          orderId,
          line.productId,
          line.title,
          line.division,
          line.quantity,
          line.unitAmount,
          line.lineTotal,
          JSON.stringify(line.bookingDetails),
        ],
      );
    }

    await conn.execute(
      `INSERT INTO order_status_events (id, order_id, customer_id, status, note)
       VALUES (?, ?, ?, 'Pending payment', 'Order created at checkout')`,
      [crypto.randomUUID(), orderId, params.customerId],
    );

    return {
      order_id: orderId,
      order_number: orderNumber,
      total_amount: totalAmount,
    };
  });
}

export async function confirmOrderPayment(params: {
  orderId: string;
  reference: string;
  provider: "mpesa" | "flutterwave" | "manual";
  providerTransactionId: string;
  amount: number;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (!params.providerTransactionId.trim()) {
    throw new Error("Missing provider transaction identifier.");
  }

  return withTransaction(async (conn) => {
    const [orderRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_number, customer_id, total_amount, payment_status
       FROM orders
       WHERE id = ?
       FOR UPDATE`,
      [params.orderId],
    );
    const order = orderRows[0];
    if (!order || Number(order.total_amount) !== params.amount) {
      throw new Error("Order missing or payment amount mismatch.");
    }

    const [paymentRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, provider, amount, status
       FROM payments
       WHERE reference = ?
       FOR UPDATE`,
      [params.reference],
    );
    const payment = paymentRows[0];
    if (!payment || payment.order_id !== params.orderId || payment.provider !== params.provider || Number(payment.amount) !== params.amount) {
      throw new Error("Payment attempt not found or mismatched.");
    }

    if (payment.status === "successful" || order.payment_status === "paid") {
      return false;
    }
    if (payment.status !== "pending") {
      throw new Error("Payment attempt is no longer active.");
    }

    await conn.execute(
      `UPDATE payments
       SET status = 'successful', provider_transaction_id = ?, metadata = ?, updated_at = UTC_TIMESTAMP(3)
       WHERE id = ?`,
      [params.providerTransactionId.trim(), JSON.stringify(params.metadata || {}), payment.id],
    );

    await conn.execute(
      `UPDATE orders
       SET status = 'Placed', payment_status = 'paid', updated_at = UTC_TIMESTAMP(3)
       WHERE id = ?`,
      [params.orderId],
    );

    await conn.execute(
      `INSERT INTO order_status_events (id, order_id, customer_id, status, note)
       VALUES (?, ?, ?, 'Placed', ?)`,
      [crypto.randomUUID(), params.orderId, order.customer_id, `Payment verified via ${params.provider.toUpperCase()} (${params.providerTransactionId})`],
    );

    await conn.execute(
      `INSERT INTO client_alerts (id, customer_id, order_id, message)
       VALUES (?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        order.customer_id,
        params.orderId,
        `Payment received. Order ${order.order_number} is now placed.`,
      ],
    );

    // Clear purchased items from customer's cart & reserve/decrement one-off inventory
    const [orderItems] = await conn.query<RowDataPacket[]>(
      `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
      [params.orderId],
    );

    for (const item of orderItems) {
      if (!item.product_id) continue;
      await conn.execute(
        `DELETE ci FROM cart_items ci
         JOIN carts c ON c.id = ci.cart_id
         WHERE c.customer_id = ? AND ci.product_id = ?`,
        [order.customer_id, item.product_id],
      );

      const [prodRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, listing_kind, stock_quantity FROM products WHERE id = ? FOR UPDATE`,
        [item.product_id],
      );
      const prod = prodRows[0];
      if (prod && (prod.listing_kind === "vehicle_sale" || prod.listing_kind === "property_sale")) {
        const remaining = Math.max(0, Number(prod.stock_quantity || 1) - Number(item.quantity || 1));
        await conn.execute(
          `UPDATE products
           SET stock_quantity = ?, status = ?, purchasable = ?, updated_at = UTC_TIMESTAMP(3)
           WHERE id = ?`,
          [remaining, remaining === 0 ? "sold" : "available", remaining > 0 ? 1 : 0, prod.id],
        );
      }
    }

    return true;
  });
}

export async function failOrderPayment(
  reference: string,
  status: "failed" | "cancelled",
  metadata: Record<string, unknown> = {},
) {
  await withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, status FROM payments WHERE reference = ? FOR UPDATE`,
      [reference],
    );
    const payment = rows[0];
    if (!payment || payment.status !== "pending") return;

    await conn.execute(
      `UPDATE payments SET status = ?, metadata = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
      [status, JSON.stringify(metadata), payment.id],
    );
    await conn.execute(
      `UPDATE orders SET payment_status = ?, updated_at = UTC_TIMESTAMP(3)
       WHERE id = ? AND payment_status <> 'paid'`,
      [status, payment.order_id],
    );
  });
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  "Pending payment": ["Cancelled"],
  Placed: ["Confirmed", "Cancelled"],
  Confirmed: ["In progress", "Cancelled"],
  "In progress": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

export async function updateClientOrderStatus(params: {
  orderId: string;
  nextStatus: "Confirmed" | "In progress" | "Completed" | "Cancelled";
  staffId: number;
  staffName: string;
}) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_number, customer_id, status, payment_status
       FROM orders
       WHERE id = ?
       FOR UPDATE`,
      [params.orderId],
    );
    const order = rows[0];
    if (!order) throw new Error("Order not found.");
    if (order.status === "Completed" || order.status === "Cancelled") {
      throw new Error("Order is already in a final status.");
    }
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(params.nextStatus)) {
      throw new Error(`Invalid transition from ${order.status} to ${params.nextStatus}.`);
    }
    if (params.nextStatus !== "Cancelled" && order.payment_status !== "paid") {
      throw new Error("Unpaid orders cannot move into fulfillment.");
    }

    await conn.execute(
      `UPDATE orders SET status = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
      [params.nextStatus, params.orderId],
    );

    const note = params.nextStatus === "Cancelled"
      ? `Cancelled / refund approved by ${params.staffName}`
      : `Status updated to ${params.nextStatus} by ${params.staffName}`;
    const alertMessage = params.nextStatus === "Cancelled"
      ? `Order ${order.order_number} has been cancelled.`
      : `Order ${order.order_number} is now ${params.nextStatus.toLowerCase()}.`;

    await conn.execute(
      `INSERT INTO order_status_events (id, order_id, customer_id, status, note)
       VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), params.orderId, order.customer_id, params.nextStatus, note],
    );
    await conn.execute(
      `INSERT INTO client_alerts (id, customer_id, order_id, message)
       VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), order.customer_id, params.orderId, alertMessage],
    );

    // Restore one-off product inventory if a paid sale order was cancelled
    if (params.nextStatus === "Cancelled" && order.payment_status === "paid") {
      const [items] = await conn.query<RowDataPacket[]>(
        `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
        [params.orderId],
      );
      for (const item of items) {
        if (!item.product_id) continue;
        const [prodRows] = await conn.query<RowDataPacket[]>(
          `SELECT id, listing_kind, stock_quantity, status FROM products WHERE id = ? FOR UPDATE`,
          [item.product_id],
        );
        const prod = prodRows[0];
        if (prod && (prod.listing_kind === "vehicle_sale" || prod.listing_kind === "property_sale")) {
          const restored = Number(prod.stock_quantity || 0) + Number(item.quantity || 1);
          await conn.execute(
            `UPDATE products SET stock_quantity = ?, status = 'available', purchasable = 1 WHERE id = ?`,
            [restored, prod.id],
          );
        }
      }
    }

    await logAdminActivity({
      userId: params.staffId,
      actorName: params.staffName,
      action: "order.status_changed",
      entityType: "order",
      entityId: order.order_number,
      details: `${order.order_number}: ${order.status} → ${params.nextStatus}`,
    });

    return {
      order_number: order.order_number as string,
      customer_id: order.customer_id as string,
      alert_message: alertMessage,
    };
  });
}

export async function updateJobApplicationStatusWithSlotSync(params: {
  applicationDbId: number;
  nextStatus: "New" | "Reviewed" | "Shortlisted" | "Visa Processing" | "Placed" | "Rejected";
  staffNote?: string;
  staffId: number;
  staffName: string;
}) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, tracking_code, job_id, full_name, status, staff_notes
       FROM job_applications
       WHERE id = ?
       FOR UPDATE`,
      [params.applicationDbId],
    );
    const app = rows[0];
    if (!app) throw new Error("Application not found.");

    const previousStatus = app.status as string;
    if (app.job_id) {
      const [jobRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, openings_total, openings_filled, status FROM jobs WHERE id = ? FOR UPDATE`,
        [app.job_id],
      );
      const job = jobRows[0];
      if (job) {
        if (previousStatus !== "Placed" && params.nextStatus === "Placed") {
          if (Number(job.openings_filled) >= Number(job.openings_total)) {
            throw new Error("All openings for this job are already filled.");
          }
          const nextFilled = Number(job.openings_filled) + 1;
          const nextJobStatus = nextFilled >= Number(job.openings_total) ? "Closed" : job.status;
          await conn.execute(
            `UPDATE jobs SET openings_filled = ?, status = ? WHERE id = ?`,
            [nextFilled, nextJobStatus, job.id],
          );
        } else if (previousStatus === "Placed" && params.nextStatus !== "Placed") {
          const nextFilled = Math.max(0, Number(job.openings_filled) - 1);
          const nextJobStatus = job.status === "Closed" && nextFilled < Number(job.openings_total) ? "Published" : job.status;
          await conn.execute(
            `UPDATE jobs SET openings_filled = ?, status = ? WHERE id = ?`,
            [nextFilled, nextJobStatus, job.id],
          );
        }
      }
    }

    const updatedNote = params.staffNote !== undefined ? params.staffNote.trim() : (app.staff_notes || "");
    await conn.execute(
      `UPDATE job_applications
       SET status = ?, staff_notes = ?, reviewed_by = ?, updated_at = UTC_TIMESTAMP(3)
       WHERE id = ?`,
      [params.nextStatus, updatedNote, params.staffId, app.id],
    );

    const eventNote = params.staffNote?.trim()
      ? params.staffNote.trim()
      : `Application moved to ${params.nextStatus}`;
    await conn.execute(
      `INSERT INTO job_application_events (job_application_id, status, note, updated_by_name)
       VALUES (?, ?, ?, ?)`,
      [app.id, params.nextStatus, eventNote.slice(0, 500), params.staffName],
    );

    await logAdminActivity({
      userId: params.staffId,
      actorName: params.staffName,
      action: "application.status_changed",
      entityType: "job_application",
      entityId: app.tracking_code,
      details: `${app.full_name} (${app.tracking_code}): ${previousStatus} → ${params.nextStatus}`,
    });

    return { ok: true, status: params.nextStatus, trackingCode: app.tracking_code as string };
  });
}

export async function getAdminOverviewMetrics() {
  const [
    revenueRow,
    ordersCounts,
    jobsCounts,
    productCounts,
    appsCounts,
    appointmentsCounts,
    inquiriesCounts,
    recentActivity,
  ] = await Promise.all([
    queryOne<RowDataPacket>(
      `SELECT COALESCE(SUM(total_amount), 0) AS paid_revenue, COUNT(*) AS paid_orders
       FROM orders WHERE payment_status = 'paid'`,
    ),
    queryOne<RowDataPacket>(
      `SELECT COUNT(*) AS total_orders,
              SUM(CASE WHEN status = 'Placed' OR status = 'Confirmed' OR status = 'In progress' THEN 1 ELSE 0 END) AS active_orders,
              SUM(CASE WHEN cancel_requested_at IS NOT NULL AND status NOT IN ('Cancelled', 'Completed') THEN 1 ELSE 0 END) AS cancel_requests
       FROM orders`,
    ),
    queryOne<RowDataPacket>(
      `SELECT COUNT(*) AS total_jobs,
              SUM(CASE WHEN status = 'Published' THEN 1 ELSE 0 END) AS active_jobs,
              COALESCE(SUM(CASE WHEN status = 'Published' THEN GREATEST(0, CAST(openings_total AS SIGNED) - CAST(openings_filled AS SIGNED)) ELSE 0 END), 0) AS remaining_slots
       FROM jobs`,
    ),
    queryOne<RowDataPacket>(
      `SELECT COUNT(*) AS total_products,
              SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_products,
              SUM(CASE WHEN division = 'Vehicles' AND status = 'available' THEN 1 ELSE 0 END) AS vehicles_count,
              SUM(CASE WHEN division = 'Real Estate' AND status = 'available' THEN 1 ELSE 0 END) AS properties_count
       FROM products WHERE status <> 'archived'`,
    ),
    queryOne<RowDataPacket>(
      `SELECT COUNT(*) AS total_applications,
              SUM(CASE WHEN status = 'New' THEN 1 ELSE 0 END) AS new_applications,
              SUM(CASE WHEN status = 'Shortlisted' OR status = 'Visa Processing' THEN 1 ELSE 0 END) AS in_pipeline,
              SUM(CASE WHEN status = 'Placed' THEN 1 ELSE 0 END) AS placed_count
       FROM job_applications`,
    ),
    queryOne<RowDataPacket>(
      `SELECT COUNT(*) AS total_appointments,
              SUM(CASE WHEN status = 'Requested' THEN 1 ELSE 0 END) AS pending_appointments
       FROM appointment_requests`,
    ),
    queryOne<RowDataPacket>(
      `SELECT COUNT(*) AS total_inquiries,
              SUM(CASE WHEN status = 'unread' THEN 1 ELSE 0 END) AS unread_inquiries
       FROM inquiries`,
    ),
    queryRows<RowDataPacket>(
      `SELECT id, actor_name, action, entity_type, entity_id, details, created_at
       FROM activity_log ORDER BY created_at DESC, id DESC LIMIT 12`,
    ),
  ]);

  return {
    revenueKes: Number(revenueRow?.paid_revenue || 0),
    paidOrders: Number(revenueRow?.paid_orders || 0),
    totalOrders: Number(ordersCounts?.total_orders || 0),
    activeOrders: Number(ordersCounts?.active_orders || 0),
    cancelRequests: Number(ordersCounts?.cancel_requests || 0),
    totalJobs: Number(jobsCounts?.total_jobs || 0),
    activeJobs: Number(jobsCounts?.active_jobs || 0),
    remainingJobSlots: Number(jobsCounts?.remaining_slots || 0),
    totalProducts: Number(productCounts?.total_products || 0),
    availableProducts: Number(productCounts?.available_products || 0),
    vehiclesCount: Number(productCounts?.vehicles_count || 0),
    propertiesCount: Number(productCounts?.properties_count || 0),
    totalApplications: Number(appsCounts?.total_applications || 0),
    newApplications: Number(appsCounts?.new_applications || 0),
    pipelineApplications: Number(appsCounts?.in_pipeline || 0),
    placedApplications: Number(appsCounts?.placed_count || 0),
    totalAppointments: Number(appointmentsCounts?.total_appointments || 0),
    pendingAppointments: Number(appointmentsCounts?.pending_appointments || 0),
    totalInquiries: Number(inquiriesCounts?.total_inquiries || 0),
    unreadInquiries: Number(inquiriesCounts?.unread_inquiries || 0),
    recentActivity,
  };
}
