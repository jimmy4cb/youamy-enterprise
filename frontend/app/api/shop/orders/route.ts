import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@backend/lib/supabase/server";

export async function GET() {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("orders")
    .select("id,order_number,status,payment_status,total_amount,currency,created_at,order_items(title,quantity,unit_amount)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load orders." }, { status: 500 });
  return NextResponse.json({ orders: data });
}

export async function POST(request: Request) {
  try {
    const session = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before checkout." }, { status: 401 });

    const body = await request.json() as {
      checkoutKey?: string;
      items?: Array<{ product_id: string; quantity: number; booking_details?: Record<string, string> }>;
    };
    if (!body.checkoutKey || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Your cart is empty or invalid." }, { status: 400 });
    }
    if (body.items.length > 50) return NextResponse.json({ error: "Your cart has too many different items." }, { status: 400 });
    const productIds = body.items.map((item) => item.product_id);
    if (new Set(productIds).size !== productIds.length || productIds.some((id) => !id)) {
      return NextResponse.json({ error: "Cart items are invalid." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: products, error: productsError } = await admin.from("products")
      .select("id,booking_kind,status,purchasable")
      .in("id", productIds);
    if (productsError) throw productsError;
    const catalog = new Map((products || []).map((product) => [product.id, product]));
    for (const item of body.items) {
      const product = catalog.get(item.product_id);
      if (!product || !product.purchasable || product.status !== "available") {
        return NextResponse.json({ error: "A listing in your cart is no longer available. Review your cart." }, { status: 409 });
      }
      const details = item.booking_details || {};
      if (product.booking_kind === "short_stay") {
        const checkIn = Date.parse(`${details.check_in}T00:00:00Z`);
        const checkOut = Date.parse(`${details.check_out}T00:00:00Z`);
        if (!details.check_in || !details.check_out || !Number.isFinite(checkIn) || !Number.isFinite(checkOut) || checkOut <= checkIn) {
          return NextResponse.json({ error: "Choose a valid check-in and check-out date for every stay." }, { status: 400 });
        }
      }
      if (product.booking_kind === "car") {
        const pickup = Date.parse(details.pickup_at || "");
        const returnAt = Date.parse(details.return_at || "");
        if (!Number.isFinite(pickup) || !Number.isFinite(returnAt) || returnAt <= pickup) {
          return NextResponse.json({ error: "Choose a valid car pickup and return time." }, { status: 400 });
        }
      }
    }
    const { data, error } = await admin.rpc("create_checkout_order", {
      p_user_id: user.id,
      p_checkout_key: body.checkoutKey,
      p_items: body.items,
    });
    if (error) throw error;
    const order = data?.[0];
    if (!order) throw new Error("Order creation returned no order.");
    return NextResponse.json({ order });
  } catch (error) {
    console.error("Order creation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create the order." },
      { status: 400 },
    );
  }
}
