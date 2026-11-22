import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminDatabase } from "@backend/lib/admin-db";
import {
  PENDING_COOKIE,
  SESSION_COOKIE,
  createToken,
  verifyTotp,
} from "@backend/lib/admin-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { code?: string } | null;
  const code = body?.code?.replace(/\s/g, "") || "";
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(PENDING_COOKIE)?.value;
  if (!pendingToken || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter a valid six-digit code." }, { status: 400 });
  }

  const db = await getAdminDatabase();
  const pending = await db.get(
    `SELECT p.user_id, u.totp_secret, p.setup_secret
     FROM pending_logins p JOIN admin_users u ON u.id = p.user_id
     WHERE p.token = ? AND p.expires_at > datetime('now')`,
    [pendingToken],
  );
  if (!pending) {
    return NextResponse.json({ error: "Your sign-in request expired. Sign in again." }, { status: 401 });
  }

  const secret = (pending.setup_secret as string | null) || (pending.totp_secret as string | null);
  if (!secret) {
    return NextResponse.json({ error: "Two-step setup is unavailable." }, { status: 400 });
  }
  if (!verifyTotp(secret, code)) {
    return NextResponse.json({ error: "The verification code is incorrect." }, { status: 401 });
  }

  if (!pending.totp_secret) {
    await db.run("UPDATE admin_users SET totp_secret = ? WHERE id = ?", [secret, pending.user_id]);
  }
  const sessionId = createToken();
  await db.run(
    "INSERT INTO admin_sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+8 hours'))",
    [sessionId, pending.user_id],
  );
  await db.run("DELETE FROM pending_logins WHERE token = ?", [pendingToken]);

  await db.run(
    "INSERT INTO activity_log (user_id, action, details) VALUES (?, 'admin.login', 'Staff member signed in')",
    [pending.user_id],
  );

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 28800,
    path: "/",
  });
  response.cookies.delete(PENDING_COOKIE);
  return response;
}
