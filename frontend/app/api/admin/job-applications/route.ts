import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getSessionUser, hasPermission } from "@backend/lib/admin-auth";
import { updateJobApplicationStatusWithSlotSync } from "@backend/lib/business-logic";
import { queryOne, queryRows } from "@backend/lib/mysql";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = ["New", "Reviewed", "Shortlisted", "Visa Processing", "Placed", "Rejected"] as const;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const downloadId = url.searchParams.get("download");

    if (downloadId) {
      const app = await queryOne<RowDataPacket>(
        `SELECT application_id, cv_name, cv_type, cv_size, cv_data
         FROM job_applications WHERE application_id = ? LIMIT 1`,
        [downloadId],
      );
      if (!app) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
      const cvBytes = Buffer.from(app.cv_data, "base64");
      return new NextResponse(cvBytes, {
        headers: {
          "Content-Type": app.cv_type,
          "Content-Length": String(cvBytes.byteLength),
          "Content-Disposition": `attachment; filename="${String(app.cv_name).replace(/["\r\n]/g, "_")}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const [applications, totalRow, last30Row, statusRows, monthlyRows, topJobsRows] = await Promise.all([
      queryRows<RowDataPacket>(
        `SELECT id, application_id, tracking_code, job_id, job_title, destination, full_name, phone, email,
                experience, notes, cv_name, cv_type, cv_size, status, staff_notes, created_at, updated_at
         FROM job_applications
         ORDER BY created_at DESC
         LIMIT 500`,
      ),
      queryOne<RowDataPacket>(`SELECT COUNT(*) AS cnt FROM job_applications`),
      queryOne<RowDataPacket>(
        `SELECT COUNT(*) AS cnt FROM job_applications WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 30 DAY)`,
      ),
      queryRows<RowDataPacket>(
        `SELECT status, COUNT(*) AS cnt FROM job_applications GROUP BY status`,
      ),
      queryRows<RowDataPacket>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
         FROM job_applications
         WHERE created_at >= DATE_FORMAT(DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 MONTH), '%Y-%m-01')
         GROUP BY DATE_FORMAT(created_at, '%Y-%m')
         ORDER BY month ASC`,
      ),
      queryRows<RowDataPacket>(
        `SELECT job_title, destination, COUNT(*) AS count
         FROM job_applications
         GROUP BY job_title, destination
         ORDER BY count DESC, job_title ASC
         LIMIT 6`,
      ),
    ]);

    const byStatus: Record<string, number> = {
      New: 0,
      Reviewed: 0,
      Shortlisted: 0,
      "Visa Processing": 0,
      Placed: 0,
      Rejected: 0,
    };
    for (const row of statusRows) {
      byStatus[row.status] = Number(row.cnt);
    }

    return NextResponse.json({
      applications: applications.map((a) => ({
        ...a,
        id: Number(a.id),
        job_id: a.job_id ? Number(a.job_id) : null,
        cv_size: Number(a.cv_size),
      })),
      analytics: {
        total: Number(totalRow?.cnt || 0),
        last30Days: Number(last30Row?.cnt || 0),
        byStatus,
        monthly: monthlyRows.map((m) => ({ month: m.month, count: Number(m.count) })),
        topJobs: topJobsRows.map((j) => ({
          job_title: j.job_title,
          destination: j.destination,
          count: Number(j.count),
        })),
      },
    });
  } catch (error) {
    console.error("Could not load job applications", error);
    return NextResponse.json({ error: "Could not load job applications." }, { status: 500 });
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

  if (!body || !Number.isSafeInteger(body.id) || !body.status ||
      !ALLOWED_STATUSES.includes(body.status as typeof ALLOWED_STATUSES[number])) {
    return NextResponse.json({ error: "Choose a valid application and status." }, { status: 400 });
  }

  try {
    const result = await updateJobApplicationStatusWithSlotSync({
      applicationDbId: body.id!,
      nextStatus: body.status as typeof ALLOWED_STATUSES[number],
      staffNote: body.staffNotes,
      staffId: user.id,
      staffName: user.name,
    });
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not update application status.";
    return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 409 });
  }
}
