import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@backend/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("orders")
    .select("id,order_number,status,payment_status,total_amount,currency,created_at,cancel_requested_at,order_items(title,quantity,unit_amount,booking_details),order_status_events(status,note,created_at),payments(provider,reference,status,provider_transaction_id)")
    .eq("id", id).eq("user_id", user.id).single();
  if (error || !data) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json({ order: data });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const admin = createSupabaseAdminClient();
  const { data: order, error } = await admin.from("orders")
    .select("id,status,payment_status,cancel_requested_at").eq("id", id).eq("user_id", user.id).single();
  if (error || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (["Completed", "Cancelled"].includes(order.status)) {
    return NextResponse.json({ error: "This order can no longer be cancelled." }, { status: 409 });
  }
  if (order.payment_status !== "paid") {
    return NextResponse.json({ error: "Only paid orders can be submitted for cancellation." }, { status: 409 });
  }
  if (order.cancel_requested_at) {
    return NextResponse.json({ error: "A cancellation request is already pending." }, { status: 409 });
  }
  const { error: updateError } = await admin.from("orders")
    .update({ cancel_requested_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id);
  if (updateError) return NextResponse.json({ error: "Could not request cancellation." }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Cancellation request sent to the Youamy team." });
}
