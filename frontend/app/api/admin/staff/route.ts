import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getAdminDatabase, type AdminRole } from "@backend/lib/admin-db";
import { getSessionUser } from "@backend/lib/admin-auth";

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
  const db = await getAdminDatabase();
  const staff = await db.all(
    "SELECT id, name, email, role, active, created_at FROM admin_users ORDER BY created_at DESC",
  );
  return NextResponse.json({ staff });
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
  const db = await getAdminDatabase();
  try {
    const passwordHash = await bcrypt.hash(body.password, 12);
    await db.run(
      "INSERT INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [body.name.trim(), body.email.trim().toLowerCase(), passwordHash, body.role],
    );
    await db.run(
      "INSERT INTO activity_log (user_id, action, details) VALUES (?, 'staff.created', ?)",
      [user.id, body.email.trim().toLowerCase()],
    );
  } catch (error) {
    const message = error instanceof Error && error.message.includes("UNIQUE") ? "A staff account already uses that email." : "Could not create the staff account.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
