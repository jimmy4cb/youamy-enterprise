import { NextResponse } from "next/server";
import crypto from "node:crypto";
import type { RowDataPacket } from "@backend/lib/postgres";
import { getCurrentCustomer } from "@backend/lib/customer-auth";
import { confirmOrderPayment, failOrderPayment } from "@backend/lib/business-logic";
import { notifyClientOrderUpdate } from "@backend/lib/order-notifications";
import { queryOne } from "@backend/lib/postgres";

export async function POST(request: Request) {
  const sandboxAllowed = process.env.PAYMENT_SANDBOX_MODE === "true" || !process.env.MPESA_CONSUMER_KEY;
  if (!sandboxAllowed) {
    return NextResponse.json({ error: "Sandbox simulation is disabled in live gateway mode." }, { status: 403 });
  }

  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    orderId?: string;
    outcome?: "success" | "paid" | "failed" | "cancelled";
  } | null;

  const normalizedOutcome = body?.outcome === "paid" ? "success" : body?.outcome;

  if (!body?.orderId || !["success", "failed", "cancelled"].includes(normalizedOutcome || "")) {
    return NextResponse.json({ error: "Provide orderId and outcome." }, { status: 400 });
  }

  const pending = await queryOne<RowDataPacket>(
    `SELECT p.reference, p.provider, p.amount, o.order_number
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.order_id = ? AND p.customer_id = ? AND p.status = 'pending'
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [body.orderId, customer.id],
  );
  if (!pending) {
    return NextResponse.json({ error: "No pending payment attempt found for this order." }, { status: 404 });
  }

  if (normalizedOutcome === "success") {
    const txId = `SBX-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const confirmed = await confirmOrderPayment({
      orderId: body.orderId,
      reference: pending.reference,
      provider: pending.provider,
      providerTransactionId: txId,
      amount: Number(pending.amount),
      metadata: { sandbox: true, simulatedAt: new Date().toISOString() },
    });
    if (confirmed) {
      await notifyClientOrderUpdate(
        body.orderId,
        `Your Youamy order ${pending.order_number} is placed. Payment verified.`,
        `Order ${pending.order_number} placed`,
      );
    }
    return NextResponse.json({ ok: true, status: "paid", transactionId: txId });
  }

  await failOrderPayment(pending.reference, body.outcome === "cancelled" ? "cancelled" : "failed", {
    sandbox: true,
    outcome: body.outcome,
  });
  return NextResponse.json({ ok: true, status: body.outcome });
}
