import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { getSessionUser, hasPermission, logAdminActivity } from "@backend/lib/admin-auth";
import { generateTrackingCode } from "@backend/lib/business-logic";
import { emailInquiryToTeam } from "@backend/lib/inquiry-notifications";
import { executeSql, queryOne, queryRows } from "@backend/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const [listings, inquiries] = await Promise.all([
      queryRows<RowDataPacket>(
        `SELECT id, title, division, location, amount_kes, price_unit
         FROM products
         WHERE status NOT IN ('draft', 'archived') AND division IN ('Vehicles', 'Real Estate')
         ORDER BY division ASC, title ASC`,
      ),
      queryRows<RowDataPacket>(
        `SELECT id, inquiry_id, tracking_code, source, listing_id, listing_title, division, inquiry_type,
                full_name, email, phone, subject, message, status, staff_notes,
                notification_status, notification_error, created_at
         FROM inquiries
         ORDER BY created_at DESC, id DESC
         LIMIT 200`,
      ),
    ]);

    return NextResponse.json({
      listings: listings.map((l) => ({
        id: l.id,
        title: l.title,
        division: l.division,
        detail: `${l.location} · KES ${Number(l.amount_kes).toLocaleString("en-KE")}`,
      })),
      inquiries: inquiries.map((i) => ({
        ...i,
        id: Number(i.id),
      })),
    });
  } catch (error) {
    console.error("Could not load inquiries:", error);
    return NextResponse.json({ error: "Could not load inquiry records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.create")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    listingId?: string;
    inquiryType?: string;
    clientName?: string;
    clientPhone?: string;
    email?: string;
    questions?: string;
  } | null;

  if (!body?.listingId || !body.inquiryType || !body.clientPhone?.trim()) {
    return NextResponse.json({ error: "Listing, inquiry type, and phone number are required." }, { status: 400 });
  }

  const listing = await queryOne<RowDataPacket>(
    `SELECT id, title, division FROM products WHERE id = ? LIMIT 1`,
    [body.listingId],
  );
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const trackingCode = generateTrackingCode("INQ");
  const res = await executeSql(
    `INSERT INTO inquiries (
       inquiry_id, tracking_code, source, listing_id, listing_title, division, inquiry_type,
       full_name, email, phone, subject, message, status, assigned_to
     ) VALUES (?, ?, 'admin_manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?)`,
    [
      randomUUID(),
      trackingCode,
      listing.id,
      listing.title,
      listing.division,
      body.inquiryType,
      (body.clientName || "").trim(),
      (body.email || "").trim(),
      body.clientPhone.trim(),
      listing.title,
      (body.questions || "").trim() || "Recorded by staff",
      user.id,
    ],
  );

  const saved = await queryOne<RowDataPacket>(`SELECT * FROM inquiries WHERE id = ?`, [res.insertId]);
  if (saved) {
    const emailRes = await emailInquiryToTeam({
      id: Number(saved.id),
      tracking_code: saved.tracking_code,
      listing_title: saved.listing_title,
      division: saved.division,
      inquiry_type: saved.inquiry_type,
      full_name: saved.full_name,
      phone: saved.phone,
      email: saved.email,
      message: saved.message,
      created_at: saved.created_at,
    });
    await executeSql(
      `UPDATE inquiries SET notification_status = ?, notification_error = ? WHERE id = ?`,
      [emailRes.status, emailRes.error || null, saved.id],
    );
  }

  await logAdminActivity({
    userId: user.id,
    actorName: user.name,
    action: "inquiry.created",
    entityType: "inquiry",
    entityId: trackingCode,
    details: `Logged inquiry for ${listing.title}`,
  });

  return NextResponse.json({ ok: true, id: res.insertId, trackingCode, notice: `Inquiry saved (${trackingCode}).` }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.reply")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    id?: number;
    status?: "unread" | "in_progress" | "resolved" | "archived";
    staffNotes?: string;
  } | null;

  if (!body?.id || !Number.isSafeInteger(body.id) || !["unread", "in_progress", "resolved", "archived"].includes(body.status || "")) {
    return NextResponse.json({ error: "Valid inquiry ID and status are required." }, { status: 400 });
  }

  await executeSql(
    `UPDATE inquiries SET status = ?, staff_notes = COALESCE(?, staff_notes), assigned_to = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
    [body.status, body.staffNotes !== undefined ? body.staffNotes.trim() : null, user.id, body.id],
  );

  await logAdminActivity({
    userId: user.id,
    actorName: user.name,
    action: "inquiry.updated",
    entityType: "inquiry",
    entityId: body.id,
    details: `Inquiry #${body.id} marked ${body.status}`,
  });

  return NextResponse.json({ ok: true });
}
