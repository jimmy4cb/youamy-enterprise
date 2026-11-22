"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AlertItem = { id: string; message: string; read_at: string | null; created_at: string; order_id: string | null };

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/shop/alerts")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setAlerts(result.alerts);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load alerts."));
  }, []);

  async function markRead(alert: AlertItem) {
    const response = await fetch("/api/shop/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId: alert.id }),
    });
    if (response.ok) setAlerts((current) => current.map((item) => item.id === alert.id ? { ...item, read_at: new Date().toISOString() } : item));
  }

  return (
    <main className="journey-page journey-wide">
      <header className="journey-page-head"><div><p className="section-kicker">Your account</p><h1>Alerts</h1></div><Link href="/orders">My Orders</Link></header>
      {error && <p className="journey-error">{error}</p>}
      {!error && alerts.length === 0 && <section className="journey-empty"><h2>You’re all caught up</h2><p>Order updates will appear here.</p></section>}
      <div className="alerts-list">{alerts.map((alert) => (
        <article className={`client-alert${alert.read_at ? " read" : ""}`} key={alert.id}>
          <div><p>{alert.message}</p><small>{new Date(alert.created_at).toLocaleString("en-KE")}</small></div>
          {alert.order_id && <Link href={`/orders/${alert.order_id}`}>View order</Link>}
          {!alert.read_at && <button onClick={() => markRead(alert)}>Mark read</button>}
        </article>
      ))}</div>
    </main>
  );
}
