import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getAdminDatabase } from "@backend/lib/admin-db";
import { PENDING_COOKIE, createToken, generateTotpSecret } from "@backend/lib/admin-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password || "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const db = await getAdminDatabase();
  const user = await db.get(
    "SELECT id, name, email, password_hash, role, totp_secret, active FROM admin_users WHERE email = ?",
    [email],
  );
  if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const pendingToken = createToken();
  await db.run(
    "CREATE TABLE IF NOT EXISTS pending_logins (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, setup_secret TEXT, expires_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE)",
  );
  const setupSecret = user.totp_secret ? null : generateTotpSecret();
  await db.run(
    "INSERT OR REPLACE INTO pending_logins (token, user_id, setup_secret, expires_at) VALUES (?, ?, ?, datetime('now', '+10 minutes'))",
    [pendingToken, user.id, setupSecret],
  );

  const response = NextResponse.json({
    needsTwoStep: true,
    setup: !user.totp_secret,
    setupSecret,
  });
  response.cookies.set(PENDING_COOKIE, pendingToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
