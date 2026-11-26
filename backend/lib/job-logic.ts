import type { RowDataPacket } from "./postgres";
import { withTransaction } from "./postgres";
import { logAdminActivity } from "./admin-auth";

export async function updateJobApplicationStatusWithSlotSync(params: {
  applicationDbId: number;
  nextStatus: "New" | "Reviewed" | "Shortlisted" | "Visa Processing" | "Placed" | "Rejected";
  staffNote?: string;
  staffId: number;
  staffName: string;
}) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, tracking_code, job_id, full_name, status, staff_notes
       FROM job_applications
       WHERE id = ?
       FOR UPDATE`,
      [params.applicationDbId],
    );
    const app = rows[0];
    if (!app) throw new Error("Application not found.");

    const previousStatus = app.status as string;
    if (app.job_id) {
      const [jobRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, openings_total, openings_filled, status FROM jobs WHERE id = ? FOR UPDATE`,
        [app.job_id],
      );
      const job = jobRows[0];
      if (job) {
        if (previousStatus !== "Placed" && params.nextStatus === "Placed") {
          if (Number(job.openings_filled) >= Number(job.openings_total)) {
            throw new Error("All openings for this job are already filled.");
          }
          const nextFilled = Number(job.openings_filled) + 1;
          const nextJobStatus = nextFilled >= Number(job.openings_total) ? "Closed" : job.status;
          await conn.execute(
            `UPDATE jobs SET openings_filled = ?, status = ? WHERE id = ?`,
            [nextFilled, nextJobStatus, job.id],
          );
        } else if (previousStatus === "Placed" && params.nextStatus !== "Placed") {
          const nextFilled = Math.max(0, Number(job.openings_filled) - 1);
          const nextJobStatus = job.status === "Closed" && nextFilled < Number(job.openings_total) ? "Published" : job.status;
          await conn.execute(
            `UPDATE jobs SET openings_filled = ?, status = ? WHERE id = ?`,
            [nextFilled, nextJobStatus, job.id],
          );
        }
      }
    }

    const updatedNote = params.staffNote !== undefined ? params.staffNote.trim() : (app.staff_notes || "");
    await conn.execute(
      `UPDATE job_applications
       SET status = ?, staff_notes = ?, reviewed_by = ?, updated_at = UTC_TIMESTAMP(3)
       WHERE id = ?`,
      [params.nextStatus, updatedNote, params.staffId, app.id],
    );

    const eventNote = params.staffNote?.trim()
      ? params.staffNote.trim()
      : `Application moved to ${params.nextStatus}`;
    await conn.execute(
      `INSERT INTO job_application_events (job_application_id, status, note, updated_by_name)
       VALUES (?, ?, ?, ?)`,
      [app.id, params.nextStatus, eventNote.slice(0, 500), params.staffName],
    );

    await logAdminActivity({
      userId: params.staffId,
      actorName: params.staffName,
      action: "application.status_changed",
      entityType: "job_application",
      entityId: app.tracking_code,
      details: `${app.full_name} (${app.tracking_code}): ${previousStatus} → ${params.nextStatus}`,
    });

    return { ok: true, status: params.nextStatus, trackingCode: app.tracking_code as string };
  });
}
