import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getCurrentCustomer } from "@backend/lib/customer-auth";
import { executeSql, parseJsonValue, queryOne, queryRows } from "@backend/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;

  const order = await queryOne<RowDataPacket>(
    `SELECT id, order_number, status, payment_status, total_amount, currency, created_at, cancel_requested_at, cancel_reason
     FROM orders
     WHERE id = ? AND customer_id = ?
     LIMIT 1`,
    [id, customer.id],
  );
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const [items, events, payments] = await Promise.all([
    queryRows<RowDataPacket>(
      `SELECT title, division, quantity, unit_amount, line_total, booking_details
       FROM order_items WHERE order_id = ?`,
      [id],
    ),
    queryRows<RowDataPacket>(
      `SELECT status, note, created_at FROM order_status_events WHERE order_id = ? ORDER BY created_at ASC`,
      [id],
    ),
    queryRows<RowDataPacket>(
      `SELECT provider, reference, status, provider_transaction_id, metadata, created_at
       FROM payments WHERE order_id = ? ORDER BY created_at DESC`,
      [id],
    ),
  ]);

  return NextResponse.json({
    order: {
      ...order,
      total_amount: Number(order.total_amount),
      order_items: items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unit_amount: Number(item.unit_amount),
        line_total: Number(item.line_total),
        booking_details: parseJsonValue(item.booking_details, {}),
      })),
      order_status_events: events,
      payments: payments.map((p) => {
        const meta = parseJsonValue(p.metadata, {});
        return { ...p, metadata: meta, raw_payload: meta };
      }),
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { reason?: string };

  const order = await queryOne<RowDataPacket>(
    `SELECT id, status, payment_status, cancel_requested_at
     FROM orders WHERE id = ? AND customer_id = ? LIMIT 1`,
    [id, customer.id],
  );
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (["Completed", "Cancelled"].includes(order.status)) {
    return NextResponse.json({ error: "This order can no longer be cancelled." }, { status: 409 });
  }
  if (order.payment_status !== "paid") {
    return NextResponse.json({ error: "Only paid orders can be submitted for cancellation." }, { status: 409 });
  }
  if (order.cancel_requested_at) {
    return NextResponse.json({ error: "A cancellation request is already pending." }, { status: 409 });
  }

  await executeSql(
    `UPDATE orders SET cancel_requested_at = UTC_TIMESTAMP(3), cancel_reason = ? WHERE id = ? AND customer_id = ?`,
    [(body.reason || "Requested by client").trim().slice(0, 500), id, customer.id],
  );

  return NextResponse.json({ ok: true, message: "Cancellation request sent to the Youamy team." });
}
