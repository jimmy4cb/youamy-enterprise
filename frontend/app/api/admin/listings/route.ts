import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getSessionUser, hasPermission } from "@backend/lib/admin-auth";
import { queryRows } from "@backend/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "listings.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const products = await queryRows<RowDataPacket>(
    `SELECT id, title, division, location AS detail, status, updated_at FROM products WHERE status <> 'archived' ORDER BY updated_at DESC`,
  );
  return NextResponse.json({ listings: products });
}
