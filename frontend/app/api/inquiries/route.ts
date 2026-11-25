import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "@backend/lib/postgres";
import { executeSql, queryOne } from "@backend/lib/postgres";
import { generateTrackingCode } from "@backend/lib/business-logic";
import { emailInquiryToTeam } from "@backend/lib/inquiry-notifications";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    source?: "public_form" | "listing_inquiry";
    listingId?: string | null;
    listingTitle?: string;
    division?: string;
    inquiryType?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    subject?: string;
    message?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const fullName = (body.fullName || "").trim();
  const phone = (body.phone || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const division = (body.division || "General").trim();
  const inquiryType = (body.inquiryType || "General Inquiry").trim();
  const listingTitle = (body.listingTitle || "").trim();
  const subject = (body.subject || listingTitle || division).trim();
  const message = (body.message || "").trim();

  if (!fullName || fullName.length > 120) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }
  const digits = phone.replace(/\D/g, "");
  if (!phone || !/^\+?[\d() -]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!message || message.length > 3000) {
    return NextResponse.json({ error: "Enter your message or question (up to 3000 characters)." }, { status: 400 });
  }

  try {
    const inquiryId = randomUUID();
    const trackingCode = generateTrackingCode("INQ");
    const res = await executeSql(
      `INSERT INTO inquiries (
         inquiry_id, tracking_code, source, listing_id, listing_title, division, inquiry_type,
         full_name, email, phone, subject, message, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unread')`,
      [
        inquiryId,
        trackingCode,
        body.source === "listing_inquiry" ? "listing_inquiry" : "public_form",
        body.listingId || null,
        listingTitle.slice(0, 180),
        division.slice(0, 60),
        inquiryType.slice(0, 100),
        fullName,
        email,
        phone,
        subject.slice(0, 180),
        message,
      ],
    );

    const saved = await queryOne<RowDataPacket>(`SELECT * FROM inquiries WHERE id = ?`, [res.insertId]);
    if (saved) {
      const emailResult = await emailInquiryToTeam({
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
        [emailResult.status, emailResult.error || null, saved.id],
      );
    }

    return NextResponse.json({
      ok: true,
      trackingCode,
      notice: `Enquiry received (Ref: ${trackingCode}). Our team will follow up shortly.`,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to store inquiry:", error);
    return NextResponse.json({ error: "Could not send enquiry. Please try again." }, { status: 500 });
  }
}
