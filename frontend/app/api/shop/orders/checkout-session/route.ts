import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getCurrentCustomer } from "@backend/lib/customer-auth";
import { queryOne, queryRows } from "@backend/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const key = new URL(request.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Checkout key is required." }, { status: 400 });

  const order = await queryOne<RowDataPacket>(
    `SELECT id, payment_status FROM orders WHERE customer_id = ? AND checkout_key = ? LIMIT 1`,
    [customer.id, key],
  );
  if (!order || order.payment_status !== "paid") {
    return NextResponse.json({ paid: false, productIds: [] });
  }

  const items = await queryRows<RowDataPacket>(
    `SELECT product_id FROM order_items WHERE order_id = ? AND product_id IS NOT NULL`,
    [order.id],
  );
  return NextResponse.json({
    paid: true,
    productIds: items.map((i) => i.product_id),
  });
}
