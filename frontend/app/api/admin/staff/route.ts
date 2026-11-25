import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "@backend/lib/postgres";
import { getSessionUser, logAdminActivity, type AdminRole } from "@backend/lib/admin-auth";
import { executeSql, queryOne, queryRows } from "@backend/lib/postgres";

export const dynamic = "force-dynamic";

const allowedRoles: AdminRole[] = [
  "super_admin",
  "listings_admin",
  "orders_admin",
  "support_agent",
  "content_editor",
];

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const staff = await queryRows<RowDataPacket>(
    `SELECT id, name, email, role, totp_enabled, active, last_login_at, created_at
     FROM admin_users
     ORDER BY created_at DESC`,
  );

  return NextResponse.json({
    staff: staff.map((s) => ({
      ...s,
      id: Number(s.id),
      totp_enabled: Boolean(s.totp_enabled),
      active: Boolean(s.active),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    name?: string;
    email?: string;
    role?: AdminRole;
    password?: string;
  } | null;

  if (!body?.name?.trim() || !body.email?.trim() || !body.password || !body.role) {
    return NextResponse.json({ error: "Name, email, password and role are required." }, { status: 400 });
  }
  if (!allowedRoles.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  if (body.password.length < 12) {
    return NextResponse.json({ error: "Password must be at least 12 characters." }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const existing = await queryOne<RowDataPacket>(`SELECT id FROM admin_users WHERE email = ? LIMIT 1`, [email]);
  if (existing) {
    return NextResponse.json({ error: "A staff account already uses that email." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const res = await executeSql(
    `INSERT INTO admin_users (name, email, password_hash, role, totp_enabled, active)
     VALUES (?, ?, ?, ?, 0, 1)`,
    [body.name.trim(), email, passwordHash, body.role],
  );

  await logAdminActivity({
    userId: user.id,
    actorName: user.name,
    action: "staff.created",
    entityType: "admin_user",
    entityId: res.insertId,
    details: `Created ${body.role} account for ${email}`,
  });

  return NextResponse.json({ ok: true, id: res.insertId }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    id?: number;
    role?: AdminRole;
    active?: boolean;
    resetTotp?: boolean;
  } | null;

  if (!body?.id || !Number.isSafeInteger(body.id)) {
    return NextResponse.json({ error: "Staff ID is required." }, { status: 400 });
  }
  if (body.id === user.id && body.active === false) {
    return NextResponse.json({ error: "You cannot deactivate your own active session." }, { status: 400 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  if (body.role && allowedRoles.includes(body.role)) {
    updates.push("role = ?");
    params.push(body.role);
  }
  if (typeof body.active === "boolean") {
    updates.push("active = ?");
    params.push(body.active ? 1 : 0);
  }
  if (body.resetTotp) {
    updates.push("totp_enabled = 0, totp_secret = NULL");
  }
  if (!updates.length) {
    return NextResponse.json({ error: "No updates specified." }, { status: 400 });
  }

  params.push(body.id);
  await executeSql(`UPDATE admin_users SET ${updates.join(", ")} WHERE id = ?`, params);

  await logAdminActivity({
    userId: user.id,
    actorName: user.name,
    action: "staff.updated",
    entityType: "admin_user",
    entityId: body.id,
    details: `Updated staff account #${body.id}`,
  });

  return NextResponse.json({ ok: true });
}
