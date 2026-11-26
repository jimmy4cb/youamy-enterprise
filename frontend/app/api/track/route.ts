import { NextResponse } from "next/server";
import type { RowDataPacket } from "@backend/lib/postgres";
import { parseJsonValue, queryOne, queryRows } from "@backend/lib/postgres";

export const dynamic = "force-dynamic";

type NormalizedResult = {
  kind: "job_application" | "appointment" | "inquiry" | "order";
  trackingCode: string;
  title: string;
  subtitle: string;
  status: string;
  detail?: string;
  submittedAt: string;
  timeline?: Array<{ status: string; note: string; createdAt: string }>;
};

function canonicalPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("254")) return digits.slice(3);
  if (digits.length === 10 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function phoneContactMatches(contact: string, phone: string): boolean {
  const contactDigits = canonicalPhoneDigits(contact);
  const phoneDigits = canonicalPhoneDigits(phone);
  return contactDigits.length >= 9 && contactDigits === phoneDigits;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").trim().toUpperCase();
  const contact = (url.searchParams.get("contact") || "").trim();

  if (!code && !contact) {
    return NextResponse.json({ error: "Enter a tracking reference code or phone/email." }, { status: 400 });
  }
  if (code && !contact) {
    return NextResponse.json({ error: "Enter the phone number or email used for this request to verify the tracking code." }, { status: 400 });
  }

  try {
    const results: NormalizedResult[] = [];
    let primaryKind: string | undefined;
    let primaryRecord: unknown;

    if (code.startsWith("YEL-APP-")) {
      const app = await queryOne<RowDataPacket>(
        `SELECT id, application_id, tracking_code, job_title, destination, full_name, phone, email,
                status, staff_notes, created_at, updated_at
         FROM job_applications
         WHERE tracking_code = ?
         LIMIT 1`,
        [code],
      );
      if (!app) {
        return NextResponse.json({ error: "No job application found with that tracking code." }, { status: 404 });
      }
      if (contact) {
        const matchesPhone = phoneContactMatches(contact, String(app.phone || ""));
        const matchesEmail = contact.toLowerCase() === String(app.email || "").toLowerCase();
        if (!matchesPhone && !matchesEmail) {
          return NextResponse.json({ error: "Phone number or email does not match this tracking code." }, { status: 403 });
        }
      }

      const events = await queryRows<RowDataPacket>(
        `SELECT status, note, updated_by_name, created_at
         FROM job_application_events
         WHERE job_application_id = ?
         ORDER BY created_at ASC, id ASC`,
        [app.id],
      );

      primaryKind = "job_application";
      primaryRecord = {
        tracking_code: app.tracking_code,
        title: app.job_title,
        subtitle: app.destination,
        applicant_name: app.full_name,
        status: app.status,
        staff_notes: app.staff_notes || "",
        created_at: app.created_at,
        updated_at: app.updated_at,
        events,
      };
      results.push({
        kind: "job_application",
        trackingCode: app.tracking_code,
        title: `${app.job_title} (${app.full_name})`,
        subtitle: app.destination,
        status: app.status,
        detail: app.staff_notes || undefined,
        submittedAt: String(app.created_at),
        timeline: events.map((e) => ({
          status: e.status,
          note: e.note || "",
          createdAt: String(e.created_at),
        })),
      });
    } else if (code.startsWith("YEL-APT-")) {
      const apt = await queryOne<RowDataPacket>(
        `SELECT tracking_code, service_type, target, client_name, client_phone, client_email, preferred_date,
                preferred_time, location, estimated_kes, service_options, status, staff_notes, created_at, updated_at
         FROM appointment_requests
         WHERE tracking_code = ?
         LIMIT 1`,
        [code],
      );
      if (!apt) {
        return NextResponse.json({ error: "No appointment or sanitation dispatch found with that code." }, { status: 404 });
      }
      if (contact) {
        const matchesPhone = phoneContactMatches(contact, String(apt.client_phone || ""));
        const matchesEmail = contact.toLowerCase() === String(apt.client_email || "").toLowerCase();
        if (!matchesPhone && !matchesEmail) {
          return NextResponse.json({ error: "Phone number or email does not match this tracking code." }, { status: 403 });
        }
      }

      primaryKind = "appointment";
      primaryRecord = {
        tracking_code: apt.tracking_code,
        service_type: apt.service_type,
        title: apt.target,
        client_name: apt.client_name,
        preferred_date: String(apt.preferred_date).slice(0, 10),
        preferred_time: apt.preferred_time,
        location: apt.location,
        estimated_kes: apt.estimated_kes ? Number(apt.estimated_kes) : null,
        service_options: parseJsonValue(apt.service_options, null),
        status: apt.status,
        staff_notes: apt.staff_notes || "",
        created_at: apt.created_at,
        updated_at: apt.updated_at,
      };
      results.push({
        kind: "appointment",
        trackingCode: apt.tracking_code,
        title: apt.target,
        subtitle: `${String(apt.preferred_date).slice(0, 10)} at ${apt.preferred_time} · ${apt.location || "Kenya"}`,
        status: apt.status,
        detail: apt.estimated_kes ? `Estimated: KES ${Number(apt.estimated_kes).toLocaleString("en-KE")}` : apt.staff_notes || undefined,
        submittedAt: String(apt.created_at),
      });
    } else if (code.startsWith("YEL-INQ-")) {
      const inq = await queryOne<RowDataPacket>(
        `SELECT tracking_code, division, inquiry_type, listing_title, subject, full_name, phone, email, status, staff_notes, created_at, updated_at
         FROM inquiries WHERE tracking_code = ? LIMIT 1`,
        [code],
      );
      if (!inq) {
        return NextResponse.json({ error: "No enquiry found with that reference code." }, { status: 404 });
      }
      const matchesPhone = phoneContactMatches(contact, String(inq.phone || ""));
      const matchesEmail = contact.toLowerCase() === String(inq.email || "").toLowerCase();
      if (!matchesPhone && !matchesEmail) {
        return NextResponse.json({ error: "Phone number or email does not match this tracking code." }, { status: 403 });
      }
      primaryKind = "inquiry";
      primaryRecord = inq;
      results.push({
        kind: "inquiry",
        trackingCode: inq.tracking_code,
        title: inq.listing_title || inq.subject || inq.inquiry_type,
        subtitle: `${inq.division} · ${inq.inquiry_type}`,
        status: inq.status,
        detail: inq.staff_notes || undefined,
        submittedAt: String(inq.created_at),
      });
    } else if (code.startsWith("YEL-")) {
      // Order lookup by order_number e.g. YEL-2026-...
      const ord = await queryOne<RowDataPacket>(
        `SELECT o.id, o.order_number, o.status, o.payment_status, o.total_amount, o.created_at, c.phone, c.email
         FROM orders o JOIN customers c ON c.id = o.customer_id
         WHERE o.order_number = ? LIMIT 1`,
        [code],
      );
      if (!ord) {
        return NextResponse.json({ error: "No order or request found with that reference code." }, { status: 404 });
      }
      const matchesPhone = phoneContactMatches(contact, String(ord.phone || ""));
      const matchesEmail = contact.toLowerCase() === String(ord.email || "").toLowerCase();
      if (!matchesPhone && !matchesEmail) {
        return NextResponse.json({ error: "Phone number or email does not match this tracking code." }, { status: 403 });
      }
      const events = await queryRows<RowDataPacket>(
        `SELECT status, note, created_at FROM order_status_events WHERE order_id = ? ORDER BY created_at ASC`,
        [ord.id],
      );
      primaryKind = "order";
      primaryRecord = {
        order_number: ord.order_number,
        status: ord.status,
        payment_status: ord.payment_status,
        total_amount: Number(ord.total_amount),
        created_at: ord.created_at,
      };
      results.push({
        kind: "order",
        trackingCode: ord.order_number,
        title: `Order ${ord.order_number}`,
        subtitle: `Payment: ${ord.payment_status} · KES ${Number(ord.total_amount).toLocaleString("en-KE")}`,
        status: ord.status,
        submittedAt: String(ord.created_at),
        timeline: events.map((e) => ({ status: e.status, note: e.note || "", createdAt: String(e.created_at) })),
      });
    } else if (contact) {
      // Search recent requests matching phone suffix or exact email
      const digits = contact.replace(/\D/g, "");
      const suffix = digits.length >= 9 ? digits.slice(-9) : null;
      const emailLookup = contact.includes("@") ? contact.toLowerCase() : null;

      if (!suffix && !emailLookup) {
        return NextResponse.json({ error: "Enter at least 9 phone digits or a valid email address." }, { status: 400 });
      }

      const [apps, apts, inqs] = await Promise.all([
        queryRows<RowDataPacket>(
          `SELECT tracking_code, job_title, destination, full_name, status, created_at
           FROM job_applications
           WHERE (CAST(? AS text) IS NOT NULL AND RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ?)
              OR (CAST(? AS text) IS NOT NULL AND LOWER(email) = ?)
           ORDER BY created_at DESC LIMIT 5`,
          [suffix, suffix, emailLookup, emailLookup],
        ),
        queryRows<RowDataPacket>(
          `SELECT tracking_code, target, preferred_date, preferred_time, location, estimated_kes, status, created_at
           FROM appointment_requests
           WHERE (CAST(? AS text) IS NOT NULL AND RIGHT(regexp_replace(client_phone, '[^0-9]', '', 'g'), 9) = ?)
              OR (CAST(? AS text) IS NOT NULL AND LOWER(client_email) = ?)
           ORDER BY created_at DESC LIMIT 5`,
          [suffix, suffix, emailLookup, emailLookup],
        ),
        queryRows<RowDataPacket>(
          `SELECT tracking_code, division, inquiry_type, listing_title, subject, status, created_at
           FROM inquiries
           WHERE (CAST(? AS text) IS NOT NULL AND RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ?)
              OR (CAST(? AS text) IS NOT NULL AND LOWER(email) = ?)
           ORDER BY created_at DESC LIMIT 5`,
          [suffix, suffix, emailLookup, emailLookup],
        ),
      ]);

      for (const a of apps) {
        results.push({
          kind: "job_application",
          trackingCode: a.tracking_code,
          title: `${a.job_title} (${a.full_name})`,
          subtitle: a.destination,
          status: a.status,
          submittedAt: String(a.created_at),
        });
      }
      for (const a of apts) {
        results.push({
          kind: "appointment",
          trackingCode: a.tracking_code,
          title: a.target,
          subtitle: `${String(a.preferred_date).slice(0, 10)} at ${a.preferred_time}`,
          status: a.status,
          detail: a.estimated_kes ? `Est. KES ${Number(a.estimated_kes).toLocaleString("en-KE")}` : undefined,
          submittedAt: String(a.created_at),
        });
      }
      for (const i of inqs) {
        results.push({
          kind: "inquiry",
          trackingCode: i.tracking_code,
          title: i.listing_title || i.subject || i.inquiry_type,
          subtitle: `${i.division} · ${i.inquiry_type}`,
          status: i.status,
          submittedAt: String(i.created_at),
        });
      }
    } else {
      return NextResponse.json({ error: "Unrecognized code format. Use YEL-APP-..., YEL-APT-..., YEL-INQ-..., or YEL-..." }, { status: 400 });
    }

    return NextResponse.json({
      kind: primaryKind,
      record: primaryRecord,
      results,
    });
  } catch (error) {
    console.error("Tracking lookup failed:", error);
    return NextResponse.json({ error: "Could not look up that reference." }, { status: 500 });
  }
}
