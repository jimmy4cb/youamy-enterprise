import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@backend/lib/supabase/server";

type Provider = "mpesa" | "flutterwave";

async function getMpesaToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("M-Pesa sandbox credentials are not configured.");
  const base = process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
  const response = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("Could not connect to M-Pesa.");
  return { token: data.access_token as string, base };
}

export async function POST(request: Request) {
  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let attemptReference: string | null = null;
  let providerAccepted = false;
  try {
    const session = await createSupabaseServerClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in before paying." }, { status: 401 });
    const body = await request.json() as { orderId?: string; provider?: Provider; phone?: string };
    if (!body.orderId || !["mpesa", "flutterwave"].includes(body.provider || "")) {
      return NextResponse.json({ error: "Choose an order and payment method." }, { status: 400 });
    }

    admin = createSupabaseAdminClient();
    const { data: order, error: orderError } = await admin.from("orders")
      .select("id,order_number,total_amount,payment_status")
      .eq("id", body.orderId).eq("user_id", user.id).single();
    if (orderError || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.payment_status === "paid") return NextResponse.json({ error: "This order is already paid." }, { status: 409 });
    const { data: pendingAttempts } = await admin.from("payments")
      .select("reference,created_at")
      .eq("order_id", order.id).eq("status", "pending");
    if (pendingAttempts?.length) {
      return NextResponse.json({ error: "A payment is already in progress for this order. Wait for it to finish before retrying." }, { status: 409 });
    }

    const provider = body.provider;
    const reference = `YEL-${crypto.randomUUID()}`;
    attemptReference = reference;
    const { error: insertError } = await admin.from("payments").insert({
      order_id: order.id,
      user_id: user.id,
      provider,
      reference,
      amount: order.total_amount,
      status: "pending",
    });
    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "A payment is already in progress for this order." }, { status: 409 });
      }
      throw insertError;
    }

    let response: NextResponse;
    if (provider === "flutterwave") {
      const secret = process.env.FLW_SECRET_KEY;
      if (!secret) throw new Error("Card payments are not configured.");
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is required for payment callbacks.");
      const paymentResponse = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_ref: reference,
          amount: order.total_amount,
          currency: "KES",
          redirect_url: `${siteUrl}/payment/status?order=${order.id}`,
          customer: { email: user.email, name: user.user_metadata?.full_name || user.email },
          meta: { order_id: order.id, order_number: order.order_number },
          customizations: { title: "Youamy Enterprises", description: `Order ${order.order_number}` },
        }),
        cache: "no-store",
      });
      const paymentData = await paymentResponse.json();
      if (!paymentResponse.ok || paymentData.status !== "success" || !paymentData.data?.link) {
        throw new Error(paymentData.message || "Card payment could not be started.");
      }
      providerAccepted = true;
      response = NextResponse.json({ url: paymentData.data.link });
    } else {
      const phone = body.phone?.replace(/\D/g, "");
      if (!phone || !/^(?:254[17]\d{8}|0[17]\d{8}|[17]\d{8})$/.test(phone)) {
        throw new Error("Enter a valid Kenyan mobile number for M-Pesa.");
      }
      const shortcode = process.env.MPESA_SHORTCODE;
      const passkey = process.env.MPESA_PASSKEY;
      const callbackUrl = process.env.MPESA_CALLBACK_URL;
      if (!shortcode || !passkey || !callbackUrl) throw new Error("M-Pesa callback and sandbox settings are not configured.");
      const { token, base } = await getMpesaToken();
      const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
      const normalizedPhone = phone.startsWith("254") ? phone : `254${phone.startsWith("0") ? phone.slice(1) : phone}`;
      const pushResponse = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: order.total_amount,
          PartyA: normalizedPhone,
          PartyB: shortcode,
          PhoneNumber: normalizedPhone,
          CallBackURL: callbackUrl,
          AccountReference: order.order_number,
          TransactionDesc: `Youamy ${order.order_number}`,
        }),
        cache: "no-store",
      });
      const push = await pushResponse.json();
      if (!pushResponse.ok || push.ResponseCode !== "0") throw new Error(push.errorMessage || push.ResponseDescription || "M-Pesa request failed.");
      providerAccepted = true;
      const { error: metadataError } = await admin.from("payments").update({
        metadata: { checkout_request_id: push.CheckoutRequestID, merchant_request_id: push.MerchantRequestID },
      }).eq("reference", reference);
      if (metadataError) throw metadataError;
      response = NextResponse.json({ waiting: true, orderId: order.id });
    }

    await admin.from("orders").update({ payment_status: "pending" }).eq("id", order.id);
    return response;
  } catch (error) {
    console.error("Could not initiate payment", error);
    if (admin && attemptReference && !providerAccepted) {
      await admin.from("payments").update({
        status: "failed",
        metadata: { initiation_error: error instanceof Error ? error.message : "unknown" },
        updated_at: new Date().toISOString(),
      }).eq("reference", attemptReference).eq("status", "pending");
      await admin.rpc("fail_order_payment", { p_reference: attemptReference, p_status: "failed" });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start payment. Your cart is unchanged." },
      { status: 400 },
    );
  }
}
