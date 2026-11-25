import { NextResponse } from "next/server";
import type { RowDataPacket } from "@backend/lib/postgres";
import { getCurrentCustomer } from "@backend/lib/customer-auth";
import { executeSql, queryRows } from "@backend/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const items = await queryRows<RowDataPacket>(
    `SELECT product_id FROM saved_items WHERE customer_id = ? ORDER BY created_at DESC`,
    [customer.id],
  );
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in to save items." }, { status: 401 });
  const body = await request.json().catch(() => null) as { product_id?: string } | null;
  if (!body?.product_id) return NextResponse.json({ error: "Choose an item." }, { status: 400 });

  await executeSql(
    `INSERT IGNORE INTO saved_items (customer_id, product_id) VALUES (?, ?)`,
    [customer.id, body.product_id],
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const productId = new URL(request.url).searchParams.get("product_id");
  if (!productId) return NextResponse.json({ error: "Choose an item." }, { status: 400 });

  await executeSql(
    `DELETE FROM saved_items WHERE customer_id = ? AND product_id = ?`,
    [customer.id, productId],
  );
  return NextResponse.json({ ok: true });
}
