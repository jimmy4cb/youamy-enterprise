"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { CatalogSkeletonGrid } from "@/components/skeletons";

type Product = {
  id: string;
  title: string;
  division: string;
  description: string;
  image_urls: string[];
  amount_kes: number;
};

export default function SavedItemsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const me = await fetch("/api/shop/auth/me").then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (!me?.authenticated) {
          if (active) setAuthNeeded(true);
          return;
        }
        const pendingProduct = window.sessionStorage.getItem("youamy-pending-save");
        if (pendingProduct) {
          const res = await fetch("/api/shop/saved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: pendingProduct }),
          });
          if (res.ok) window.sessionStorage.removeItem("youamy-pending-save");
        }
        const [savedResponse, productResponse] = await Promise.all([
          fetch("/api/shop/saved"),
          fetch("/api/shop/products"),
        ]);
        if (savedResponse.status === 401) {
          if (active) setAuthNeeded(true);
          return;
        }
        const saved = await savedResponse.json();
        const catalog = await productResponse.json();
        if (!savedResponse.ok) throw new Error(saved.error || "Sign in to see saved items.");
        if (!productResponse.ok) throw new Error(catalog.error || "Could not load products.");
        const ids = new Set(saved.items.map((item: { product_id: string }) => item.product_id));
        if (active) setProducts(catalog.products.filter((product: Product) => ids.has(product.id)));
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load saved items.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  async function remove(id: string) {
    const response = await fetch(`/api/shop/saved?product_id=${id}`, { method: "DELETE" });
    if (response.ok) setProducts((current) => current.filter((product) => product.id !== id));
  }

  return (
    <>
      <SiteHeader />
      <main className="journey-page journey-wide">
        <header className="journey-page-head">
          <div><p className="section-kicker">Your account</p><h1>Saved items</h1></div>
          <Link href="/profile">Profile</Link>
        </header>
        {loading && <CatalogSkeletonGrid count={3} />}
        {!loading && authNeeded && (
          <section className="journey-empty">
            <h2>Sign in to view saved items</h2>
            <p>Bookmark vehicles, properties, or sanitation plans across devices.</p>
            <Link className="button button-primary" href="/sign-in?next=/saved">Client sign in</Link>
          </section>
        )}
        {!loading && error && <p className="journey-error">{error}</p>}
        {!loading && !authNeeded && !error && products.length === 0 && (
          <section className="journey-empty">
            <h2>No saved items</h2>
            <p>Save a listing to come back to it later.</p>
            <Link className="button button-primary" href="/#shop">Browse listings</Link>
          </section>
        )}
        {!loading && products.length > 0 && (
          <div className="shop-product-grid">
            {products.map((product) => (
              <article className="shop-product" key={product.id}>
                <div className="shop-product-image">
                  {product.image_urls[0] && (
                    <Image src={product.image_urls[0]} alt={product.title} fill unoptimized sizes="(max-width: 700px) 100vw, 33vw" />
                  )}
                </div>
                <div className="shop-product-body">
                  <span className="shop-category">{product.division}</span>
                  <h3>{product.title}</h3>
                  <p>{product.description}</p>
                  <strong>KES {product.amount_kes.toLocaleString("en-KE")}</strong>
                  <button className="shop-save-button" onClick={() => remove(product.id)}>Remove saved item</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
