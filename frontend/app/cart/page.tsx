"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readCart, writeCart, type BrowserCartItem } from "@/lib/cart-store";

export default function CartPage() {
  const [items, setItems] = useState<BrowserCartItem[]>([]);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    let active = true;
    const sync = async () => {
      let localItems = readCart();
      setItems(localItems);
      try {
        const savedSession = window.localStorage.getItem("youamy-checkout-session");
        if (savedSession) {
          const checkout = JSON.parse(savedSession) as { key?: string };
          if (checkout.key) {
            const response = await fetch(`/api/shop/orders/checkout-session?key=${encodeURIComponent(checkout.key)}`);
            if (response.status === 401) return;
            if (!response.ok) throw new Error("Could not check the last checkout.");
            const status = await response.json();
            if (status.paid) {
              const purchased = new Set(status.productIds as string[]);
              localItems = localItems.filter((item) => !purchased.has(item.product_id));
              window.localStorage.removeItem("youamy-checkout-session");
              writeCart(localItems);
              if (active) setItems(localItems);
            }
          }
        }
        const mergeResponse = await fetch("/api/shop/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: localItems.map(({ product_id, quantity, booking_details }) => ({ product_id, quantity, booking_details })) }),
        });
        if (mergeResponse.status === 401) return;
        if (!mergeResponse.ok) throw new Error("Could not sync your browser cart.");
        const response = await fetch("/api/shop/cart");
        if (!response.ok) {
          if (response.status !== 401) throw new Error("Could not load your saved cart.");
          return;
        }
        const result = await response.json();
        const savedItems = result.items as BrowserCartItem[];
        const savedIds = new Set(savedItems.map((item) => item.product_id));
        const merged = [...savedItems, ...localItems.filter((item) => !savedIds.has(item.product_id))];
        if (active) {
          setItems(merged);
          writeCart(merged);
        }
      } catch {
        if (active) setSyncError("Your browser cart is saved, but we couldn’t sync it with your account.");
      }
    };
    void sync();
    return () => { active = false; };
  }, []);

  function update(next: BrowserCartItem[]) {
    setItems(next);
    writeCart(next);
    fetch("/api/shop/cart", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: next.map(({ product_id, quantity, booking_details }) => ({ product_id, quantity, booking_details })) }),
    }).then(async (response) => {
      if (!response.ok && response.status !== 401) {
        const result = await response.json();
        setSyncError(result.error || "Could not sync your cart.");
      } else {
        setSyncError("");
      }
    }).catch(() => setSyncError("Your browser cart is saved, but we couldn’t sync it with your account."));
  }

  const total = items.reduce((sum, item) => sum + item.amount_kes * item.quantity, 0);

  return (
    <main className="journey-page journey-wide">
      <header className="journey-page-head">
        <div><p className="section-kicker">Your selection</p><h1>Your cart</h1></div>
        <Link href="/">Continue browsing</Link>
      </header>
      {items.length === 0 ? (
        <section className="journey-empty">
          <h2>Your cart is empty</h2>
          <p>Browse confirmed listings and add an item to get started.</p>
          <Link className="button button-primary" href="/#shop">Browse listings</Link>
        </section>
      ) : (
        <div className="cart-layout">
          {syncError && <p className="journey-error">{syncError}</p>}
          <section className="cart-items" aria-label="Items in your cart">
            {items.map((item) => (
              <article className="cart-item" key={item.product_id}>
                <div className="cart-thumb">
                  {item.image_urls[0] && <Image src={item.image_urls[0]} alt="" fill sizes="100px" />}
                </div>
                <div className="cart-item-info">
                  <span>{item.division}</span>
                  <h2>{item.title}</h2>
                  <strong>KES {item.amount_kes.toLocaleString("en-KE")}</strong>
                </div>
                <label className="cart-quantity">
                  Quantity
                  <select
                    value={item.quantity}
                    onChange={(event) => update(items.map((entry) => entry.product_id === item.product_id ? { ...entry, quantity: Number(event.target.value) } : entry))}
                  >
                    {Array.from({ length: 20 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}
                  </select>
                </label>
                <button className="cart-remove" onClick={() => update(items.filter((entry) => entry.product_id !== item.product_id))}>Remove</button>
              </article>
            ))}
          </section>
          <aside className="cart-summary">
            <h2>Order summary</h2>
            <p><span>Items ({items.length})</span><strong>KES {total.toLocaleString("en-KE")}</strong></p>
            <p><span>Payment</span><strong>Full payment</strong></p>
            <small>Final availability and total are verified at checkout.</small>
            <Link className="button button-primary" href="/checkout">Go to payment</Link>
            <p className="cart-signin-note">You’ll sign in before checkout. Your cart will be kept.</p>
          </aside>
        </div>
      )}
    </main>
  );
}
