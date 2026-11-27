import crypto from "node:crypto";
import type { PoolConnection, RowDataPacket } from "./postgres";
import { parseJsonValue, withTransaction } from "./postgres";
import { computeBookingMultiplier, generateTrackingCode, type BookingKind } from "./booking-logic";
import { logAdminActivity } from "./admin-auth";

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
       VALUES (?, ?, ?, 'Pending payment', 'Order submitted; admin will confirm the physical visit for payment')`,
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
        `DELETE FROM cart_items ci
        USING yel.carts c
        WHERE c.id = ci.cart_id
          AND c.customer_id = ? AND ci.product_id = ?`,
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
