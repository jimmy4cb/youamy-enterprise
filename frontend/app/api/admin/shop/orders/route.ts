import { NextResponse } from "next/server";
import { getSessionUser, hasPermission } from "@backend/lib/admin-auth";
import { getAdminDatabase } from "@backend/lib/admin-db";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";
import { notifyClientOrderUpdate } from "@backend/lib/order-notifications";

const orderStatuses = ["Confirmed", "In progress", "Completed", "Cancelled"] as const;

export async function GET() {
  const staff = await getSessionUser();
  if (!staff || !hasPermission(staff.role, "orders.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("orders")
    .select("id,order_number,status,payment_status,total_amount,currency,created_at,cancel_requested_at,profiles(full_name,phone)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load orders." }, { status: 500 });
  const orders = data.map((order) => {
    if (staff.role === "super_admin") return order;
    const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
    return {
      ...order,
      profiles: profile ? { ...profile, phone: profile.phone ? `•••• ${profile.phone.slice(-4)}` : "" } : null,
    };
  });
  return NextResponse.json({ orders });
}

export async function PATCH(request: Request) {
  const staff = await getSessionUser();
  if (!staff || !hasPermission(staff.role, "orders.edit")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const body = await request.json() as { orderId?: string; status?: string };
  if (!body.orderId || !orderStatuses.includes(body.status as typeof orderStatuses[number])) {
    return NextResponse.json({ error: "Choose a valid order status." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const status = body.status as typeof orderStatuses[number];
  const { data: transition, error: updateError } = await admin.rpc("update_client_order_status", {
    p_order_id: body.orderId,
    p_status: status,
    p_staff_name: staff.name,
  });
  if (updateError) {
    const notFound = updateError.message.includes("Order not found");
    return NextResponse.json({ error: updateError.message }, { status: notFound ? 404 : 409 });
  }
  const order = transition?.[0];
  if (!order) return NextResponse.json({ error: "Order status update failed." }, { status: 500 });

  const db = await getAdminDatabase();
  await db.run(
    "INSERT INTO activity_log (user_id, action, details) VALUES (?, 'order.status_changed', ?)",
    [staff.id, `${order.order_number}: ${status}`],
  );
  await notifyClientOrderUpdate(admin, body.orderId, order.alert_message, `Order ${order.order_number} update`);
  return NextResponse.json({ ok: true });
}
