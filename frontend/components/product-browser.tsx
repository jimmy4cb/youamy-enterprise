"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addToCart, cartCount } from "@/lib/cart-store";
import { CatalogSkeletonGrid } from "@/components/skeletons";

type Product = {
  id: string;
  title: string;
  division: string;
  description: string;
  image_urls: string[];
  amount_kes: number;
  price_unit?: string;
  location?: string;
  stock_quantity?: number;
  booking_kind: "none" | "car" | "short_stay";
};

function unitLabel(unit?: string) {
  if (unit === "per_day") return " / day";
  if (unit === "per_night") return " / night";
  if (unit === "per_month") return " / month";
  if (unit === "per_trip") return " / trip";
  return "";
}

export default function ProductBrowser() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("All");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [itemsInCart, setItemsInCart] = useState(0);

  useEffect(() => {
    setItemsInCart(cartCount());
    const sync = () => setItemsInCart(cartCount());
    window.addEventListener("youamy-cart-changed", sync);
    fetch("/api/shop/products")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setProducts(result.products);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load products."))
      .finally(() => setLoading(false));
    return () => window.removeEventListener("youamy-cart-changed", sync);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/shop/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (!active || !me?.authenticated) return null;
        return fetch("/api/shop/saved").then((r) => (r.ok ? r.json() : null));
      })
      .then((result) => {
        if (active && result?.items) {
          setSavedIds(result.items.map((item: { product_id: string }) => item.product_id));
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const divisions = useMemo(() => ["All", ...new Set(products.map((product) => product.division))], [products]);
  const filtered = products.filter((product) =>
    (division === "All" || product.division === division) &&
    `${product.title} ${product.description} ${product.location || ""}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <section className="shop-catalog" id="shop" aria-labelledby="shop-heading">
      <div className="site-container">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Browse and order online</p>
            <h2 id="shop-heading">Direct Purchase &amp; Instant Bookings</h2>
            <p className="section-description">
              Confirmed pricing and live stock verified by Youamy Enterprises. Add items to your cart, submit an order, and pay in person at your scheduled visit.
            </p>
          </div>
          <Link className="shop-cart-link" href="/cart">
            View cart {itemsInCart > 0 ? `(${itemsInCart})` : ""}
          </Link>
        </div>

        <div className="shop-controls">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search products"
            placeholder="Search cars, villas, sanitation packages, location..."
          />
          <select value={division} onChange={(event) => setDivision(event.target.value)} aria-label="Filter by category">
            {divisions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        {error && <p className="shop-message shop-error">{error}</p>}
        {!error && loading && <CatalogSkeletonGrid count={3} />}
        {!error && !loading && filtered.length === 0 && (
          <div className="shop-empty">No listings match that search or filter.</div>
        )}
        {filtered.length > 0 && (
          <div className="shop-product-grid">
            {filtered.map((product) => {
              const stockQty = product.stock_quantity ?? 1;
              const outOfStock = stockQty < 1;
              return (
                <article className="shop-product" key={product.id}>
                  <div className="shop-product-image">
                    {product.image_urls[0] ? (
                      <Image src={product.image_urls[0]} alt={product.title} fill unoptimized sizes="(max-width: 700px) 100vw, 33vw" />
                    ) : <span>Photo coming soon</span>}
                    <span className={`shop-status${outOfStock ? " out" : ""}`}>
                      {outOfStock ? "Out of stock" : stockQty > 1 ? `${stockQty} available` : "Available"}
                    </span>
                  </div>
                  <div className="shop-product-body">
                    <div className="shop-meta-top">
                      <span className="shop-category">{product.division}</span>
                      {product.location && <span className="shop-location">{product.location}</span>}
                    </div>
                    <h3>{product.title}</h3>
                    <p>{product.description}</p>
                    <strong>
                      KES {product.amount_kes.toLocaleString("en-KE")}
                      {unitLabel(product.price_unit)}
                    </strong>
                    <button
                      className="button button-primary"
                      disabled={outOfStock}
                      onClick={() => {
                        addToCart({
                          product_id: product.id,
                          title: product.title,
                          division: product.division,
                          image_urls: product.image_urls,
                          amount_kes: product.amount_kes,
                          booking_kind: product.booking_kind,
                        });
                        setNotice(`${product.title} added to your cart.`);
                      }}
                    >
                      {outOfStock ? "Currently unavailable" : product.booking_kind === "none" ? "Add to cart" : "Book & add to cart"}
                    </button>
                    <button
                      className="shop-save-button"
                      onClick={async () => {
                        const saved = savedIds.includes(product.id);
                        const response = await fetch(saved ? `/api/shop/saved?product_id=${product.id}` : "/api/shop/saved", {
                          method: saved ? "DELETE" : "POST",
                          headers: { "Content-Type": "application/json" },
                          ...(saved ? {} : { body: JSON.stringify({ product_id: product.id }) }),
                        });
                        if (response.status === 401) {
                          window.sessionStorage.setItem("youamy-pending-save", product.id);
                          window.location.assign(`/sign-in?next=${encodeURIComponent("/saved")}`);
                          return;
                        }
                        if (!response.ok) {
                          setNotice("Could not update saved items.");
                          return;
                        }
                        setSavedIds(saved ? savedIds.filter((id) => id !== product.id) : [...savedIds, product.id]);
                      }}
                    >
                      {savedIds.includes(product.id) ? "Saved to account ✓" : "Save item"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {notice && (
          <div className="shop-toast-bar">
            <span>{notice}</span>
            <div>
              <Link href="/cart">Go to cart →</Link>
              <button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification">×</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
