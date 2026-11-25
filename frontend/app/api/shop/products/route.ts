import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { parseJsonValue, queryRows } from "@backend/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();
    const division = url.searchParams.get("division");

    let sql = `
      SELECT id, slug, title, division, listing_kind, description, location, specs,
             image_urls, amount_kes, price_unit, stock_quantity, status, purchasable, booking_kind
      FROM products
      WHERE purchasable = 1 AND status = 'available' AND stock_quantity > 0
    `;
    const params: unknown[] = [];
    if (query) {
      sql += ` AND (title LIKE ? OR description LIKE ? OR location LIKE ?)`;
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }
    if (division && division !== "All") {
      sql += ` AND division = ?`;
      params.push(division);
    }
    sql += ` ORDER BY featured DESC, created_at DESC`;

    const rows = await queryRows<RowDataPacket>(sql, params);
    const products = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      division: row.division,
      listing_kind: row.listing_kind,
      description: row.description,
      location: row.location,
      specs: parseJsonValue(row.specs, {}),
      image_urls: parseJsonValue<string[]>(row.image_urls, []),
      amount_kes: Number(row.amount_kes),
      price_unit: row.price_unit,
      stock_quantity: Number(row.stock_quantity),
      status: row.status,
      booking_kind: row.booking_kind,
    }));

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Could not load products", error);
    return NextResponse.json({ error: "Products are temporarily unavailable." }, { status: 503 });
  }
}
