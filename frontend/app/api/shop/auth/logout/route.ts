import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { executeSql } from "@backend/lib/mysql";
import { CUSTOMER_SESSION_COOKIE } from "@backend/lib/customer-auth";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (sessionId) {
    await executeSql(`DELETE FROM customer_sessions WHERE id = ?`, [sessionId]);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(CUSTOMER_SESSION_COOKIE);
  return response;
}
