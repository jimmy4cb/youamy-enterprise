import { NextResponse } from "next/server";
import type { RowDataPacket } from "@backend/lib/postgres";
import { getCurrentCustomer } from "@backend/lib/customer-auth";
import { queryOne } from "@backend/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json({ authenticated: false, customer: null, unreadAlerts: 0, cartCount: 0 });
    }
    const [alertsRow, cartRow] = await Promise.all([
      queryOne<RowDataPacket>(
        `SELECT COUNT(*) AS cnt FROM client_alerts WHERE customer_id = ? AND read_at IS NULL`,
        [customer.id],
      ),
      queryOne<RowDataPacket>(
        `SELECT COALESCE(SUM(ci.quantity), 0) AS cnt
         FROM cart_items ci
         JOIN carts c ON c.id = ci.cart_id
         WHERE c.customer_id = ?`,
        [customer.id],
      ),
    ]);
    return NextResponse.json({
      authenticated: true,
      customer,
      unreadAlerts: Number(alertsRow?.cnt || 0),
      cartCount: Number(cartRow?.cnt || 0),
    });
  } catch {
    return NextResponse.json({ authenticated: false, customer: null, unreadAlerts: 0, cartCount: 0 });
  }
}
