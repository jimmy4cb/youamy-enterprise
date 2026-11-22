"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const statuses = ["Placed", "Confirmed", "In progress", "Completed"];

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  cancel_requested_at: string | null;
  order_items: Array<{ title: string; quantity: number; unit_amount: number; booking_details: Record<string, string> }>;
  order_status_events: Array<{ status: string; note: string; created_at: string }>;
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadOrder() {
    const response = await fetch(`/api/shop/orders/${params.id}`);
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Order not found.");
      return;
    }
    setOrder(result.order);
  }

  useEffect(() => {
    void loadOrder();
    const timer = window.setInterval(() => { void loadOrder(); }, 15000);
    return () => window.clearInterval(timer);
  }, [params.id]);

  async function requestCancel() {
    const response = await fetch(`/api/shop/orders/${params.id}`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Could not request cancellation.");
    else {
      setNotice(result.message);
      void loadOrder();
    }
  }

  if (error && !order) return <main className="journey-page"><section className="journey-panel"><h1>Order unavailable</h1><p className="journey-error">{error}</p><Link href="/orders">Back to My Orders</Link></section></main>;
  if (!order) return <main className="journey-page"><section className="journey-panel"><p>Loading order…</p></section></main>;

  const statusIndex = statuses.indexOf(order.status);
  return (
    <main className="journey-page journey-wide">
      <header className="journey-page-head"><div><p className="section-kicker">Order detail</p><h1>{order.order_number}</h1></div><Link href="/orders">My Orders</Link></header>
      <div className="order-detail-layout">
        <section className="order-detail-main">
          <div className="order-status-banner"><strong>{order.status}</strong><span>Payment {order.payment_status}</span></div>
          <section className="checkout-section">
            <h2>Order progress</h2>
            <ol className="order-timeline">
              {statuses.map((status, index) => {
                const event = order.order_status_events.find((item) => item.status === status);
                return <li className={index <= statusIndex ? "done" : ""} key={status}><span /> <div><strong>{status}</strong>{event && <small>{new Date(event.created_at).toLocaleString("en-KE")} · {event.note}</small>}</div></li>;
              })}
              {order.status === "Cancelled" && <li className="cancelled"><span /><div><strong>Cancelled</strong></div></li>}
            </ol>
          </section>
          <section className="checkout-section">
            <h2>Items</h2>
            {order.order_items.map((item, index) => (
              <div className="order-detail-item" key={`${item.title}-${index}`}>
                <span>{item.title} × {item.quantity}</span><strong>KES {(item.unit_amount * item.quantity).toLocaleString("en-KE")}</strong>
                {Object.entries(item.booking_details || {}).map(([key, value]) => <small key={key}>{key.replaceAll("_", " ")}: {value}</small>)}
              </div>
            ))}
            <p className="order-total"><strong>Total</strong><strong>KES {order.total_amount.toLocaleString("en-KE")}</strong></p>
          </section>
          {notice && <p className="journey-notice">{notice}</p>}
          {error && <p className="journey-error">{error}</p>}
          {order.payment_status === "paid" && <a className="button button-primary" href={`/api/shop/orders/${order.id}/receipt`}>Download receipt (PDF)</a>}
          {order.payment_status !== "paid" && <Link className="button button-primary" href="/checkout">Retry payment</Link>}
          {!order.cancel_requested_at && !["Completed", "Cancelled"].includes(order.status) && order.payment_status === "paid" && (
            <button className="journey-cancel-request" onClick={requestCancel}>Request cancellation</button>
          )}
          {order.cancel_requested_at && <p className="checkout-note">Cancellation request sent. A staff member will review it.</p>}
        </section>
      </div>
    </main>
  );
}
