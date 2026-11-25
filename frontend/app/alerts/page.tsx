"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { OrderSkeletonList } from "@/components/skeletons";

type AlertItem = { id: string; message: string; read_at: string | null; created_at: string; order_id: string | null };

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/shop/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then(async (me) => {
        if (!me?.authenticated) {
          if (active) setAuthNeeded(true);
          return;
        }
        const response = await fetch("/api/shop/alerts");
        if (response.status === 401) {
          if (active) setAuthNeeded(true);
          return;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (active) setAlerts(result.alerts);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load alerts.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function markRead(alert: AlertItem) {
    const response = await fetch("/api/shop/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId: alert.id }),
    });
    if (response.ok) {
      setAlerts((current) => current.map((item) => (item.id === alert.id ? { ...item, read_at: new Date().toISOString() } : item)));
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="journey-page journey-wide">
        <header className="journey-page-head">
          <div><p className="section-kicker">Your account</p><h1>Alerts</h1></div>
          <Link href="/orders">My Orders</Link>
        </header>
        {loading && <OrderSkeletonList count={3} />}
        {!loading && authNeeded && (
          <section className="journey-empty">
            <h2>Sign in to view alerts</h2>
            <p>Payment confirmations and order status updates appear here.</p>
            <Link className="button button-primary" href="/sign-in?next=/alerts">Client sign in</Link>
          </section>
        )}
        {!loading && error && <p className="journey-error">{error}</p>}
        {!loading && !authNeeded && !error && alerts.length === 0 && (
          <section className="journey-empty">
            <h2>You’re all caught up</h2>
            <p>Order updates will appear here.</p>
          </section>
        )}
        {!loading && alerts.length > 0 && (
          <div className="alerts-list">
            {alerts.map((alert) => (
              <article className={`client-alert${alert.read_at ? " read" : ""}`} key={alert.id}>
                <div><p>{alert.message}</p><small>{new Date(alert.created_at).toLocaleString("en-KE")}</small></div>
                {alert.order_id && <Link href={`/orders/${alert.order_id}`}>View order</Link>}
                {!alert.read_at && <button onClick={() => markRead(alert)}>Mark read</button>}
              </article>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
