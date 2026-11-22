import { NextResponse } from "next/server";
import { getAdminDatabase } from "@backend/lib/admin-db";
import { getSessionUser, hasPermission } from "@backend/lib/admin-auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "listings.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const db = await getAdminDatabase();
  const listings = await db.all(
    "SELECT id, title, division, detail, status, archived, updated_at FROM admin_listings ORDER BY updated_at DESC",
  );
  return NextResponse.json({ listings });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "listings.edit")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as {
    title?: string;
    division?: string;
    detail?: string;
    status?: string;
  } | null;
  if (!body?.title?.trim() || !body.division || !body.detail?.trim()) {
    return NextResponse.json({ error: "Title, division and detail are required." }, { status: 400 });
  }
  const db = await getAdminDatabase();
  const result = await db.run(
    "INSERT INTO admin_listings (title, division, detail, status, created_by) VALUES (?, ?, ?, ?, ?)",
    [body.title.trim(), body.division, body.detail.trim(), body.status === "Published" ? "Published" : "Draft", user.id],
  );
  await db.run(
    "INSERT INTO activity_log (user_id, action, details) VALUES (?, 'listing.created', ?)",
    [user.id, body.title.trim()],
  );
  return NextResponse.json({ id: result.lastID });
}
