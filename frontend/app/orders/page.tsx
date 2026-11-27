"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { OrderSkeletonList } from "@/components/skeletons";

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  order_items: Array<{ title: string; quantity: number; unit_amount: number }>;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authNeeded, setAuthNeeded] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const loadOrders = async () => {
      try {
        const me = await fetch("/api/shop/auth/me").then((r) => (r.ok ? r.json() : null));
        if (!me?.authenticated) {
          if (active) {
            setAuthNeeded(true);
            setLoading(false);
          }
          return false;
        }
        const response = await fetch("/api/shop/orders");
        if (response.status === 401) {
          if (active) setAuthNeeded(true);
          return false;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (active) setOrders(result.orders || []);
        return true;
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load orders.");
        return false;
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadOrders().then((authed) => {
      if (authed && active) {
        timer = window.setInterval(() => { void loadOrders(); }, 15000);
      }
    });

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="journey-page journey-wide">
        <header className="journey-page-head">
          <div><p className="section-kicker">Your account</p><h1>My Orders</h1></div>
          <nav className="profile-links" style={{ marginTop: 0 }}>
            <Link href="/alerts">Alerts</Link>
            <Link href="/saved">Saved items</Link>
            <Link href="/profile">Edit profile</Link>
          </nav>
        </header>
        {loading && !authNeeded && !error && <OrderSkeletonList count={3} />}
        {authNeeded && (
          <section className="journey-empty">
            <h2>Sign in to view your orders</h2>
            <p>Access receipts, booking statuses, and order tracking from your client account.</p>
            <Link className="button button-primary" href="/sign-in?next=/orders">Client sign in</Link>
          </section>
        )}
        {error && <p className="journey-error">{error}</p>}
        {!loading && !authNeeded && !error && orders.length === 0 && (
          <section className="journey-empty">
            <h2>No orders yet</h2>
            <p>Your purchases, car hires, and property bookings will appear here.</p>
            <Link className="button button-primary" href="/#shop">Browse listings</Link>
          </section>
        )}
        <div className="orders-list">
          {orders.map((order) => (
            <Link className="order-list-card" href={`/orders/${order.id}`} key={order.id}>
              <div><span>{order.order_number}</span><strong>{order.status}</strong></div>
              <p>{order.order_items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}</p>
              <footer>
                <span>{new Date(order.created_at).toLocaleDateString("en-KE")}</span>
                <strong>KES {order.total_amount.toLocaleString("en-KE")}</strong>
                <span className={`order-payment ${order.payment_status}`}>
                  {order.payment_status === "pending" ? "Due at visit" : order.payment_status}
                </span>
              </footer>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
