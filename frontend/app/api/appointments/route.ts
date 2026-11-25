import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { parseJsonValue, withTransaction } from "@backend/lib/mysql";
import { calculateSanitationQuote, generateTrackingCode } from "@backend/lib/business-logic";
import { emailAppointmentToTeam, type AppointmentEmailResult } from "@backend/lib/appointment-notifications";

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedServices = ["vehicle_inspection", "property_viewing", "sanitation_service"] as const;
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
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
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
    productId?: string | null;
    target?: string;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    preferredDate?: string;
    preferredTime?: string;
    location?: string;
    locationLatitude?: number | null;
    locationLongitude?: number | null;
    capacityTier?: "small" | "medium" | "large";
    frequency?: "one_off" | "weekly" | "monthly";
    urgency?: "standard" | "emergency";
    serviceOptions?: { tankSize?: string; trips?: number; commercial?: boolean };
    notes?: string;
  } | null;

  if (!body || typeof body.requestId !== "string" || !requestIdPattern.test(body.requestId)) {
    return NextResponse.json({ error: "A valid appointment request ID is required." }, { status: 400 });
  }
  if (typeof body.serviceType !== "string" || !allowedServices.includes(body.serviceType as typeof allowedServices[number])) {
    return NextResponse.json({ error: "Choose a valid service." }, { status: 400 });
  }

  const target = (body.target || "").trim();
  const clientName = (body.clientName || "").trim();
  const phone = (body.clientPhone || "").trim();
  const email = (body.clientEmail || "").trim();
  const phoneDigits = phone.replace(/\D/g, "");
  const preferredDate = body.preferredDate || "";
  const preferredTime = body.preferredTime || "";
  const location = (body.location || "").trim();
  const locationLatitude = body.locationLatitude ?? null;
  const locationLongitude = body.locationLongitude ?? null;
  const notes = (body.notes || "").trim();

  if (!target || target.length > 180 || !clientName || clientName.length > 120) {
    return NextResponse.json({ error: "Enter a valid name and service or listing." }, { status: 400 });
  }
  if (!/^\+?[\d() -]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    return NextResponse.json({ error: "Enter a valid phone or WhatsApp number." }, { status: 400 });
  }
  const nowNairobi = nairobiDateTime();
  if (!isValidDate(preferredDate) || preferredDate < nowNairobi.date) {
    return NextResponse.json({ error: "Choose today or a future date." }, { status: 400 });
  }
  if (!allowedTimes.has(preferredTime)) {
    return NextResponse.json({ error: "Choose one of the available request times." }, { status: 400 });
  }
  if (preferredDate === nowNairobi.date && preferredTime <= nowNairobi.time) {
    return NextResponse.json({ error: "Choose a later time or another date." }, { status: 400 });
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

  let estimatedKes: number | null = null;
  let serviceOptionsJson: string | null = null;
  if (body.serviceType === "sanitation_service") {
    const tankSize = body.serviceOptions?.tankSize || "standard";
    const derivedTier: "small" | "medium" | "large" = body.capacityTier ||
      (tankSize === "10000L+" ? "large" : tankSize === "6000L" ? "medium" : "small");
    const trips = Math.max(1, Math.min(20, Number(body.serviceOptions?.trips || 1)));
    const commercial = Boolean(body.serviceOptions?.commercial);
    const quote = calculateSanitationQuote({
      serviceName: target,
      capacityTier: derivedTier,
      frequency: body.frequency || "one_off",
      urgency: body.urgency || "standard",
    });
    estimatedKes = quote.estimatedKes * trips + (commercial ? 3000 : 0);
    serviceOptionsJson = JSON.stringify({
      capacityTier: derivedTier,
      tankSize,
      trips,
      commercial,
      frequency: body.frequency || "one_off",
      urgency: body.urgency || "standard",
      breakdown: quote.breakdown,
    });
  }

  try {
    const outcome = await withTransaction(async (conn) => {
      const [existingRows] = await conn.query<RowDataPacket[]>(
        `SELECT * FROM appointment_requests WHERE request_id = ? LIMIT 1`,
        [body.requestId],
      );
      if (existingRows.length > 0) {
        return { inserted: false, appointment: existingRows[0] };
      }

      const [ruleRows] = await conn.query<RowDataPacket[]>(
        `SELECT setting_value FROM site_settings WHERE setting_key = 'business_rules' LIMIT 1`,
      );
      const rules = parseJsonValue<{ maxAppointmentsPerSlot?: number }>(ruleRows[0]?.setting_value, {});
      const maxSlots = Number(rules.maxAppointmentsPerSlot || 3);

      const [slotRows] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt
         FROM appointment_requests
         WHERE service_type = ? AND preferred_date = ? AND preferred_time = ? AND status <> 'Cancelled'
         FOR UPDATE`,
        [body.serviceType, preferredDate, preferredTime],
      );
      if (Number(slotRows[0]?.cnt || 0) >= maxSlots) {
        throw new Error(`The ${preferredTime} time slot on ${preferredDate} is fully booked. Please select another time.`);
      }

      const trackingCode = generateTrackingCode("APT");
      const [insertRes] = await conn.query<ResultSetHeader>(
        `INSERT INTO appointment_requests (
           request_id, tracking_code, service_type, product_id, target,
           client_name, client_phone, client_email, preferred_date, preferred_time,
           location, location_latitude, location_longitude, estimated_kes, service_options,
           notes, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Requested')`,
        [
          body.requestId,
          trackingCode,
          body.serviceType,
          body.productId || null,
          target,
          clientName,
          phone,
          email,
          preferredDate,
          preferredTime,
          location,
          locationLatitude,
          locationLongitude,
          estimatedKes,
          serviceOptionsJson,
          notes,
        ],
      );

      const [newRows] = await conn.query<RowDataPacket[]>(
        `SELECT * FROM appointment_requests WHERE id = ?`,
        [insertRes.insertId],
      );
      return { inserted: true, appointment: newRows[0] };
    });

    const apt = outcome.appointment;
    let emailResult: AppointmentEmailResult = { status: "not_configured" };
    if (outcome.inserted) {
      emailResult = await emailAppointmentToTeam({
        id: Number(apt.id),
        tracking_code: apt.tracking_code,
        service_type: apt.service_type,
        target: apt.target,
        client_name: apt.client_name,
        client_phone: apt.client_phone,
        preferred_date: apt.preferred_date,
        preferred_time: apt.preferred_time,
        location: apt.location,
        estimated_kes: apt.estimated_kes ? Number(apt.estimated_kes) : null,
        notes: apt.notes || "",
        created_at: apt.created_at,
      });

      await withTransaction(async (conn) => {
        await conn.execute(
          `UPDATE appointment_requests SET notification_status = ?, notification_error = ? WHERE id = ?`,
          [emailResult.status, emailResult.error || null, apt.id],
        );
      });
    }

    return NextResponse.json({
      ok: true,
      id: Number(apt.id),
      trackingCode: apt.tracking_code,
      estimatedKes: apt.estimated_kes ? Number(apt.estimated_kes) : null,
      notice: `Appointment saved (${apt.tracking_code}). Our team will contact you to confirm.${apt.estimated_kes ? ` Estimated quote: KES ${Number(apt.estimated_kes).toLocaleString("en-KE")}.` : ""}`,
    }, { status: outcome.inserted ? 201 : 200 });
  } catch (error) {
    console.error("Could not save appointment request", error);
    const msg = error instanceof Error ? error.message : "Could not save this appointment request.";
    return NextResponse.json({ error: msg }, { status: msg.includes("fully booked") ? 409 : 500 });
  }
}
