import { NextResponse } from "next/server";
import { getSessionUser } from "@backend/lib/admin-auth";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";

export const dynamic = "force-dynamic";

const activityTables = ["job_applications", "appointment_requests", "inquiries"] as const;
type ActivityTable = (typeof activityTables)[number];

function isActivityTable(value: unknown): value is ActivityTable {
  return typeof value === "string" && activityTables.includes(value as ActivityTable);
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    const [applicationsRes, appointmentsRes, inquiriesRes] = await Promise.all([
      supabase
        .from("job_applications")
        .select("id, application_id, job_title, destination, full_name, phone, email, experience, notes, cv_name, cv_type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("appointment_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (applicationsRes.error) throw applicationsRes.error;
    if (appointmentsRes.error) throw appointmentsRes.error;
    if (inquiriesRes.error) throw inquiriesRes.error;

    return NextResponse.json({
      admin: { name: user.name, email: user.email, role: user.role },
      applications: applicationsRes.data,
      appointments: appointmentsRes.data,
      inquiries: inquiriesRes.data,
    });
  } catch (error) {
    console.error("Could not load admin activity", error);
    return NextResponse.json({ error: "Could not load admin activity." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as {
      table?: unknown;
      id?: unknown;
      status?: unknown;
    } | null;
    if (
      !body ||
      !isActivityTable(body.table) ||
      typeof body.id !== "number" ||
      !Number.isSafeInteger(body.id) ||
      body.id <= 0 ||
      typeof body.status !== "string" ||
      !body.status.trim() ||
      body.status.trim().length > 40
    ) {
      return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: updated, error } = await supabase
      .from(body.table)
      .update({ status: body.status.trim() })
      .eq("id", body.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) {
      return NextResponse.json({ error: "Activity record not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not update admin activity status", error);
    return NextResponse.json({ error: "Could not update activity status." }, { status: 500 });
  }
}
