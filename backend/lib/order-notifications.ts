import type { RowDataPacket } from "@backend/lib/postgres";
import { queryOne } from "./postgres";

export async function notifyClientOrderUpdate(orderId: string, message: string, subject: string) {
  const order = await queryOne<RowDataPacket>(
    `SELECT o.order_number, o.total_amount, c.full_name, c.email, c.phone
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.id = ?
     LIMIT 1`,
    [orderId],
  );
  if (!order) return;

  const tasks: Promise<unknown>[] = [];
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (resendKey && from && order.email) {
    tasks.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [order.email], subject, text: message }),
    }));
  }
  if (resendKey && from && process.env.ORDERS_EMAIL) {
    tasks.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: process.env.ORDERS_EMAIL.split(",").map((a) => a.trim()).filter(Boolean),
        subject: `Youamy order ${order.order_number}`,
        text: `${message}\nClient: ${order.full_name || "Client"}`,
      }),
    }));
  }
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM && order.phone) {
    tasks.push(fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: process.env.TWILIO_FROM, To: order.phone, Body: message }),
      },
    ));
  }

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Order notification failed", result.reason);
    }
  });
}
