"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/shop/orders")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (active) setOrders(result.orders);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load orders.");
      });
    void load();
    const timer = window.setInterval(() => { void load(); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return (
    <main className="journey-page journey-wide">
      <header className="journey-page-head"><div><p className="section-kicker">Your account</p><h1>My Orders</h1></div><Link href="/profile">Edit profile</Link></header>
      {error && <p className="journey-error">{error}</p>}
      {!error && orders.length === 0 && <section className="journey-empty"><h2>No orders yet</h2><p>Your paid orders and their progress will appear here.</p><Link className="button button-primary" href="/#shop">Browse listings</Link></section>}
      <div className="orders-list">
        {orders.map((order) => (
          <Link className="order-list-card" href={`/orders/${order.id}`} key={order.id}>
            <div><span>{order.order_number}</span><strong>{order.status}</strong></div>
            <p>{order.order_items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}</p>
            <footer><span>{new Date(order.created_at).toLocaleDateString("en-KE")}</span><strong>KES {order.total_amount.toLocaleString("en-KE")}</strong><span className={`order-payment ${order.payment_status}`}>{order.payment_status}</span></footer>
          </Link>
        ))}
      </div>
    </main>
  );
}
