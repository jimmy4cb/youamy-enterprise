import { NextResponse } from "next/server";
import type { RowDataPacket } from "@backend/lib/postgres";
import { getCurrentCustomer } from "@backend/lib/customer-auth";
import { createCheckoutOrder } from "@backend/lib/business-logic";
import { queryRows } from "@backend/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const orders = await queryRows<RowDataPacket>(
    `SELECT id, order_number, status, payment_status, total_amount, currency, created_at
     FROM orders
     WHERE customer_id = ?
     ORDER BY created_at DESC`,
    [customer.id],
  );

  const items = orders.length
    ? await queryRows<RowDataPacket>(
        `SELECT order_id, title, quantity, unit_amount, line_total
         FROM order_items
         WHERE order_id IN (${orders.map(() => "?").join(",")})`,
        orders.map((o) => o.id),
      )
    : [];

  const itemsByOrder = new Map<string, Array<{ title: string; quantity: number; unit_amount: number; line_total: number }>>();
  for (const item of items) {
    const list = itemsByOrder.get(item.order_id) || [];
    list.push({
      title: item.title,
      quantity: Number(item.quantity),
      unit_amount: Number(item.unit_amount),
      line_total: Number(item.line_total),
    });
    itemsByOrder.set(item.order_id, list);
  }

  return NextResponse.json({
    orders: orders.map((order) => ({
      ...order,
      total_amount: Number(order.total_amount),
      order_items: itemsByOrder.get(order.id) || [],
    })),
  });
}

export async function POST(request: Request) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: "Sign in before checkout." }, { status: 401 });

    const body = await request.json().catch(() => null) as {
      checkoutKey?: string;
      items?: Array<{ product_id: string; quantity: number; booking_details?: Record<string, string> }>;
      notes?: string;
    } | null;

    if (!body?.checkoutKey || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Your cart is empty or invalid." }, { status: 400 });
    }
    if (body.items.length > 50) {
      return NextResponse.json({ error: "Your cart has too many different items." }, { status: 400 });
    }
    const productIds = body.items.map((item) => item.product_id);
    if (new Set(productIds).size !== productIds.length || productIds.some((id) => !id)) {
      return NextResponse.json({ error: "Cart items are invalid." }, { status: 400 });
    }

    const order = await createCheckoutOrder({
      customerId: customer.id,
      checkoutKey: body.checkoutKey,
      items: body.items,
      notes: body.notes,
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Order creation failed", error);
    const msg = error instanceof Error ? error.message : "Could not create the order.";
    const status = msg.includes("already booked") || msg.includes("available") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
