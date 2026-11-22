import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@backend/lib/supabase/server";

export async function GET() {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const { data: cart, error: cartError } = await admin.from("carts").upsert(
    { user_id: user.id },
    { onConflict: "user_id" },
  ).select("id").single();
  if (cartError) return NextResponse.json({ error: "Could not load your saved cart." }, { status: 500 });
  const { data, error } = await admin.from("cart_items")
    .select("product_id,quantity,booking_details,products(id,title,division,image_urls,amount_kes,booking_kind,status)")
    .eq("cart_id", cart.id);
  if (error) return NextResponse.json({ error: "Could not load your saved cart." }, { status: 500 });
  const items = (data || []).flatMap((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    if (!product || product.status !== "available") return [];
    return [{
      product_id: row.product_id,
      quantity: row.quantity,
      booking_details: row.booking_details,
      ...product,
    }];
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json() as { items?: Array<{ product_id: string; quantity: number; booking_details?: object }> };
  if (!Array.isArray(body.items)) return NextResponse.json({ error: "Invalid cart." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: cart, error: cartError } = await admin.from("carts").upsert(
    { user_id: user.id },
    { onConflict: "user_id" },
  ).select("id").single();
  if (cartError) return NextResponse.json({ error: "Could not save your cart." }, { status: 500 });

  for (const item of body.items) {
    if (!item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) continue;
    const { data: existing } = await admin.from("cart_items")
      .select("quantity").eq("cart_id", cart.id).eq("product_id", item.product_id).maybeSingle();
    const { error } = await admin.from("cart_items").upsert({
      cart_id: cart.id,
      product_id: item.product_id,
      quantity: Math.max(existing?.quantity || 0, item.quantity),
      booking_details: item.booking_details || {},
    }, { onConflict: "cart_id,product_id" });
    if (error) return NextResponse.json({ error: "Some cart items could not be saved." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json() as { items?: Array<{ product_id: string; quantity: number; booking_details?: object }> };
  if (!Array.isArray(body.items) || body.items.length > 50) {
    return NextResponse.json({ error: "Invalid cart." }, { status: 400 });
  }
  if (body.items.some((item) => !item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
    return NextResponse.json({ error: "Cart item quantities are invalid." }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const { data: cart, error: cartError } = await admin.from("carts").upsert(
    { user_id: user.id },
    { onConflict: "user_id" },
  ).select("id").single();
  if (cartError) return NextResponse.json({ error: "Could not save your cart." }, { status: 500 });
  if (body.items.length) {
    const { error } = await admin.from("cart_items").upsert(body.items.map((item) => ({
      cart_id: cart.id,
      product_id: item.product_id,
      quantity: item.quantity,
      booking_details: item.booking_details || {},
    })), { onConflict: "cart_id,product_id" });
    if (error) return NextResponse.json({ error: "Could not update your cart." }, { status: 400 });
    const keptIds = body.items.map((item) => item.product_id);
    const { error: deleteError } = await admin.from("cart_items")
      .delete().eq("cart_id", cart.id).not("product_id", "in", `(${keptIds.join(",")})`);
    if (deleteError) return NextResponse.json({ error: "Could not remove old cart items." }, { status: 500 });
  } else {
    const { error } = await admin.from("cart_items").delete().eq("cart_id", cart.id);
    if (error) return NextResponse.json({ error: "Could not clear your cart." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
