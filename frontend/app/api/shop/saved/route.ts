import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@backend/lib/supabase/server";

export async function GET() {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("saved_items").select("product_id").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not load saved items." }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(request: Request) {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save items." }, { status: 401 });
  const { product_id } = await request.json() as { product_id?: string };
  if (!product_id) return NextResponse.json({ error: "Choose an item." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("saved_items").upsert({ user_id: user.id, product_id });
  if (error) return NextResponse.json({ error: "Could not save this item." }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const productId = new URL(request.url).searchParams.get("product_id");
  if (!productId) return NextResponse.json({ error: "Choose an item." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("saved_items").delete().eq("user_id", user.id).eq("product_id", productId);
  if (error) return NextResponse.json({ error: "Could not remove this item." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
