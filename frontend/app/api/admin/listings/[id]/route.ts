import { NextResponse } from "next/server";
import { getAdminDatabase } from "@backend/lib/admin-db";
import { getSessionUser, hasPermission } from "@backend/lib/admin-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { status?: string; archived?: boolean } | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const db = await getAdminDatabase();
  if (typeof body.status === "string") {
    if (!hasPermission(user.role, "listings.status")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    await db.run(
      "UPDATE admin_listings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [body.status === "Published" ? "Published" : "Draft", id],
    );
    await db.run(
      "INSERT INTO activity_log (user_id, action, details) VALUES (?, 'listing.status_changed', ?)",
      [user.id, `Listing ${id}: ${body.status}`],
    );
  }
  if (typeof body.archived === "boolean") {
    if (!hasPermission(user.role, "listings.archive")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    await db.run(
      "UPDATE admin_listings SET archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [body.archived ? 1 : 0, id],
    );
    await db.run(
      "INSERT INTO activity_log (user_id, action, details) VALUES (?, 'listing.archived', ?)",
      [user.id, `Listing ${id}: ${body.archived ? "archived" : "restored"}`],
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Only a super admin can permanently delete listings." }, { status: 403 });
  }
  const { id } = await context.params;
  const db = await getAdminDatabase();
  await db.run("DELETE FROM admin_listings WHERE id = ? AND archived = 1", [id]);
  await db.run(
    "INSERT INTO activity_log (user_id, action, details) VALUES (?, 'listing.permanently_deleted', ?)",
    [user.id, `Listing ${id}`],
  );
  return NextResponse.json({ ok: true });
}
