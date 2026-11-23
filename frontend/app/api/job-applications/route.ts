import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminDatabase } from "@backend/lib/admin-db";

const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const applicationId = randomUUID();
    const jobTitle = String(form.get("jobTitle") || "").trim();
    const destination = String(form.get("destination") || "").trim();
    const fullName = String(form.get("fullName") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const email = String(form.get("email") || "").trim();
    const experience = String(form.get("experience") || "").trim();
    const notes = String(form.get("notes") || "").trim();
    const cv = form.get("cv");

    if (!jobTitle || jobTitle.length > 180 || !destination || destination.length > 180) {
      return NextResponse.json({ error: "Choose a valid job listing." }, { status: 400 });
    }
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

    const cvData = Buffer.from(await cv.arrayBuffer());
    const db = await getAdminDatabase();
    await db.run(
      `INSERT INTO job_applications
       (application_id, job_title, destination, full_name, phone, email, experience, notes,
        cv_name, cv_type, cv_size, cv_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        applicationId,
        jobTitle,
        destination,
        fullName,
        phone,
        email,
        experience.slice(0, 2000),
        notes.slice(0, 2000),
        cv.name.slice(0, 255),
        cv.type,
        cv.size,
        cvData,
      ],
    );

    return NextResponse.json({
      ok: true,
      applicationId,
      notice: "Application submitted. Our recruitment team will contact you.",
    }, { status: 201 });
  } catch (error) {
    console.error("Could not submit job application", error);
    return NextResponse.json({ error: "Could not submit the application. Please try again." }, { status: 500 });
  }
}
