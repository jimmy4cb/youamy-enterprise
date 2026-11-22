"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { writeCart } from "@/lib/cart-store";

type OrderStatus = { id: string; order_number: string; status: string; payment_status: string };

export default function PaymentStatusPage() {
  return (
    <Suspense fallback={<main className="journey-page"><section className="journey-panel">Checking payment status…</section></main>}>
      <PaymentStatusContent />
    </Suspense>
  );
}

function PaymentStatusContent() {
  const search = useSearchParams();
  const orderId = search.get("order");
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) {
      setError("Order reference is missing.");
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const response = await fetch(`/api/shop/orders/${orderId}`);
      const result = await response.json();
      if (!active) return;
      if (!response.ok) {
        setError(result.error || "Could not check payment.");
        return;
      }
      setOrder(result.order);
      if (result.order.payment_status === "paid") {
        writeCart([]);
        window.localStorage.removeItem("youamy-checkout-session");
        return;
      }
      if (["failed", "cancelled"].includes(result.order.payment_status)) return;
      timer = setTimeout(check, 2500);
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
            <p>Order {order.order_number} is placed. A receipt is ready in your order details.</p>
            <Link className="button button-primary" href={`/orders/${order.id}`}>View order and receipt</Link>
          </>
        ) : order?.payment_status === "failed" || order?.payment_status === "cancelled" ? (
          <>
            <span className="payment-status-mark failed">!</span>
            <h1>Payment was not completed</h1>
            <p>Your cart is still saved. Go back to checkout to retry or choose another method.</p>
            <Link className="button button-primary" href="/checkout">Retry payment</Link>
          </>
        ) : (
          <>
            <span className="payment-spinner" aria-hidden="true" />
            <h1>Waiting for payment confirmation</h1>
            <p>Keep this page open while we securely confirm your payment. Your order is not marked paid until the gateway verifies it.</p>
            {order && <p>Order {order.order_number}</p>}
            <Link href="/orders">Check My Orders</Link>
          </>
        )}
      </section>
    </main>
  );
}
