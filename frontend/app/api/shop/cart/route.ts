import { NextResponse } from "next/server";
import crypto from "node:crypto";
import type { RowDataPacket } from "@backend/lib/postgres";
import { getCurrentCustomer } from "@backend/lib/customer-auth";
import { parseJsonValue, queryRows, withTransaction } from "@backend/lib/postgres";

export const dynamic = "force-dynamic";

async function ensureCartId(customerId: string): Promise<string> {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT id FROM carts WHERE customer_id = ? LIMIT 1`, [customerId]);
    if (rows[0]?.id) return rows[0].id as string;
    const id = crypto.randomUUID();
    await conn.execute(`INSERT INTO carts (id, customer_id) VALUES (?, ?)`, [id, customerId]);
    return id;
  });
}

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const cartId = await ensureCartId(customer.id);
  const rows = await queryRows<RowDataPacket>(
    `SELECT ci.product_id, ci.quantity, ci.booking_details,
            p.title, p.division, p.image_urls, p.amount_kes, p.price_unit, p.booking_kind, p.status, p.purchasable
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = ? AND p.status = 'available' AND p.purchasable = 1`,
    [cartId],
  );

  const items = rows.map((row) => ({
    product_id: row.product_id,
    quantity: Number(row.quantity),
    booking_details: parseJsonValue<Record<string, string>>(row.booking_details, {}),
    id: row.product_id,
    title: row.title,
    division: row.division,
    image_urls: parseJsonValue<string[]>(row.image_urls, []),
    amount_kes: Number(row.amount_kes),
    price_unit: row.price_unit,
    booking_kind: row.booking_kind,
  }));

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null) as {
    items?: Array<{ product_id: string; quantity: number; booking_details?: Record<string, string> }>;
  } | null;
  if (!Array.isArray(body?.items)) return NextResponse.json({ error: "Invalid cart." }, { status: 400 });

  const cartId = await ensureCartId(customer.id);
  await withTransaction(async (conn) => {
    for (const item of body.items || []) {
      if (!item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) continue;
      const [prodRows] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM products WHERE id = ? AND status = 'available' AND purchasable = 1 LIMIT 1`,
        [item.product_id],
      );
      if (!prodRows.length) continue;

      const [existingRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? LIMIT 1`,
        [cartId, item.product_id],
      );
      if (existingRows.length > 0) {
        const nextQty = Math.min(20, Math.max(Number(existingRows[0].quantity), item.quantity));
        await conn.execute(
          `UPDATE cart_items SET quantity = ?, booking_details = ? WHERE id = ?`,
          [nextQty, JSON.stringify(item.booking_details || {}), existingRows[0].id],
        );
      } else {
        await conn.execute(
          `INSERT INTO cart_items (id, cart_id, product_id, quantity, booking_details) VALUES (?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), cartId, item.product_id, item.quantity, JSON.stringify(item.booking_details || {})],
        );
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null) as {
    items?: Array<{ product_id: string; quantity: number; booking_details?: Record<string, string> }>;
  } | null;
  if (!Array.isArray(body?.items) || body.items.length > 50) {
    return NextResponse.json({ error: "Invalid cart." }, { status: 400 });
  }
  if (body.items.some((item) => !item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
    return NextResponse.json({ error: "Cart item quantities are invalid." }, { status: 400 });
  }

  const cartId = await ensureCartId(customer.id);
  await withTransaction(async (conn) => {
    await conn.execute(`DELETE FROM cart_items WHERE cart_id = ?`, [cartId]);
    for (const item of body.items || []) {
      await conn.execute(
        `INSERT INTO cart_items (id, cart_id, product_id, quantity, booking_details) VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), cartId, item.product_id, item.quantity, JSON.stringify(item.booking_details || {})],
      );
    }
  });

  return NextResponse.json({ ok: true });
}
