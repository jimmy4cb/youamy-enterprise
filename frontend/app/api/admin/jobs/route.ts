import { NextResponse } from "next/server";
import crypto from "node:crypto";
import type { RowDataPacket } from "@backend/lib/postgres";
import { getSessionUser, hasPermission, logAdminActivity } from "@backend/lib/admin-auth";
import { executeSql, queryRows } from "@backend/lib/postgres";

export const dynamic = "force-dynamic";

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "job"}-${crypto.randomBytes(3).toString("hex")}`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "listings.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const jobs = await queryRows<RowDataPacket>(
    `SELECT j.*,
            (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id) AS applications_count
     FROM jobs j
     ORDER BY j.status = 'Published' DESC, j.deadline ASC, j.id DESC`,
  );

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      ...j,
      id: Number(j.id),
      openings_total: Number(j.openings_total),
      openings_filled: Number(j.openings_filled),
      applications_count: Number(j.applications_count || 0),
      deadline: String(j.deadline).slice(0, 10),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "listings.edit")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    title?: string;
    destination_country?: string;
    destination_city?: string;
    role_category?: string;
    employer_name?: string;
    openings_total?: number;
    compensation_display?: string;
    contract_months?: number;
    requirements?: string;
    benefits?: string;
    deadline?: string;
    status?: "Published" | "Draft" | "Closed";
  } | null;

  if (!body?.title?.trim() || !body.destination_country?.trim() || !body.destination_city?.trim() ||
      !body.role_category?.trim() || !body.compensation_display?.trim() || !body.deadline) {
    return NextResponse.json({ error: "Fill in title, country, city, role category, compensation, and deadline." }, { status: 400 });
  }

  const openingsTotal = Math.max(1, Math.min(500, Math.trunc(Number(body.openings_total || 10))));
  const contractMonths = Math.max(3, Math.min(60, Math.trunc(Number(body.contract_months || 24))));
  const status = ["Published", "Draft", "Closed"].includes(body.status || "") ? body.status! : "Published";

  const result = await executeSql(
    `INSERT INTO jobs (
       slug, title, destination_country, destination_city, role_category, employer_name,
       openings_total, openings_filled, compensation_display, contract_months,
       requirements, benefits, deadline, status, featured, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      slugify(body.title),
      body.title.trim(),
      body.destination_country.trim(),
      body.destination_city.trim(),
      body.role_category.trim(),
      (body.employer_name || "Verified GCC Partner").trim(),
      openingsTotal,
      body.compensation_display.trim(),
      contractMonths,
      (body.requirements || "Valid passport, clean background check, and relevant experience.").trim(),
      (body.benefits || "Contract benefits, accommodation, and visa guidance.").trim(),
      body.deadline,
      status,
      user.id,
    ],
  );

  await logAdminActivity({
    userId: user.id,
    actorName: user.name,
    action: "job.created",
    entityType: "job",
    entityId: result.insertId,
    details: `Created job: ${body.title.trim()} (${body.destination_country.trim()})`,
  });

  return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "listings.edit")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    id?: number;
    title?: string;
    destination_country?: string;
    destination_city?: string;
    role_category?: string;
    employer_name?: string;
    openings_total?: number;
    compensation_display?: string;
    requirements?: string;
    benefits?: string;
    deadline?: string;
    status?: "Published" | "Draft" | "Closed" | "Archived";
  } | null;

  if (!body?.id || !Number.isSafeInteger(body.id)) {
    return NextResponse.json({ error: "Valid job ID is required." }, { status: 400 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.title?.trim()) { updates.push("title = ?"); params.push(body.title.trim()); }
  if (body.destination_country?.trim()) { updates.push("destination_country = ?"); params.push(body.destination_country.trim()); }
  if (body.destination_city?.trim()) { updates.push("destination_city = ?"); params.push(body.destination_city.trim()); }
  if (body.role_category?.trim()) { updates.push("role_category = ?"); params.push(body.role_category.trim()); }
  if (body.employer_name?.trim()) { updates.push("employer_name = ?"); params.push(body.employer_name.trim()); }
  if (body.openings_total !== undefined) {
    updates.push("openings_total = ?");
    params.push(Math.max(1, Math.trunc(Number(body.openings_total))));
  }
  if (body.compensation_display?.trim()) { updates.push("compensation_display = ?"); params.push(body.compensation_display.trim()); }
  if (body.requirements !== undefined) { updates.push("requirements = ?"); params.push(body.requirements.trim()); }
  if (body.benefits !== undefined) { updates.push("benefits = ?"); params.push(body.benefits.trim()); }
  if (body.deadline) { updates.push("deadline = ?"); params.push(body.deadline); }
  if (body.status && ["Published", "Draft", "Closed", "Archived"].includes(body.status)) {
    updates.push("status = ?");
    params.push(body.status);
  }

  if (!updates.length) {
    return NextResponse.json({ error: "No updates supplied." }, { status: 400 });
  }

  params.push(body.id);
  await executeSql(`UPDATE jobs SET ${updates.join(", ")} WHERE id = ?`, params);

  await logAdminActivity({
    userId: user.id,
    actorName: user.name,
    action: "job.updated",
    entityType: "job",
    entityId: body.id,
    details: `Updated job #${body.id}${body.status ? ` (status: ${body.status})` : ""}`,
  });

  return NextResponse.json({ ok: true });
}
