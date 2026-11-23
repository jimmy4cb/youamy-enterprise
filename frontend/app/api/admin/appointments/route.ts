import { NextResponse } from "next/server";
import { getAdminDatabase } from "@backend/lib/admin-db";
import { getSessionUser, hasPermission } from "@backend/lib/admin-auth";

const appointmentStatuses = ["Requested", "Confirmed", "Completed", "Cancelled"] as const;

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const db = await getAdminDatabase();
    const appointments = await db.all(
      `SELECT id, service_type, target, client_name, client_phone, preferred_date,
              preferred_time, location, location_latitude, location_longitude,
              notes, status, notification_status,
              notification_error, created_at
       FROM appointment_requests
       ORDER BY preferred_date, preferred_time, created_at DESC
       LIMIT 200`,
    );
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
    const db = await getAdminDatabase();
    const appointment = await db.get(
      "SELECT id, status, target FROM appointment_requests WHERE id = ?",
      [body.id],
    ) as { id: number; status: string; target: string } | undefined;
    if (!appointment) {
      return NextResponse.json({ error: "Appointment request not found." }, { status: 404 });
    }

    await db.run(
      "UPDATE appointment_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [body.status, appointment.id],
    );
    if (appointment.status !== body.status) {
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
