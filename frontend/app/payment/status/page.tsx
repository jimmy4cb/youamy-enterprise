"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { PanelSkeleton } from "@/components/skeletons";
import { writeCart } from "@/lib/cart-store";

type OrderStatus = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
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
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState("");

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
            <h1>Payment could not be confirmed</h1>
            <p>Your order is still available. The admin team can help arrange an in-person visit for payment.</p>
            <Link className="button button-primary" href={`/orders/${orderId}`}>View order</Link>
          </>
        ) : (
          <>
            <span className="payment-spinner" aria-hidden="true" />
            <h1>Payment due at your scheduled visit</h1>
            <p>The admin team will contact you to confirm a physical visit. Payment is collected in person at the arranged time.</p>
            {order && <p><strong>Order {order.order_number}</strong> · KES {order.total_amount.toLocaleString("en-KE")}</p>}
            <div style={{ marginTop: 18 }}>
              <Link href="/orders">Check My Orders</Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
