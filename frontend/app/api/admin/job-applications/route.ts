import { NextResponse } from "next/server";
import { getAdminDatabase } from "@backend/lib/admin-db";
import { getSessionUser, hasPermission } from "@backend/lib/admin-auth";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "enquiries.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const downloadId = url.searchParams.get("download");
    const db = await getAdminDatabase();

    if (downloadId) {
      const application = await db.get(
        `SELECT application_id, cv_name, cv_type, cv_size, cv_data
         FROM job_applications WHERE application_id = ?`,
        [downloadId],
      ) as { application_id: string; cv_name: string; cv_type: string; cv_size: number; cv_data: Buffer } | undefined;
      if (!application) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
      const cvBytes = new Uint8Array(application.cv_data);
      return new NextResponse(cvBytes, {
        headers: {
          "Content-Type": application.cv_type,
          "Content-Length": String(application.cv_size),
          "Content-Disposition": `attachment; filename="${application.cv_name.replace(/["\r\n]/g, "_")}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const [applications, totals, statusRows, monthly, topJobs] = await Promise.all([
      db.all(
        `SELECT id, application_id, job_title, destination, full_name, phone, email,
                experience, notes, cv_name, cv_type, cv_size, status, created_at
         FROM job_applications
         ORDER BY created_at DESC
         LIMIT 500`,
      ),
      db.get(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS last30Days
         FROM job_applications`,
      ) as Promise<{ total: number; last30Days: number | null }>,
      db.all(
        "SELECT status, COUNT(*) AS count FROM job_applications GROUP BY status",
      ) as Promise<Array<{ status: string; count: number }>>,
      db.all(
        `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
         FROM job_applications
         WHERE date(created_at) >= date('now', 'start of month', '-5 months')
         GROUP BY strftime('%Y-%m', created_at)
         ORDER BY month`,
      ) as Promise<Array<{ month: string; count: number }>>,
      db.all(
        `SELECT job_title, destination, COUNT(*) AS count
         FROM job_applications
         GROUP BY job_title, destination
         ORDER BY count DESC, job_title
         LIMIT 5`,
      ) as Promise<Array<{ job_title: string; destination: string; count: number }>>,
    ]);

    return NextResponse.json({
      applications,
      analytics: {
        total: totals.total,
        last30Days: totals.last30Days || 0,
        byStatus: Object.fromEntries(statusRows.map((row) => [row.status, row.count])),
        monthly,
        topJobs,
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
  const body = await request.json().catch(() => null) as { id?: number; status?: string } | null;
  const statuses = new Set(["New", "Reviewed", "Shortlisted", "Rejected"]);
  if (!body || !Number.isSafeInteger(body.id) || !body.status || !statuses.has(body.status)) {
    return NextResponse.json({ error: "Choose a valid application and status." }, { status: 400 });
  }
  const db = await getAdminDatabase();
  const application = await db.get("SELECT id, job_title FROM job_applications WHERE id = ?", [body.id]) as { id: number; job_title: string } | undefined;
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  await db.run(
    "UPDATE job_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [body.status, application.id],
  );
  return NextResponse.json({ ok: true, status: body.status });
}
