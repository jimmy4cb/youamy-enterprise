export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminDatabase } from "@backend/lib/admin-db";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";
import { getSessionUser, hasPermission } from "@backend/lib/admin-auth";

const appointmentStatuses = ["Requested", "Confirmed", "Completed", "Cancelled"] as const;

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: appointments, error } = await supabase
      .from("appointment_requests")
      .select(
        "id, service_type, target, client_name, client_phone, preferred_date, preferred_time, location, location_latitude, location_longitude, notes, status, notification_status, notification_error, created_at",
      )
      .order("preferred_date", { ascending: true })
      .order("preferred_time", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ appointments });
  } catch (error) {
    console.error("Could not load appointment requests", error);
    return NextResponse.json({ error: "Could not load appointment requests." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.reply")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    id?: number;
    status?: string;
  } | null;
  if (!body || !Number.isSafeInteger(body.id) || typeof body.status !== "string" ||
      !appointmentStatuses.includes(body.status as typeof appointmentStatuses[number])) {
    return NextResponse.json({ error: "Choose a valid appointment and status." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: appointment, error: findError } = await supabase
      .from("appointment_requests")
      .select("id, status, target")
      .eq("id", body.id)
      .maybeSingle();
    if (findError) throw findError;
    if (!appointment) {
      return NextResponse.json({ error: "Appointment request not found." }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("appointment_requests")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", appointment.id);
    if (updateError) throw updateError;

    if (appointment.status !== body.status) {
      const db = await getAdminDatabase();
      await db.run(
        "INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)",
        [user.id, "appointment.status_updated", `${appointment.target}: ${appointment.status} → ${body.status}`],
      );
    }
    return NextResponse.json({ ok: true, status: body.status });
  } catch (error) {
    console.error("Could not update appointment status", error);
    return NextResponse.json({ error: "Could not update appointment status." }, { status: 500 });
  }
}
