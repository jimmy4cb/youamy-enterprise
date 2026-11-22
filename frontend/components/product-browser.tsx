"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { addToCart } from "@/lib/cart-store";

type Product = {
  id: string;
  title: string;
  division: string;
  description: string;
  image_urls: string[];
  amount_kes: number;
  booking_kind: "none" | "car" | "short_stay";
};

export default function ProductBrowser() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("All");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/shop/products")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setProducts(result.products);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load products."));
  }, []);

  useEffect(() => {
    fetch("/api/shop/saved")
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (result?.items) setSavedIds(result.items.map((item: { product_id: string }) => item.product_id));
      })
      .catch(() => {});
  }, []);

  const divisions = useMemo(() => ["All", ...new Set(products.map((product) => product.division))], [products]);
  const filtered = products.filter((product) =>
    (division === "All" || product.division === division) &&
    `${product.title} ${product.description}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <section className="shop-catalog" id="shop" aria-labelledby="shop-heading">
      <div className="site-container">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Browse and order</p>
            <h2 id="shop-heading">Available listings</h2>
            <p className="section-description">Prices and availability shown here are confirmed by our team.</p>
          </div>
          <a className="shop-cart-link" href="/cart">View cart</a>
        </div>
        <div className="shop-controls">
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search products" placeholder="Search available listings" />
          <select value={division} onChange={(event) => setDivision(event.target.value)} aria-label="Filter by category">
            {divisions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        {error && <p className="shop-message shop-error">{error}</p>}
        {!error && products.length === 0 && (
          <div className="shop-empty">No confirmed listings are available to order yet. Sample listings above can still be enquired about.</div>
        )}
        {filtered.length > 0 && (
          <div className="shop-product-grid">
            {filtered.map((product) => (
              <article className="shop-product" key={product.id}>
                <div className="shop-product-image">
                  {product.image_urls[0] ? (
                    <Image src={product.image_urls[0]} alt={product.title} fill unoptimized sizes="(max-width: 700px) 100vw, 33vw" />
                  ) : <span>Photo coming soon</span>}
                  <span className="shop-status">Available</span>
                </div>
                <div className="shop-product-body">
                  <span className="shop-category">{product.division}</span>
                  <h3>{product.title}</h3>
                  <p>{product.description}</p>
                  <strong>KES {product.amount_kes.toLocaleString("en-KE")}</strong>
                  <button
                    className="button button-primary"
                    onClick={() => {
                      addToCart({
                        product_id: product.id,
                        title: product.title,
                        division: product.division,
                        image_urls: product.image_urls,
                        amount_kes: product.amount_kes,
                        booking_kind: product.booking_kind,
                      });
                      setNotice(`${product.title} added to your cart`);
                    }}
                  >
                    Add to cart
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
                        setNotice("Could not update saved items");
                        return;
                      }
                      setSavedIds(saved ? savedIds.filter((id) => id !== product.id) : [...savedIds, product.id]);
                    }}
                  >
                    {savedIds.includes(product.id) ? "Saved" : "Save item"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {notice && <button className="shop-message" onClick={() => setNotice("")}>{notice} · Close</button>}
      </div>
    </section>
  );
}
