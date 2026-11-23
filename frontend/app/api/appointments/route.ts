import { NextResponse } from "next/server";
import { getAdminDatabase } from "@backend/lib/admin-db";
import {
  emailAppointmentToTeam,
  type AppointmentEmailResult,
} from "@backend/lib/appointment-notifications";

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedServices = [
  "vehicle_inspection",
  "property_viewing",
  "sanitation_service",
] as const;
const allowedTimes = new Set(["09:00", "10:30", "12:00", "14:00", "15:30"]);

function nairobiDateTime() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}

function isValidDate(value: string) {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    requestId?: string;
    serviceType?: string;
    target?: string;
    clientName?: string;
    clientPhone?: string;
    preferredDate?: string;
    preferredTime?: string;
    location?: string;
    locationLatitude?: number | null;
    locationLongitude?: number | null;
    notes?: string;
  } | null;

  if (!body || typeof body.requestId !== "string" || !requestIdPattern.test(body.requestId)) {
    return NextResponse.json({ error: "A valid appointment request is required." }, { status: 400 });
  }
  if (typeof body.serviceType !== "string" ||
      !allowedServices.includes(body.serviceType as typeof allowedServices[number])) {
    return NextResponse.json({ error: "Choose a valid service." }, { status: 400 });
  }
  if ([body.target, body.clientName, body.clientPhone, body.preferredDate, body.preferredTime]
    .some((value) => typeof value !== "string") ||
    (body.location !== undefined && typeof body.location !== "string") ||
    (body.locationLatitude !== undefined && body.locationLatitude !== null && typeof body.locationLatitude !== "number") ||
    (body.locationLongitude !== undefined && body.locationLongitude !== null && typeof body.locationLongitude !== "number") ||
    (body.notes !== undefined && typeof body.notes !== "string")) {
    return NextResponse.json({ error: "Complete the required appointment details." }, { status: 400 });
  }

  const target = body.target!.trim();
  const clientName = body.clientName!.trim();
  const phone = body.clientPhone!.trim();
  const phoneDigits = phone.replace(/\D/g, "");
  const preferredDate = body.preferredDate!;
  const preferredTime = body.preferredTime!;
  const location = body.location?.trim() || "";
  const locationLatitude = body.locationLatitude ?? null;
  const locationLongitude = body.locationLongitude ?? null;
  const notes = body.notes?.trim() || "";

  if (!target || target.length > 180 || !clientName || clientName.length > 120) {
    return NextResponse.json({ error: "Enter a valid name and service or listing." }, { status: 400 });
  }
  if (!/^\+?[\d() -]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    return NextResponse.json({ error: "Enter a valid phone or WhatsApp number." }, { status: 400 });
  }
  if (!isValidDate(preferredDate) || preferredDate < nairobiDateTime().date) {
    return NextResponse.json({ error: "Choose today or a future date." }, { status: 400 });
  }
  if (!allowedTimes.has(preferredTime)) {
    return NextResponse.json({ error: "Choose one of the available request times." }, { status: 400 });
  }
  if (preferredDate === nairobiDateTime().date && preferredTime <= nairobiDateTime().time) {
    return NextResponse.json({ error: "Choose a later time or another date." }, { status: 400 });
  }
  if (location.length > 180 || notes.length > 2000) {
    return NextResponse.json({ error: "Location or notes are too long." }, { status: 400 });
  }
  if (body.serviceType === "sanitation_service" && !location) {
    return NextResponse.json({ error: "Enter the service location." }, { status: 400 });
  }
  if ((locationLatitude === null) !== (locationLongitude === null) ||
      (locationLatitude !== null && (!Number.isFinite(locationLatitude) || locationLatitude < -90 || locationLatitude > 90)) ||
      (locationLongitude !== null && (!Number.isFinite(locationLongitude) || locationLongitude < -180 || locationLongitude > 180))) {
    return NextResponse.json({ error: "Choose a valid map location." }, { status: 400 });
  }
  if (body.serviceType === "sanitation_service" && (locationLatitude === null || locationLongitude === null)) {
    return NextResponse.json({ error: "Pin the service location on the map." }, { status: 400 });
  }

  try {
    const db = await getAdminDatabase();
    await db.run(
      `INSERT OR IGNORE INTO appointment_requests
       (request_id, service_type, target, client_name, client_phone, preferred_date,
        preferred_time, location, location_latitude, location_longitude, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.requestId,
        body.serviceType,
        target,
        clientName,
        phone,
        preferredDate,
        preferredTime,
        location,
        locationLatitude,
        locationLongitude,
        notes,
      ],
    );
    const insertResult = await db.get("SELECT changes() AS count") as { count: number };
    const inserted = insertResult.count > 0;
    const appointment = await db.get(
      "SELECT * FROM appointment_requests WHERE request_id = ?",
      [body.requestId],
    ) as Parameters<typeof emailAppointmentToTeam>[0] & {
      notification_status: AppointmentEmailResult["status"] | "pending";
      notification_error: string | null;
    } | undefined;

    if (!appointment) {
      throw new Error("Appointment request was not persisted.");
    }

    let emailResult: AppointmentEmailResult = {
      status: appointment.notification_status === "pending"
        ? "not_configured"
        : appointment.notification_status,
      error: appointment.notification_error || undefined,
    };
    if (inserted) {
      try {
        emailResult = await emailAppointmentToTeam(appointment);
      } catch (error) {
        console.error("Appointment notification failed", error);
        emailResult = { status: "failed", error: "The email service could not be reached." };
      }
      await db.run(
        "UPDATE appointment_requests SET notification_status = ?, notification_error = ? WHERE id = ?",
        [emailResult.status, emailResult.error || null, appointment.id],
      );
    }

    return NextResponse.json({
      ok: true,
      id: appointment.id,
      emailSent: emailResult.status === "sent",
      notice: "Your appointment request is saved. Our team will contact you to confirm the time.",
    }, { status: inserted ? 201 : 200 });
  } catch (error) {
    console.error("Could not save appointment request", error);
    return NextResponse.json({ error: "Could not save this appointment request. Please try again." }, { status: 500 });
  }
}
