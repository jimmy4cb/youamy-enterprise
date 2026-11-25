import { NextResponse } from "next/server";
import { getSessionUser, listRecentActivity } from "@backend/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const activity = await listRecentActivity(150);
  return NextResponse.json({ activity });
}
