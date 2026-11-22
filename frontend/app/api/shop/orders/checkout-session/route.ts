import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@backend/lib/supabase/server";

export async function GET(request: Request) {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Checkout key is required." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: order, error } = await admin.from("orders")
    .select("id,payment_status,order_items(product_id)")
    .eq("user_id", user.id).eq("checkout_key", key).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not check the last checkout." }, { status: 500 });
  return NextResponse.json({
    paid: order?.payment_status === "paid",
    productIds: order?.payment_status === "paid" ? order.order_items.map((item) => item.product_id).filter(Boolean) : [],
  });
}
