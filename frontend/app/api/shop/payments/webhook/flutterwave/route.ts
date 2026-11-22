import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";
import { notifyClientOrderUpdate } from "@backend/lib/order-notifications";

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

    const admin = createSupabaseAdminClient();
    const { data: payment, error } = await admin.from("payments")
      .select("id,order_id,amount,reference,status")
      .eq("reference", txRef).single();
    if (error || !payment) return NextResponse.json({ error: "Payment attempt not found." }, { status: 404 });

    const secret = process.env.FLW_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Payment verification is not configured." }, { status: 503 });
    const verifyResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    const verified = await verifyResponse.json();
    const transaction = verified.data;
    if (!verifyResponse.ok || verified.status !== "success" || !transaction) {
      return NextResponse.json({ error: "Gateway verification is temporarily unavailable." }, { status: 503 });
    }
    if (
      transaction.tx_ref !== payment.reference ||
      transaction.currency !== "KES" ||
      Math.round(Number(transaction.amount)) !== payment.amount
    ) {
      console.error("Flutterwave transaction did not match its payment attempt", txRef);
      return NextResponse.json({ error: "Transaction details do not match." }, { status: 400 });
    }
    if (transaction.status !== "successful") {
      if (!["failed", "cancelled"].includes(transaction.status)) {
        return NextResponse.json({ error: "Payment is not final yet." }, { status: 503 });
      }
      await admin.rpc("fail_order_payment", {
        p_reference: payment.reference,
        p_status: "failed",
        p_metadata: { provider_status: body.data?.status || "unverified" },
      });
      return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
    }

    const { data: confirmed, error: confirmError } = await admin.rpc("confirm_order_payment", {
      p_order_id: payment.order_id,
      p_reference: payment.reference,
      p_provider: "flutterwave",
      p_provider_transaction_id: String(transaction.id),
      p_amount: payment.amount,
      p_metadata: { verified: true, currency: transaction.currency },
    });
    if (confirmError) throw confirmError;
    if (confirmed) {
      const { data: order } = await admin.from("orders").select("order_number").eq("id", payment.order_id).single();
      await notifyClientOrderUpdate(
        admin,
        payment.order_id,
        `Your Youamy order ${order?.order_number || ""} is placed. Your payment was received.`,
        `Order ${order?.order_number || ""} placed`,
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Flutterwave webhook processing failed", error);
    return NextResponse.json({ error: "Could not process payment callback." }, { status: 500 });
  }
}

