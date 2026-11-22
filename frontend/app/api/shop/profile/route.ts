import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@backend/lib/supabase/server";

export async function GET() {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("profiles").select("full_name,phone").eq("id", user.id).single();
  if (error) return NextResponse.json({ error: "Could not load your profile." }, { status: 500 });
  return NextResponse.json({ profile: { ...data, email: user.email || "" } });
}

export async function PATCH(request: Request) {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json() as { full_name?: string; phone?: string };
  if (!body.full_name?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: "Name and phone number are required." }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("profiles").upsert({
    id: user.id,
    full_name: body.full_name.trim(),
    phone: body.phone.trim(),
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
