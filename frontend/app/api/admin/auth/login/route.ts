import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import {
  PENDING_COOKIE,
  SESSION_COOKIE,
  createToken,
  generateTotpSecret,
  logAdminActivity,
} from "@backend/lib/admin-auth";
import { executeSql, queryOne, toMysqlDatetime } from "@backend/lib/mysql";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password || "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const user = await queryOne<RowDataPacket>(
      `SELECT id, name, email, role, password_hash, totp_secret, totp_enabled, active
       FROM admin_users WHERE email = ? LIMIT 1`,
      [email],
    );

    if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    await executeSql(`DELETE FROM admin_pending_logins WHERE expires_at < UTC_TIMESTAMP(3)`);
    await executeSql(`DELETE FROM admin_sessions WHERE expires_at < UTC_TIMESTAMP(3)`);

    const isHttps = request.headers.get("x-forwarded-proto") === "https" || request.url.startsWith("https://");

    // If 2FA TOTP is enabled on this admin account, enter 2-step flow
    if (Boolean(user.totp_enabled)) {
      const pendingToken = createToken();
      const setupSecret = user.totp_secret ? null : generateTotpSecret();
      const pendingExpires = toMysqlDatetime(new Date(Date.now() + 10 * 60 * 1000));

      await executeSql(
        `INSERT INTO admin_pending_logins (token, user_id, setup_secret, expires_at) VALUES (?, ?, ?, ?)`,
        [pendingToken, user.id, setupSecret, pendingExpires],
      );

      const response = NextResponse.json({
        needsTwoStep: true,
        requireTotp: true,
        setup: !user.totp_secret,
        setupSecret,
      });
      response.cookies.set(PENDING_COOKIE, pendingToken, {
        httpOnly: true,
        secure: isHttps,
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });
      return response;
    }

    // Direct password login when TOTP is not enabled for this account
    const sessionId = createToken();
    const sessionExpires = toMysqlDatetime(new Date(Date.now() + 8 * 60 * 60 * 1000));
    await executeSql(
      `INSERT INTO admin_sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
      [sessionId, user.id, sessionExpires],
    );
    await executeSql(`UPDATE admin_users SET last_login_at = UTC_TIMESTAMP(3) WHERE id = ?`, [user.id]);
    await logAdminActivity({
      userId: Number(user.id),
      actorName: user.name,
      action: "admin.login",
      entityType: "admin_user",
      entityId: user.id,
      details: `${user.name} signed in to Admin Console`,
    });

    const response = NextResponse.json({ needsTwoStep: false, requireTotp: false, ok: true });
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: 28800,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Could not start admin sign-in", error);
    return NextResponse.json({ error: "Could not start sign-in. Please try again." }, { status: 500 });
  }
}
