import { NextResponse } from "next/server";
import type { RowDataPacket } from "@backend/lib/postgres";
import { confirmOrderPayment, failOrderPayment } from "@backend/lib/business-logic";
import { notifyClientOrderUpdate } from "@backend/lib/order-notifications";
import { queryOne } from "@backend/lib/postgres";

async function getMpesaToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("M-Pesa credentials are not configured.");
  const base = process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
  const response = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("Could not verify M-Pesa transaction.");
  return { token: data.access_token as string, base };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      Body?: { stkCallback?: { CheckoutRequestID?: string; ResultCode?: number; CallbackMetadata?: { Item?: Array<{ Name: string; Value?: string | number }> } } };
    };
    const callback = body.Body?.stkCallback;
    const checkoutRequestId = callback?.CheckoutRequestID;
    if (!checkoutRequestId || typeof callback?.ResultCode !== "number") {
      return NextResponse.json({ error: "Invalid callback." }, { status: 400 });
    }

    const payment = await queryOne<RowDataPacket>(
      `SELECT p.reference, p.order_id, p.amount, p.status, o.order_number
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.provider = 'mpesa' AND JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.checkout_request_id')) = ?
       LIMIT 1`,
      [checkoutRequestId],
    );
    if (!payment) return NextResponse.json({ error: "Payment attempt not found." }, { status: 404 });
    if (payment.status !== "pending") return NextResponse.json({ ResultCode: 0, ResultDesc: "Already processed" });

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    if (!shortcode || !passkey) throw new Error("M-Pesa settings are missing.");
    const { token, base } = await getMpesaToken();
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
    const queryResponse = await fetch(`${base}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
      cache: "no-store",
    });
    const query = await queryResponse.json();
    if (!queryResponse.ok || query.ResponseCode !== "0" || query.ResultCode === undefined) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Verification pending" }, { status: 503 });
    }
    if (String(query.ResultCode) !== "0") {
      await failOrderPayment(payment.reference, "failed", { query_result: query.ResultCode });
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Transaction failed" });
    }

    const items = callback.CallbackMetadata?.Item || [];
    const value = (name: string) => items.find((i) => i.Name === name)?.Value;
    const amount = Math.round(Number(value("Amount")));
    const receipt = value("MpesaReceiptNumber");
    if (!Number.isSafeInteger(amount) || !receipt) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Incomplete details" }, { status: 503 });
    }

    const confirmed = await confirmOrderPayment({
      orderId: payment.order_id,
      reference: payment.reference,
      provider: "mpesa",
      providerTransactionId: String(receipt),
      amount,
      metadata: { receipt: String(receipt), checkout_request_id: checkoutRequestId },
    });
    if (confirmed) {
      await notifyClientOrderUpdate(
        payment.order_id,
        `Your Youamy order ${payment.order_number} is placed. Your payment was received.`,
        `Order ${payment.order_number} placed`,
      );
    }
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Payment confirmed" });
  } catch (error) {
    console.error("M-Pesa callback processing failed", error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Callback failed" }, { status: 500 });
  }
}
