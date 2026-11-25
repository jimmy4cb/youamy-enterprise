import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getCurrentCustomer } from "@backend/lib/customer-auth";
import { executeSql, queryRows } from "@backend/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const alerts = await queryRows<RowDataPacket>(
    `SELECT id, message, read_at, created_at, order_id
     FROM client_alerts
     WHERE customer_id = ?
     ORDER BY created_at DESC`,
    [customer.id],
  );
  return NextResponse.json({ alerts });
}

export async function PATCH(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { alertId?: string } | null;
  if (!body?.alertId) return NextResponse.json({ error: "Alert ID is required." }, { status: 400 });

  await executeSql(
    `UPDATE client_alerts SET read_at = UTC_TIMESTAMP(3) WHERE id = ? AND customer_id = ?`,
    [body.alertId, customer.id],
  );
  return NextResponse.json({ ok: true });
}
