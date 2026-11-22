import type { createSupabaseAdminClient } from "@backend/lib/supabase/server";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function notifyClientOrderUpdate(admin: AdminClient, orderId: string, message: string, subject: string) {
  const { data: order } = await admin.from("orders")
    .select("order_number,total_amount,user_id")
    .eq("id", orderId).single();
  if (!order) return;
  const [{ data: account }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(order.user_id),
    admin.from("profiles").select("full_name,phone").eq("id", order.user_id).single(),
  ]);
  const tasks: Promise<unknown>[] = [];
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (resendKey && from && account.user?.email) {
    tasks.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [account.user.email], subject, text: message }),
    }));
  }
  if (resendKey && from && process.env.ORDERS_EMAIL) {
    tasks.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: process.env.ORDERS_EMAIL.split(",").map((address) => address.trim()).filter(Boolean),
        subject: `Youamy order ${order.order_number}`,
        text: `${message}\nClient: ${profile?.full_name || "Client"}`,
      }),
    }));
  }
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM && profile?.phone) {
    tasks.push(fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: process.env.TWILIO_FROM, To: profile.phone, Body: message }),
      },
    ));
  }
  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "fulfilled" && result.value instanceof Response && !result.value.ok) {
      console.error("Order notification delivery failed", result.value.status);
    } else if (result.status === "rejected") {
      console.error("Order notification delivery failed", result.reason);
    }
  });
}
