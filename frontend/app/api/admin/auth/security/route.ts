import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  generateTotpSecret,
  getSessionUser,
  logAdminActivity,
  verifyTotp,
} from "@backend/lib/admin-auth";
import { executeSql, queryOne, type RowDataPacket } from "@backend/lib/postgres";

interface AdminPasswordRow extends RowDataPacket {
  password_hash: string;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  return NextResponse.json({
    totpEnabled: user.totp_enabled,
    hasSecret: Boolean(user.totp_secret),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    action?: "generate_totp" | "enable_totp" | "disable_totp" | "change_password";
    secret?: string;
    code?: string;
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  if (body.action === "generate_totp") {
    const secret = generateTotpSecret();
    return NextResponse.json({ secret });
  }

  if (body.action === "enable_totp") {
    if (!body.secret || !body.code || !verifyTotp(body.secret, body.code)) {
      return NextResponse.json({ error: "Invalid verification code for that secret." }, { status: 400 });
    }
    await executeSql(
      `UPDATE admin_users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?`,
      [body.secret, user.id],
    );
    await logAdminActivity({
      userId: user.id,
      actorName: user.name,
      action: "admin.2fa_enabled",
      entityType: "admin_user",
      entityId: user.id,
      details: `${user.name} enabled TOTP 2FA`,
    });
    return NextResponse.json({ ok: true, totpEnabled: true });
  }

  if (body.action === "disable_totp") {
    await executeSql(`UPDATE admin_users SET totp_enabled = 0 WHERE id = ?`, [user.id]);
    await logAdminActivity({
      userId: user.id,
      actorName: user.name,
      action: "admin.2fa_disabled",
      entityType: "admin_user",
      entityId: user.id,
      details: `${user.name} disabled TOTP 2FA`,
    });
    return NextResponse.json({ ok: true, totpEnabled: false });
  }

  if (body.action === "change_password") {
    if (!body.currentPassword || !body.newPassword || !body.confirmPassword) {
      return NextResponse.json({ error: "Complete all password fields." }, { status: 400 });
    }
    if (body.newPassword.length < 12) {
      return NextResponse.json({ error: "New password must be at least 12 characters." }, { status: 400 });
    }
    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json({ error: "New passwords do not match." }, { status: 400 });
    }
    const account = await queryOne<AdminPasswordRow>(
      `SELECT password_hash FROM admin_users WHERE id = ? LIMIT 1`,
      [user.id],
    );
    if (!account || !(await bcrypt.compare(body.currentPassword, account.password_hash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }
    const hash = await bcrypt.hash(body.newPassword, 12);
    await executeSql(`UPDATE admin_users SET password_hash = ? WHERE id = ?`, [hash, user.id]);
    await logAdminActivity({
      userId: user.id,
      actorName: user.name,
      action: "admin.password_changed",
      entityType: "admin_user",
      entityId: user.id,
      details: `${user.name} updated their password`,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
