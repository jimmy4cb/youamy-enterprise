import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import {
  PENDING_COOKIE,
  SESSION_COOKIE,
  createToken,
  logAdminActivity,
  verifyTotp,
} from "@backend/lib/admin-auth";
import { executeSql, queryOne, toMysqlDatetime } from "@backend/lib/mysql";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { code?: string } | null;
  const code = body?.code?.replace(/\s/g, "") || "";
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(PENDING_COOKIE)?.value;

  if (!pendingToken || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter a valid six-digit code." }, { status: 400 });
  }

  try {
    const pending = await queryOne<RowDataPacket>(
      `SELECT user_id, setup_secret FROM admin_pending_logins
       WHERE token = ? AND expires_at > UTC_TIMESTAMP(3) LIMIT 1`,
      [pendingToken],
    );
    if (!pending) {
      return NextResponse.json({ error: "Your sign-in request expired. Sign in again." }, { status: 401 });
    }

    const user = await queryOne<RowDataPacket>(
      `SELECT id, name, email, role, totp_secret, active FROM admin_users WHERE id = ? LIMIT 1`,
      [pending.user_id],
    );
    if (!user || !user.active) {
      return NextResponse.json({ error: "Your account is inactive." }, { status: 401 });
    }

    const secret = pending.setup_secret || user.totp_secret;
    if (!secret || !verifyTotp(secret, code)) {
      return NextResponse.json({ error: "The verification code is incorrect." }, { status: 401 });
    }

    if (!user.totp_secret && pending.setup_secret) {
      await executeSql(
        `UPDATE admin_users SET totp_secret = ?, totp_enabled = 1 WHERE id = ? AND totp_secret IS NULL`,
        [pending.setup_secret, user.id],
      );
    }

    await executeSql(`DELETE FROM admin_pending_logins WHERE token = ?`, [pendingToken]);
    const sessionId = createToken();
    await executeSql(
      `INSERT INTO admin_sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
      [sessionId, user.id, toMysqlDatetime(new Date(Date.now() + 8 * 60 * 60 * 1000))],
    );
    await executeSql(`UPDATE admin_users SET last_login_at = UTC_TIMESTAMP(3) WHERE id = ?`, [user.id]);
    await logAdminActivity({
      userId: Number(user.id),
      actorName: user.name,
      action: "admin.login_2fa",
      entityType: "admin_user",
      entityId: user.id,
      details: `${user.name} verified 2FA and signed in`,
    });

    const isHttps = request.headers.get("x-forwarded-proto") === "https" || request.url.startsWith("https://");
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: 28800,
      path: "/",
    });
    response.cookies.delete(PENDING_COOKIE);
    return response;
  } catch (error) {
    console.error("Could not verify admin sign-in", error);
    return NextResponse.json({ error: "Could not verify sign-in." }, { status: 500 });
  }
}
