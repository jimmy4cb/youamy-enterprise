import { NextResponse } from "next/server";
import crypto from "node:crypto";
import type { RowDataPacket } from "@backend/lib/postgres";
import { getSessionUser, hasPermission, logAdminActivity } from "@backend/lib/admin-auth";
import { confirmOrderPayment, updateClientOrderStatus } from "@backend/lib/business-logic";
import { notifyClientOrderUpdate } from "@backend/lib/order-notifications";
import { parseJsonValue, queryOne, queryRows, withTransaction } from "@backend/lib/postgres";

export const dynamic = "force-dynamic";

const orderStatuses = ["Confirmed", "In progress", "Completed", "Cancelled"] as const;

export async function GET() {
  const staff = await getSessionUser();
  if (!staff || !hasPermission(staff.role, "orders.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const mayViewClientEmail = staff.role === "super_admin" || staff.role === "orders_admin";
  const orders = await queryRows<RowDataPacket>(
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.total_amount, o.currency,
            o.cancel_requested_at, o.cancel_reason, o.created_at,
            c.full_name, c.phone, ${mayViewClientEmail ? "c.email" : "NULL::text AS email"}
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     ORDER BY o.created_at DESC`,
  );

  const items = orders.length
    ? await queryRows<RowDataPacket>(
        `SELECT order_id, title, division, quantity, unit_amount, line_total, booking_details
         FROM order_items WHERE order_id IN (${orders.map(() => "?").join(",")})`,
        orders.map((o) => o.id),
      )
    : [];

  const payments = orders.length
    ? await queryRows<RowDataPacket>(
        `SELECT order_id, provider, reference, provider_transaction_id, status, amount, created_at
         FROM payments WHERE order_id IN (${orders.map(() => "?").join(",")}) ORDER BY created_at DESC`,
        orders.map((o) => o.id),
      )
    : [];

  const itemsMap = new Map<string, unknown[]>();
  for (const i of items) {
    const arr = itemsMap.get(i.order_id) || [];
    arr.push({
      title: i.title,
      division: i.division,
      quantity: Number(i.quantity),
      unit_amount: Number(i.unit_amount),
      line_total: Number(i.line_total),
      booking_details: parseJsonValue(i.booking_details, {}),
    });
    itemsMap.set(i.order_id, arr);
  }

  const payMap = new Map<string, unknown[]>();
  for (const p of payments) {
    const arr = payMap.get(p.order_id) || [];
    arr.push({ ...p, amount: Number(p.amount) });
    payMap.set(p.order_id, arr);
  }

  const formatted = orders.map((order) => {
    const maskedPhone = staff.role === "super_admin" || staff.role === "orders_admin"
      ? order.phone || ""
      : order.phone ? `•••• ${String(order.phone).slice(-4)}` : "";

    return {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      total_amount: Number(order.total_amount),
      currency: order.currency,
      created_at: order.created_at,
      cancel_requested_at: order.cancel_requested_at,
      cancel_reason: order.cancel_reason,
      profiles: {
        full_name: order.full_name,
        phone: maskedPhone,
        email: staff.role === "super_admin" || staff.role === "orders_admin" ? order.email || "" : "",
      },
      items: itemsMap.get(order.id) || [],
      payments: payMap.get(order.id) || [],
    };
  });

  return NextResponse.json({ orders: formatted });
}

export async function PATCH(request: Request) {
  const staff = await getSessionUser();
  if (!staff || !hasPermission(staff.role, "orders.edit")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    orderId?: string;
    status?: string;
    action?: "confirm_manual_payment";
    transactionRef?: string;
  } | null;

  if (!body?.orderId) {
    return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
  }

  if (body.action === "confirm_manual_payment") {
    try {
      const order = await queryOne<RowDataPacket>(
        `SELECT id, customer_id, order_number, total_amount, payment_status FROM orders WHERE id = ? LIMIT 1`,
        [body.orderId],
      );
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      if (order.payment_status === "paid") return NextResponse.json({ error: "Order is already paid." }, { status: 409 });

      const ref = `YEL-MAN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const txId = body.transactionRef?.trim() || `MANUAL-${Date.now()}`;

      await withTransaction(async (conn) => {
        await conn.execute(`UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND status = 'pending'`, [order.id]);
        await conn.execute(
          `INSERT INTO payments (id, order_id, customer_id, provider, reference, amount, status, metadata)
           VALUES (?, ?, ?, 'manual', ?, ?, 'pending', ?)`,
          [crypto.randomUUID(), order.id, order.customer_id, ref, Number(order.total_amount), JSON.stringify({ recordedBy: staff.name })],
        );
      });

      await confirmOrderPayment({
        orderId: order.id,
        reference: ref,
        provider: "manual",
        providerTransactionId: txId,
        amount: Number(order.total_amount),
        metadata: { verifiedBy: staff.name },
      });

      await logAdminActivity({
        userId: staff.id,
        actorName: staff.name,
        action: "order.manual_payment_confirmed",
        entityType: "order",
        entityId: order.order_number,
        details: `Confirmed manual payment (${txId}) for ${order.order_number}`,
      });
      await notifyClientOrderUpdate(order.id, `Payment received for order ${order.order_number}.`, `Order ${order.order_number} placed`);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not confirm manual payment." }, { status: 400 });
    }
  }

  if (!orderStatuses.includes(body.status as typeof orderStatuses[number])) {
    return NextResponse.json({ error: "Choose a valid order status." }, { status: 400 });
  }

  try {
    const result = await updateClientOrderStatus({
      orderId: body.orderId,
      nextStatus: body.status as typeof orderStatuses[number],
      staffId: staff.id,
      staffName: staff.name,
    });
    await notifyClientOrderUpdate(body.orderId, result.alert_message, `Order ${result.order_number} update`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not update order status.";
    return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 409 });
  }
}
