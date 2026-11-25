import { NextResponse } from "next/server";
import crypto from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { getCurrentCustomer } from "@backend/lib/customer-auth";
import { failOrderPayment } from "@backend/lib/business-logic";
import { executeSql, queryOne, withTransaction } from "@backend/lib/mysql";

type Provider = "mpesa" | "flutterwave";

async function getMpesaToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) return null;
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
  let attemptReference: string | null = null;
  let providerAccepted = false;

  try {
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: "Sign in before paying." }, { status: 401 });

    const body = await request.json().catch(() => null) as {
      orderId?: string;
      provider?: Provider;
      phone?: string;
    } | null;

    if (!body?.orderId || !["mpesa", "flutterwave"].includes(body.provider || "")) {
      return NextResponse.json({ error: "Choose an order and payment method." }, { status: 400 });
    }

    const provider = body.provider as Provider;
    const reference = `YEL-PAY-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;

    const order = await withTransaction(async (conn) => {
      const [orderRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, order_number, total_amount, payment_status
         FROM orders WHERE id = ? AND customer_id = ? FOR UPDATE`,
        [body.orderId, customer.id],
      );
      const found = orderRows[0];
      if (!found) throw new Error("ORDER_NOT_FOUND");
      if (found.payment_status === "paid") throw new Error("ALREADY_PAID");

      const [pendingRows] = await conn.query<RowDataPacket[]>(
        `SELECT reference FROM payments WHERE order_id = ? AND status = 'pending' LIMIT 1 FOR UPDATE`,
        [found.id],
      );
      if (pendingRows.length > 0) {
        return {
          id: String(found.id),
          order_number: String(found.order_number),
          total_amount: Number(found.total_amount),
          payment_status: String(found.payment_status),
          existingPendingReference: String(pendingRows[0].reference),
        };
      }

      await conn.execute(
        `INSERT INTO payments (id, order_id, customer_id, provider, reference, amount, status, metadata)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', '{}')`,
        [crypto.randomUUID(), found.id, customer.id, provider, reference, Number(found.total_amount)],
      );
      await conn.execute(`UPDATE orders SET payment_status = 'pending' WHERE id = ?`, [found.id]);
      return {
        id: String(found.id),
        order_number: String(found.order_number),
        total_amount: Number(found.total_amount),
        payment_status: String(found.payment_status),
        existingPendingReference: null as string | null,
      };
    });

    if (order.existingPendingReference) {
      attemptReference = order.existingPendingReference;
      return NextResponse.json({
        waiting: true,
        sandbox: true,
        orderId: order.id,
        reference: order.existingPendingReference,
      });
    }

    attemptReference = reference;

    if (provider === "flutterwave") {
      const secret = process.env.FLW_SECRET_KEY;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (secret && siteUrl) {
        const paymentResponse = await fetch("https://api.flutterwave.com/v3/payments", {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            tx_ref: reference,
            amount: Number(order.total_amount),
            currency: "KES",
            redirect_url: `${siteUrl}/payment/status?order=${order.id}`,
            customer: { email: customer.email || "client@youamyenterprises.com", name: customer.full_name },
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
        return NextResponse.json({ url: paymentData.data.link, reference });
      }

      // Sandbox card flow when live FLW keys aren't set
      providerAccepted = true;
      await executeSql(
        `UPDATE payments SET metadata = ? WHERE reference = ?`,
        [JSON.stringify({ sandbox: true, method: "card" }), reference],
      );
      return NextResponse.json({ waiting: true, sandbox: true, orderId: order.id, reference });
    }

    // M-Pesa flow
    const phoneDigits = (body.phone || "").replace(/\D/g, "");
    if (!phoneDigits || !/^(?:254[17]\d{8}|0[17]\d{8}|[17]\d{8})$/.test(phoneDigits)) {
      throw new Error("Enter a valid Kenyan mobile number for M-Pesa (e.g. 0712345678 or +254712345678).");
    }
    const normalizedPhone = phoneDigits.startsWith("254")
      ? phoneDigits
      : `254${phoneDigits.startsWith("0") ? phoneDigits.slice(1) : phoneDigits}`;

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;
    const mpesaAuth = await getMpesaToken();

    if (mpesaAuth && shortcode && passkey && callbackUrl) {
      const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
      const pushResponse = await fetch(`${mpesaAuth.base}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mpesaAuth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: Number(order.total_amount),
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
      if (!pushResponse.ok || push.ResponseCode !== "0") {
        throw new Error(push.errorMessage || push.ResponseDescription || "M-Pesa STK push failed.");
      }
      providerAccepted = true;
      await executeSql(
        `UPDATE payments SET metadata = ? WHERE reference = ?`,
        [JSON.stringify({ checkout_request_id: push.CheckoutRequestID, merchant_request_id: push.MerchantRequestID, phone: normalizedPhone }), reference],
      );
      return NextResponse.json({ waiting: true, sandbox: false, orderId: order.id, reference });
    }

    // Sandbox STK Push flow when Daraja credentials aren't configured
    providerAccepted = true;
    await executeSql(
      `UPDATE payments SET metadata = ? WHERE reference = ?`,
      [JSON.stringify({ sandbox: true, method: "mpesa", phone: normalizedPhone }), reference],
    );
    return NextResponse.json({ waiting: true, sandbox: true, orderId: order.id, reference });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "ALREADY_PAID") {
      return NextResponse.json({ error: "This order is already paid." }, { status: 409 });
    }
    if (attemptReference && !providerAccepted) {
      await failOrderPayment(attemptReference, "failed", {
        initiation_error: error instanceof Error ? error.message : "unknown",
      });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start payment." },
      { status: 400 },
    );
  }
}
