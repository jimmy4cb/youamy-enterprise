import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminDatabase } from "@backend/lib/admin-db";
import { SESSION_COOKIE } from "@backend/lib/admin-auth";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    const db = await getAdminDatabase();
    await db.run("DELETE FROM admin_sessions WHERE id = ?", [sessionId]);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
