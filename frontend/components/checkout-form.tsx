"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCart, writeCart, type BrowserCartItem } from "@/lib/cart-store";

export default function CheckoutForm({ email, phone: initialPhone }: { email: string; phone: string }) {
  const router = useRouter();
  const [items, setItems] = useState<BrowserCartItem[]>([]);
  const [method, setMethod] = useState<"mpesa" | "flutterwave">("mpesa");
  const [phone, setPhone] = useState(initialPhone);
  const [verifiedTotal, setVerifiedTotal] = useState<number | null>(null);
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
          body: JSON.stringify({ items: browserItems.map(({ product_id, quantity, booking_details }) => ({ product_id, quantity, booking_details })) }),
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
        if (active) setError("Could not sync your saved cart. Try again before paying.");
      }
    };
    void sync();
    return () => { active = false; };
  }, []);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.amount_kes * item.quantity, 0), [items]);
  const displayedTotal = verifiedTotal ?? total;

  function updateBookingDetail(productId: string, key: string, value: string) {
    setItems((current) => {
      const updated = current.map((item) => item.product_id === productId
        ? { ...item, booking_details: { ...item.booking_details, [key]: value } }
        : item);
      writeCart(updated);
      return updated;
    });
  }

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length) return;
    setBusy(true);
    setError("");
    try {
      const merged = await fetch("/api/shop/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map(({ product_id, quantity, booking_details }) => ({ product_id, quantity, booking_details })) }),
      });
      if (!merged.ok) throw new Error((await merged.json()).error || "Could not save your cart.");

      const keyStorage = "youamy-checkout-session";
      const signature = JSON.stringify(items
        .map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          booking_details: Object.fromEntries(Object.entries(item.booking_details).sort(([a], [b]) => a.localeCompare(b))),
        }))
        .sort((a, b) => a.product_id.localeCompare(b.product_id)));
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
          items: items.map(({ product_id, quantity, booking_details }) => ({ product_id, quantity, booking_details })),
        }),
      });
      const orderResult = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderResult.error || "Could not create your order.");
      setVerifiedTotal(orderResult.order.total_amount);
      window.localStorage.setItem(keyStorage, JSON.stringify({
        ...checkoutSession,
        orderId: orderResult.order.order_id,
      }));

      const paymentResponse = await fetch("/api/shop/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderResult.order.order_id, provider: method, phone }),
      });
      const payment = await paymentResponse.json();
      if (!paymentResponse.ok) throw new Error(payment.error || "Could not start payment. You can try again.");
      if (payment.url) {
        window.location.assign(payment.url);
        return;
      }
      router.push(`/payment/status?order=${orderResult.order.order_id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong. Your cart is saved; try again.");
      setBusy(false);
    }
  }

  return (
    <main className="journey-page journey-wide">
      <header className="journey-page-head">
        <div><p className="section-kicker">Secure checkout</p><h1>Review and pay</h1></div>
        <Link href="/cart">Back to cart</Link>
      </header>
      <div className="cart-layout">
        <form className="checkout-form" onSubmit={pay}>
          <section className="checkout-section">
            <h2>Booking details</h2>
            {items.map((item) => (
              <div className="booking-fields" key={item.product_id}>
                <h3>{item.title}</h3>
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
            ))}
            <p className="checkout-note">Full payment is due now. Availability is checked before the order is placed.</p>
          </section>
          <section className="checkout-section">
            <h2>Payment method</h2>
            <label className={`payment-option${method === "mpesa" ? " selected" : ""}`}>
              <input type="radio" name="payment" checked={method === "mpesa"} onChange={() => setMethod("mpesa")} />
              <span><strong>M-Pesa</strong><small>Secure STK push to your phone</small></span>
            </label>
            {method === "mpesa" && <label className="checkout-phone">M-Pesa phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+254 7xx xxx xxx" required /></label>}
            <label className={`payment-option${method === "flutterwave" ? " selected" : ""}`}>
              <input type="radio" name="payment" checked={method === "flutterwave"} onChange={() => setMethod("flutterwave")} />
              <span><strong>Card</strong><small>Visa, Mastercard and other supported cards</small></span>
            </label>
          </section>
          <section className="checkout-section">
            <h2>Contact</h2>
            <p>{email}</p>
            <Link href="/profile">Edit your profile</Link>
          </section>
          {error && <p className="journey-error">{error}</p>}
          <button className="button button-primary checkout-pay" type="submit" disabled={busy || items.length === 0}>
            {busy ? "Starting secure payment…" : `Pay KES ${displayedTotal.toLocaleString("en-KE")}`}
          </button>
          <p className="checkout-note">Your order is created before payment. Only a verified gateway callback can mark it paid.</p>
        </form>
        <aside className="cart-summary">
          <h2>Your order</h2>
          {items.map((item) => <p key={item.product_id}><span>{item.title} × {item.quantity}</span><strong>KES {(item.amount_kes * item.quantity).toLocaleString("en-KE")}</strong></p>)}
          <p className="cart-total"><span>Total</span><strong>KES {displayedTotal.toLocaleString("en-KE")}</strong></p>
          <Link href="/cart">Edit cart</Link>
        </aside>
      </div>
    </main>
  );
}
