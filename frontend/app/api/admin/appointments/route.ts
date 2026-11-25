import { NextResponse } from "next/server";
import type { RowDataPacket } from "@backend/lib/postgres";
import { getSessionUser, hasPermission, logAdminActivity } from "@backend/lib/admin-auth";
import { executeSql, parseJsonValue, queryOne, queryRows } from "@backend/lib/postgres";

export const dynamic = "force-dynamic";

const appointmentStatuses = ["Requested", "Confirmed", "Dispatched", "Completed", "Cancelled"] as const;

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const rows = await queryRows<RowDataPacket>(
      `SELECT id, request_id, tracking_code, service_type, target, client_name, client_phone, client_email,
              preferred_date, preferred_time, location, location_latitude, location_longitude,
              estimated_kes, service_options, notes, staff_notes, status,
              notification_status, notification_error, created_at
       FROM appointment_requests
       ORDER BY preferred_date ASC, preferred_time ASC, created_at DESC
       LIMIT 300`,
    );

    return NextResponse.json({
      appointments: rows.map((r) => ({
        ...r,
        id: Number(r.id),
        preferred_date: String(r.preferred_date).slice(0, 10),
        estimated_kes: r.estimated_kes ? Number(r.estimated_kes) : null,
        service_options: parseJsonValue(r.service_options, null),
      })),
    });
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
    staffNotes?: string;
  } | null;

  if (!body || !Number.isSafeInteger(body.id) || typeof body.status !== "string" ||
      !appointmentStatuses.includes(body.status as typeof appointmentStatuses[number])) {
    return NextResponse.json({ error: "Choose a valid appointment and status." }, { status: 400 });
  }

  const existing = await queryOne<RowDataPacket>(
    `SELECT id, tracking_code, status, target FROM appointment_requests WHERE id = ? LIMIT 1`,
    [body.id],
  );
  if (!existing) {
    return NextResponse.json({ error: "Appointment request not found." }, { status: 404 });
  }

  await executeSql(
    `UPDATE appointment_requests
     SET status = ?, staff_notes = COALESCE(?, staff_notes), updated_at = UTC_TIMESTAMP(3)
     WHERE id = ?`,
    [body.status, body.staffNotes !== undefined ? body.staffNotes.trim() : null, existing.id],
  );

  if (existing.status !== body.status) {
    await logAdminActivity({
      userId: user.id,
      actorName: user.name,
      action: "appointment.status_updated",
      entityType: "appointment",
      entityId: existing.tracking_code,
      details: `${existing.target} (${existing.tracking_code}): ${existing.status} → ${body.status}`,
    });
  }

  return NextResponse.json({ ok: true, status: body.status });
}
