import { NextResponse } from "next/server";
import { getAdminDatabase } from "@backend/lib/admin-db";
import { getSessionUser, hasPermission } from "@backend/lib/admin-auth";
import { emailInquiryToTeam, type InquiryEmailResult } from "@backend/lib/inquiry-notifications";

const inquiryTypes = {
  Vehicles: ["Schedule Vehicle Inspection", "Vehicle Purchase Inquiry"],
  "Real Estate": ["Book Site Viewing", "Purchase / Payment Plan Inquiry", "Rental Terms Inquiry"],
} as const;

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const db = await getAdminDatabase();
    const [listings, inquiries] = await Promise.all([
      db.all(
        `SELECT id, title, division, detail FROM admin_listings
         WHERE archived = 0 AND status = 'Published' AND division IN ('Vehicles', 'Real Estate')
         ORDER BY division, title`,
      ),
      db.all(
        `SELECT id, listing_title, division, inquiry_type, client_name, client_phone,
                questions, status, notification_status, notification_error, created_at
         FROM listing_inquiries ORDER BY created_at DESC, id DESC LIMIT 50`,
      ),
    ]);
    return NextResponse.json({ listings, inquiries });
  } catch {
    return NextResponse.json({ error: "Could not load inquiry records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.create")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    requestId?: string;
    listingId?: number;
    inquiryType?: string;
    clientName?: string;
    clientPhone?: string;
    questions?: string;
  } | null;
  if (!body || typeof body.requestId !== "string" || !requestIdPattern.test(body.requestId)) {
    return NextResponse.json({ error: "A valid inquiry request is required." }, { status: 400 });
  }
  if (typeof body.listingId !== "number" || !Number.isSafeInteger(body.listingId) ||
      typeof body.inquiryType !== "string" || !body.inquiryType) {
    return NextResponse.json({ error: "Choose a listing and inquiry type." }, { status: 400 });
  }
  if ((body.clientName !== undefined && typeof body.clientName !== "string") ||
      (body.clientPhone !== undefined && typeof body.clientPhone !== "string") ||
      (body.questions !== undefined && typeof body.questions !== "string")) {
    return NextResponse.json({ error: "Inquiry details must be text." }, { status: 400 });
  }

  const phone = body.clientPhone?.trim() || "";
  const phoneDigits = phone.replace(/\D/g, "");
  if (!/^\+?[\d() -]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    return NextResponse.json({ error: "Enter a valid phone or WhatsApp number." }, { status: 400 });
  }
  const clientName = body.clientName?.trim() || "";
  if (clientName.length > 120 || body.questions?.length && body.questions.length > 2000) {
    return NextResponse.json({ error: "Name or questions are too long." }, { status: 400 });
  }

  try {
    const db = await getAdminDatabase();
    const listing = await db.get(
      `SELECT id, title, division FROM admin_listings
       WHERE id = ? AND archived = 0 AND status = 'Published'
       AND division IN ('Vehicles', 'Real Estate')`,
      [body.listingId],
    ) as { id: number; title: string; division: keyof typeof inquiryTypes } | undefined;
    if (!listing) {
      return NextResponse.json({ error: "That listing is no longer available for inquiries." }, { status: 404 });
    }

    const allowedTypes: readonly string[] = inquiryTypes[listing.division];
    if (!allowedTypes.includes(body.inquiryType)) {
      return NextResponse.json({ error: "Choose a valid inquiry type for this listing." }, { status: 400 });
    }
    if (listing.division === "Vehicles" && !clientName) {
      return NextResponse.json({ error: "Enter the client’s name for vehicle inquiries." }, { status: 400 });
    }

    await db.run(
      `INSERT OR IGNORE INTO listing_inquiries
       (submission_id, listing_id, listing_title, division, inquiry_type, client_name, client_phone, questions, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.requestId,
        listing.id,
        listing.title,
        listing.division,
        body.inquiryType,
        clientName,
        phone,
        body.questions?.trim() || "",
        user.id,
      ],
    );
    const inquiry = await db.get(
      "SELECT * FROM listing_inquiries WHERE submission_id = ?",
      [body.requestId],
    ) as Parameters<typeof emailInquiryToTeam>[0] & {
      notification_status: InquiryEmailResult["status"] | "pending";
      notification_error: string | null;
    };

    let emailResult: InquiryEmailResult = {
      status: inquiry.notification_status === "pending" ? "failed" : inquiry.notification_status,
      error: inquiry.notification_error || undefined,
    };
    if (inquiry.notification_status !== "sent") {
      try {
        emailResult = await emailInquiryToTeam(inquiry);
      } catch (error) {
        console.error("Inquiry email delivery failed", error);
        emailResult = { status: "failed", error: "The email service could not be reached." };
      }
      await db.run(
        "UPDATE listing_inquiries SET notification_status = ?, notification_error = ? WHERE id = ?",
        [emailResult.status, emailResult.error || null, inquiry.id],
      );
    }

    return NextResponse.json({
      ok: true,
      id: inquiry.id,
      emailSent: emailResult.status === "sent",
      notice: emailResult.status === "sent"
        ? "Inquiry saved and emailed to the site team."
        : "Inquiry saved, but the team email was not sent. Check the email configuration and inquiry status.",
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save this inquiry." }, { status: 500 });
  }
}
