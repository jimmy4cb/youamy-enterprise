"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { PanelSkeleton } from "@/components/skeletons";
import { writeCart } from "@/lib/cart-store";

type PaymentItem = {
  id?: string;
  provider: string;
  status: string;
  amount?: number;
  provider_reference?: string | null;
  metadata?: { sandbox?: boolean } | null;
  raw_payload?: { sandbox?: boolean } | null;
};

type OrderStatus = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  payments?: PaymentItem[];
};

export default function PaymentStatusPage() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<main className="journey-page"><section className="journey-panel"><PanelSkeleton lines={3} /></section></main>}>
        <PaymentStatusContent />
      </Suspense>
      <SiteFooter />
    </>
  );
}

function PaymentStatusContent() {
  const search = useSearchParams();
  const orderId = search.get("order");
  const isSandboxParam = search.get("sandbox") === "1";
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState("");
  const [simBusy, setSimBusy] = useState(false);

  async function fetchOrderStatus() {
    if (!orderId) return null;
    const response = await fetch(`/api/shop/orders/${orderId}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not check payment.");
    return result.order as OrderStatus;
  }

  useEffect(() => {
    if (!orderId) {
      setError("Order reference is missing.");
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const fetched = await fetchOrderStatus();
        if (!active || !fetched) return;
        setOrder(fetched);
        if (fetched.payment_status === "paid") {
          writeCart([]);
          window.localStorage.removeItem("youamy-checkout-session");
          return;
        }
        if (["failed", "cancelled"].includes(fetched.payment_status)) return;
        timer = setTimeout(check, 2500);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not check payment.");
      }
    };
    void check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [orderId]);

  async function simulateSandbox(outcome: "paid" | "failed") {
    if (!orderId) return;
    setSimBusy(true);
    setError("");
    try {
      const response = await fetch("/api/shop/payments/sandbox-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, outcome }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sandbox confirmation failed.");
      const updated = await fetchOrderStatus();
      if (updated) {
        setOrder(updated);
        if (updated.payment_status === "paid") {
          writeCart([]);
          window.localStorage.removeItem("youamy-checkout-session");
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sandbox simulation failed.");
    } finally {
      setSimBusy(false);
    }
  }

  const latestPayment = order?.payments?.[0];
  const showSandboxControls = Boolean(
    order &&
    order.payment_status === "pending" &&
    (isSandboxParam || latestPayment?.raw_payload?.sandbox || latestPayment?.metadata?.sandbox),
  );

  return (
    <main className="journey-page">
      <section className="journey-panel payment-status-panel">
        <p className="section-kicker">Payment status</p>
        {error ? (
          <>
            <h1>We couldn’t check your payment</h1>
            <p className="journey-error">{error}</p>
            <Link href="/orders">Check My Orders</Link>
          </>
        ) : order?.payment_status === "paid" ? (
          <>
            <span className="payment-status-mark success">✓</span>
            <h1>Payment confirmed</h1>
            <p>Order {order.order_number} (KES {order.total_amount.toLocaleString("en-KE")}) is placed and confirmed. Your PDF receipt is ready.</p>
            <Link className="button button-primary" href={`/orders/${order.id}`}>View order and download receipt</Link>
          </>
        ) : order?.payment_status === "failed" || order?.payment_status === "cancelled" ? (
          <>
            <span className="payment-status-mark failed">!</span>
            <h1>Payment was not completed</h1>
            <p>Your cart is still saved. Return to checkout to retry or choose another payment method.</p>
            <Link className="button button-primary" href="/checkout">Retry payment</Link>
          </>
        ) : (
          <>
            <span className="payment-spinner" aria-hidden="true" />
            <h1>Waiting for payment confirmation</h1>
            <p>Keep this page open while we confirm your {latestPayment?.provider === "flutterwave" ? "card" : "M-Pesa STK"} payment.</p>
            {order && <p><strong>Order {order.order_number}</strong> · KES {order.total_amount.toLocaleString("en-KE")}</p>}

            {showSandboxControls && (
              <div className="sandbox-gateway-card">
                <p className="section-kicker">Sandbox gateway test mode</p>
                <p>No live M-Pesa/Flutterwave keys are configured in this environment. Simulate the gateway callback below:</p>
                <div className="sandbox-gateway-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={simBusy}
                    onClick={() => void simulateSandbox("paid")}
                  >
                    {simBusy ? "Processing…" : "Simulate Successful Payment"}
                  </button>
                  <button
                    type="button"
                    className="journey-cancel-request"
                    disabled={simBusy}
                    onClick={() => void simulateSandbox("failed")}
                  >
                    Simulate Payment Failure
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <Link href="/orders">Check My Orders</Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
