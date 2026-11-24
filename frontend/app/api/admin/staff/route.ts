import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getAdminDatabase, syncAdminUserMirror, type AdminRole } from "@backend/lib/admin-db";
import { getSessionUser } from "@backend/lib/admin-auth";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";

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
  try {
    const supabase = createSupabaseAdminClient();
    const { data: staff, error } = await supabase
      .from("admin_users")
      .select("id, name, email, role, active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Could not load admin staff", error);
    return NextResponse.json({ error: "Could not load staff accounts." }, { status: 500 });
  }
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
  const email = body.email.trim().toLowerCase();
  const name = body.name.trim();
  try {
    const passwordHash = await bcrypt.hash(body.password, 12);
    const supabase = createSupabaseAdminClient();
    const { data: staffMember, error: insertError } = await supabase
      .from("admin_users")
      .insert({ name, email, password_hash: passwordHash, role: body.role, active: true })
      .select("id")
      .single();
    if (insertError?.code === "23505") {
      return NextResponse.json({ error: "A staff account already uses that email." }, { status: 409 });
    }
    if (insertError) throw insertError;

    try {
      await syncAdminUserMirror({
        id: staffMember.id,
        name,
        email,
        role: body.role,
        totp_secret: null,
        active: true,
      });
    } catch (error) {
      const { error: rollbackError } = await supabase.from("admin_users").delete().eq("id", staffMember.id);
      if (rollbackError) console.error("Could not roll back staff account after local mirror failure", rollbackError);
      throw error;
    }

    const db = await getAdminDatabase();
    try {
      await db.run(
        "INSERT INTO activity_log (user_id, action, details) VALUES (?, 'staff.created', ?)",
        [user.id, email],
      );
    } catch (error) {
      console.error("Staff account was created, but activity logging failed", error);
      return NextResponse.json(
        { error: "Staff account was created, but audit logging failed. Refresh the staff list." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not create admin staff account", error);
    return NextResponse.json({ error: "Could not create the staff account." }, { status: 500 });
  }
}
