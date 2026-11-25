import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { withTransaction } from "@backend/lib/mysql";
import { generateTrackingCode } from "@backend/lib/business-logic";

const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

function nairobiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const val = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value || "";
  return `${val("year")}-${val("month")}-${val("day")}`;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const applicationId = randomUUID();
    const jobIdRaw = form.get("jobId");
    const parsedJobId = jobIdRaw ? Number(jobIdRaw) : null;
    const jobTitleInput = String(form.get("jobTitle") || "").trim();
    const destinationInput = String(form.get("destination") || "").trim();
    const fullName = String(form.get("fullName") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const experience = String(form.get("experience") || "").trim();
    const notes = String(form.get("notes") || "").trim();
    const cv = form.get("cv");

    if (!fullName || fullName.length > 120) {
      return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (!/^\+?[\d() -]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!(cv instanceof File)) {
      return NextResponse.json({ error: "Attach your CV or resume." }, { status: 400 });
    }
    if (!allowedTypes.has(cv.type)) {
      return NextResponse.json({ error: "CV must be a PDF, Word document, JPG, or PNG file." }, { status: 400 });
    }
    if (cv.size < 1 || cv.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "CV must be between 1 byte and 5 MB." }, { status: 400 });
    }

    const cvBuffer = Buffer.from(await cv.arrayBuffer());
    const trackingCode = generateTrackingCode("APP");
    const today = nairobiToday();

    const result = await withTransaction(async (conn) => {
      let resolvedJobId: number | null = parsedJobId && Number.isSafeInteger(parsedJobId) ? parsedJobId : null;
      let finalJobTitle = jobTitleInput;
      let finalDestination = destinationInput;

      if (resolvedJobId) {
        const [jobRows] = await conn.query<RowDataPacket[]>(
          `SELECT id, title, destination_country, destination_city, openings_total, openings_filled, deadline, status
           FROM jobs WHERE id = ? FOR UPDATE`,
          [resolvedJobId],
        );
        const job = jobRows[0];
        if (!job || job.status !== "Published") {
          throw new Error("This job posting is no longer accepting applications.");
        }
        if (String(job.deadline).slice(0, 10) < today) {
          throw new Error("The application deadline for this role has passed.");
        }
        if (Number(job.openings_filled) >= Number(job.openings_total)) {
          throw new Error("All openings for this role have been filled.");
        }
        finalJobTitle = job.title;
        finalDestination = `${job.destination_country} · ${job.destination_city}`;
      } else if (!finalJobTitle || !finalDestination) {
        throw new Error("Choose a valid job listing.");
      }

      // Duplicate active application check
      const [dups] = await conn.query<RowDataPacket[]>(
        `SELECT tracking_code FROM job_applications
         WHERE job_title = ? AND phone = ? AND status NOT IN ('Rejected')
         LIMIT 1`,
        [finalJobTitle, phone],
      );
      if (dups.length > 0) {
        throw new Error(`You already have an active application for this role (Tracking code: ${dups[0].tracking_code}).`);
      }

      const [insertRes] = await conn.execute<ResultSetHeader>(
        `INSERT INTO job_applications (
           application_id, tracking_code, job_id, job_title, destination,
           full_name, phone, email, experience, notes,
           cv_name, cv_type, cv_size, cv_data, status, staff_notes
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?)`,
        [
          applicationId,
          trackingCode,
          resolvedJobId,
          finalJobTitle.slice(0, 180),
          finalDestination.slice(0, 180),
          fullName,
          phone,
          email,
          experience.slice(0, 2000),
          notes.slice(0, 2000),
          cv.name.slice(0, 255),
          cv.type,
          cv.size,
          cvBuffer.toString("base64"),
          "Application received and queued for recruiter screening.",
        ],
      );

      await conn.execute(
        `INSERT INTO job_application_events (job_application_id, status, note, updated_by_name)
         VALUES (?, 'New', 'Application submitted online with CV attachment.', 'System')`,
        [insertRes.insertId],
      );

      return { id: insertRes.insertId, trackingCode, jobTitle: finalJobTitle };
    });

    return NextResponse.json({
      ok: true,
      applicationId,
      trackingCode: result.trackingCode,
      notice: `Application submitted! Save your tracking code ${result.trackingCode} to check progress anytime.`,
    }, { status: 201 });
  } catch (error) {
    console.error("Could not submit job application", error);
    const msg = error instanceof Error ? error.message : "Could not submit the application.";
    const status = msg.includes("already") || msg.includes("deadline") || msg.includes("filled") || msg.includes("accepting") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
