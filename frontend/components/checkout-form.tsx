"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { readCart, writeCart, type BrowserCartItem } from "@/lib/cart-store";

function calculateItemMultiplier(item: BrowserCartItem): { units: number; label: string } {
  if (item.booking_kind === "car") {
    const start = item.booking_details.pickup_at ? Date.parse(item.booking_details.pickup_at) : NaN;
    const end = item.booking_details.return_at ? Date.parse(item.booking_details.return_at) : NaN;
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const days = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
      return { units: days, label: `${days} day${days > 1 ? "s" : ""}` };
    }
    return { units: 1, label: "1 day (select dates)" };
  }
  if (item.booking_kind === "short_stay") {
    const start = item.booking_details.check_in ? Date.parse(item.booking_details.check_in) : NaN;
    const end = item.booking_details.check_out ? Date.parse(item.booking_details.check_out) : NaN;
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const nights = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
      return { units: nights, label: `${nights} night${nights > 1 ? "s" : ""}` };
    }
    return { units: 1, label: "1 night (select dates)" };
  }
  return { units: 1, label: "Standard" };
}

export default function CheckoutForm({
  customerName,
  email,
  phone: initialPhone,
}: {
  customerName?: string;
  email: string;
  phone: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<BrowserCartItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      const browserItems = readCart();
      setItems(browserItems);
      try {
        await fetch("/api/shop/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: browserItems.map(({ product_id, quantity, booking_details }) => ({
              product_id,
              quantity,
              booking_details,
            })),
          }),
        });
        const response = await fetch("/api/shop/cart");
        if (!response.ok) return;
        const result = await response.json();
        const remoteItems = result.items as BrowserCartItem[];
        const remoteIds = new Set(remoteItems.map((item) => item.product_id));
        const merged = [
          ...remoteItems,
          ...browserItems.filter((item) => !remoteIds.has(item.product_id)),
        ];
        if (active) {
          setItems(merged);
          writeCart(merged);
        }
      } catch {
        if (active) setError("Could not sync your saved cart. Try again before submitting your order.");
      }
    };
    void sync();
    return () => { active = false; };
  }, []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.amount_kes * item.quantity * calculateItemMultiplier(item).units, 0),
    [items],
  );
  function updateBookingDetail(productId: string, key: string, value: string) {
    setItems((current) => {
      const updated = current.map((item) =>
        item.product_id === productId
          ? { ...item, booking_details: { ...item.booking_details, [key]: value } }
          : item,
      );
      writeCart(updated);
      return updated;
    });
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length) return;
    setBusy(true);
    setError("");
    try {
      const merged = await fetch("/api/shop/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(({ product_id, quantity, booking_details }) => ({
            product_id,
            quantity,
            booking_details,
          })),
        }),
      });
      if (!merged.ok) throw new Error((await merged.json()).error || "Could not save your cart.");

      const keyStorage = "youamy-checkout-session";
      const signature = JSON.stringify(
        items
          .map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            booking_details: Object.fromEntries(
              Object.entries(item.booking_details).sort(([a], [b]) => a.localeCompare(b)),
            ),
          }))
          .sort((a, b) => a.product_id.localeCompare(b.product_id)),
      );
      const previousSession = window.localStorage.getItem(keyStorage);
      let checkoutSession: { signature: string; key: string } | null = null;
      if (previousSession) {
        try {
          checkoutSession = JSON.parse(previousSession) as { signature: string; key: string };
        } catch {
          window.localStorage.removeItem(keyStorage);
        }
      }
      if (!checkoutSession || checkoutSession.signature !== signature) {
        checkoutSession = { signature, key: crypto.randomUUID() };
        window.localStorage.setItem(keyStorage, JSON.stringify(checkoutSession));
      }
      const orderResponse = await fetch("/api/shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutKey: checkoutSession.key,
          items: items.map(({ product_id, quantity, booking_details }) => ({
            product_id,
            quantity,
            booking_details,
          })),
        }),
      });
      const orderResult = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderResult.error || "Could not create your order.");
      writeCart([]);
      window.localStorage.removeItem(keyStorage);
      router.push(`/orders/${orderResult.order.order_id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit your order. Your cart is saved; try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="journey-page journey-wide">
        <header className="journey-page-head">
          <div><p className="section-kicker">Order details</p><h1>Place your order</h1></div>
          <Link href="/cart">Back to cart</Link>
        </header>
        <div className="cart-layout">
          <form className="checkout-form" onSubmit={submitOrder}>
            <section className="checkout-section">
              <h2>Items &amp; booking dates</h2>
              {items.map((item) => {
                const mult = calculateItemMultiplier(item);
                return (
                  <div className="booking-fields" key={item.product_id}>
                    <div className="booking-item-title">
                      <h3>{item.title}</h3>
                      <span>{mult.label}</span>
                    </div>
                    {item.booking_kind === "short_stay" && (
                      <div className="checkout-fields">
                        <label>Check-in<input type="date" value={item.booking_details.check_in || ""} required onChange={(event) => updateBookingDetail(item.product_id, "check_in", event.target.value)} /></label>
                        <label>Check-out<input type="date" value={item.booking_details.check_out || ""} required onChange={(event) => updateBookingDetail(item.product_id, "check_out", event.target.value)} /></label>
                      </div>
                    )}
                    {item.booking_kind === "car" && (
                      <div className="checkout-fields">
                        <label>Pickup date and time<input type="datetime-local" value={item.booking_details.pickup_at || ""} required onChange={(event) => updateBookingDetail(item.product_id, "pickup_at", event.target.value)} /></label>
                        <label>Return date and time<input type="datetime-local" value={item.booking_details.return_at || ""} required onChange={(event) => updateBookingDetail(item.product_id, "return_at", event.target.value)} /></label>
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="checkout-note">Booking dates and stock are checked before your order is submitted.</p>
            </section>
            <section className="checkout-section">
              <h2>Payment at your visit</h2>
              <p>No online payment is collected. The admin team will contact you to schedule a physical visit, and payment is made during that visit.</p>
            </section>
            <section className="checkout-section">
              <h2>Account contact</h2>
              <p>{customerName ? `${customerName} · ` : ""}{email || initialPhone}</p>
              <Link href="/profile">Edit your profile</Link>
            </section>
            {error && <p className="journey-error">{error}</p>}
            <button className="button button-primary checkout-pay" type="submit" disabled={busy || items.length === 0}>
              {busy ? "Submitting order…" : `Submit order · KES ${total.toLocaleString("en-KE")}`}
            </button>
            <p className="checkout-note">Your order is not paid until the admin team records payment at your scheduled visit.</p>
          </form>
          <aside className="cart-summary">
            <h2>Your order</h2>
            {items.map((item) => {
              const mult = calculateItemMultiplier(item);
              const sub = item.amount_kes * item.quantity * mult.units;
              return (
                <p key={item.product_id}>
                  <span>{item.title} × {item.quantity}{mult.units > 1 ? ` (${mult.label})` : ""}</span>
                  <strong>KES {sub.toLocaleString("en-KE")}</strong>
                </p>
              );
            })}
            <p className="cart-total"><span>Total due at visit</span><strong>KES {total.toLocaleString("en-KE")}</strong></p>
            <Link href="/cart">Edit cart</Link>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
