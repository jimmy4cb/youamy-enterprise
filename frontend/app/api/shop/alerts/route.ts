import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@backend/lib/supabase/server";

export async function GET() {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("client_alerts")
    .select("id,message,read_at,created_at,order_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load alerts." }, { status: 500 });
  return NextResponse.json({ alerts: data });
}

export async function PATCH(request: Request) {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json() as { alertId?: string };
  if (!body.alertId) return NextResponse.json({ error: "Alert ID is required." }, { status: 400 });
  const { error } = await session.rpc("mark_client_alert_read", { p_alert_id: body.alertId, p_user_id: user.id });
  if (error) return NextResponse.json({ error: "Could not update alert." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
