import { NextResponse } from "next/server";
import { getSessionUser } from "@backend/lib/admin-auth";
import { getAdminOverviewMetrics } from "@backend/lib/business-logic";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  try {
    const metrics = await getAdminOverviewMetrics();
    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("Failed to fetch admin overview:", error);
    return NextResponse.json({ error: "Could not load overview metrics." }, { status: 500 });
  }
}
