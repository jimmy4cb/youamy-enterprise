import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "@backend/lib/postgres";
import { confirmOrderPayment, failOrderPayment } from "@backend/lib/business-logic";
import { notifyClientOrderUpdate } from "@backend/lib/order-notifications";
import { queryOne } from "@backend/lib/postgres";

export async function POST(request: Request) {
  const secretHash = process.env.FLW_WEBHOOK_SECRET_HASH;
  const signature = request.headers.get("verif-hash");
  if (!secretHash || !signature || signature.length !== secretHash.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(secretHash))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  try {
    const body = await request.json() as { event?: string; data?: { id?: number; tx_ref?: string; status?: string } };
    const txRef = body.data?.tx_ref;
    const transactionId = body.data?.id;
    if (!txRef || !transactionId || !["charge.completed", "charge.failed"].includes(body.event || "")) {
      return NextResponse.json({ ok: true });
    }

    const payment = await queryOne<RowDataPacket>(
      `SELECT p.id, p.order_id, p.amount, p.reference, p.status, o.order_number
       FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.reference = ? LIMIT 1`,
      [txRef],
    );
    if (!payment) return NextResponse.json({ error: "Payment attempt not found." }, { status: 404 });

    const secret = process.env.FLW_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Verification not configured." }, { status: 503 });

    const verifyResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    const verified = await verifyResponse.json();
    const tx = verified.data;
    if (!verifyResponse.ok || verified.status !== "success" || !tx) {
      return NextResponse.json({ error: "Gateway verification unavailable." }, { status: 503 });
    }
    if (tx.tx_ref !== payment.reference || tx.currency !== "KES" || Math.round(Number(tx.amount)) !== Number(payment.amount)) {
      return NextResponse.json({ error: "Transaction mismatch." }, { status: 400 });
    }
    if (tx.status !== "successful") {
      await failOrderPayment(payment.reference, "failed", { provider_status: tx.status });
      return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
    }

    const confirmed = await confirmOrderPayment({
      orderId: payment.order_id,
      reference: payment.reference,
      provider: "flutterwave",
      providerTransactionId: String(tx.id),
      amount: Number(payment.amount),
      metadata: { verified: true, currency: tx.currency },
    });
    if (confirmed) {
      await notifyClientOrderUpdate(
        payment.order_id,
        `Your Youamy order ${payment.order_number} is placed. Your payment was received.`,
        `Order ${payment.order_number} placed`,
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Flutterwave webhook failed", error);
    return NextResponse.json({ error: "Could not process payment callback." }, { status: 500 });
  }
}
