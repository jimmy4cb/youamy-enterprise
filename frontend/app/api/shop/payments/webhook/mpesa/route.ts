import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";
import { notifyClientOrderUpdate } from "@backend/lib/order-notifications";

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
  if (!response.ok || !data.access_token) throw new Error("Could not verify the M-Pesa transaction.");
  return { token: data.access_token as string, base };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      Body?: { stkCallback?: { CheckoutRequestID?: string; ResultCode?: number; ResultDesc?: string; CallbackMetadata?: { Item?: Array<{ Name: string; Value?: string | number }> } } };
    };
    const callback = body.Body?.stkCallback;
    const checkoutRequestId = callback?.CheckoutRequestID;
    if (!checkoutRequestId || typeof callback?.ResultCode !== "number") {
      return NextResponse.json({ error: "Invalid callback." }, { status: 400 });
    }
    const admin = createSupabaseAdminClient();
    const { data: payment, error } = await admin.from("payments")
      .select("reference,order_id,amount,metadata,status")
      .eq("provider", "mpesa")
      .contains("metadata", { checkout_request_id: checkoutRequestId })
      .single();
    if (error || !payment) return NextResponse.json({ error: "Payment attempt not found." }, { status: 404 });
    if (payment.status !== "pending") return NextResponse.json({ ResultCode: 0, ResultDesc: "Callback already processed" });

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    if (!shortcode || !passkey) throw new Error("M-Pesa query settings are missing.");
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
      console.error("M-Pesa transaction query was inconclusive", query);
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Transaction verification is pending" }, { status: 503 });
    }
    if (String(query.ResultCode) !== "0") {
      await admin.rpc("fail_order_payment", {
        p_reference: payment.reference,
        p_status: "failed",
        p_metadata: { query_result: query.ResultCode || "unverified" },
      });
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Transaction could not be verified" });
    }
    if (callback.ResultCode !== 0) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Transaction callback is inconsistent" }, { status: 503 });
    }

    const items = callback.CallbackMetadata?.Item || [];
    const value = (name: string) => items.find((item) => item.Name === name)?.Value;
    const amount = Math.round(Number(value("Amount")));
    const receipt = value("MpesaReceiptNumber");
    if (!Number.isSafeInteger(amount) || !receipt) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Transaction details are incomplete" }, { status: 503 });
    }
    const { data: confirmed, error: confirmError } = await admin.rpc("confirm_order_payment", {
      p_order_id: payment.order_id,
      p_reference: payment.reference,
      p_provider: "mpesa",
      p_provider_transaction_id: String(receipt),
      p_amount: amount,
      p_metadata: { receipt: String(receipt || ""), checkout_request_id: checkoutRequestId, phone: String(value("PhoneNumber") || "") },
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
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Payment confirmed" });
  } catch (error) {
    console.error("M-Pesa callback processing failed", error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Callback processing failed" }, { status: 500 });
  }
}
