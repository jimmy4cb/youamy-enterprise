"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  const [error, setError] = useState("");

  useEffect(() => {
    const pendingProduct = window.sessionStorage.getItem("youamy-pending-save");
    const savePending = pendingProduct
      ? fetch("/api/shop/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: pendingProduct }),
        }).then((response) => {
          if (response.ok) window.sessionStorage.removeItem("youamy-pending-save");
        })
      : Promise.resolve();
    savePending.then(() => Promise.all([fetch("/api/shop/saved"), fetch("/api/shop/products")]))
      .then(async ([savedResponse, productResponse]) => {
        const saved = await savedResponse.json();
        const catalog = await productResponse.json();
        if (!savedResponse.ok) throw new Error(saved.error || "Sign in to see saved items.");
        if (!productResponse.ok) throw new Error(catalog.error || "Could not load products.");
        const ids = new Set(saved.items.map((item: { product_id: string }) => item.product_id));
        setProducts(catalog.products.filter((product: Product) => ids.has(product.id)));
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load saved items."));
  }, []);

  async function remove(id: string) {
    const response = await fetch(`/api/shop/saved?product_id=${id}`, { method: "DELETE" });
    if (response.ok) setProducts((current) => current.filter((product) => product.id !== id));
  }

  return (
    <main className="journey-page journey-wide">
      <header className="journey-page-head"><div><p className="section-kicker">Your account</p><h1>Saved items</h1></div><Link href="/profile">Profile</Link></header>
      {error && <p className="journey-error">{error}</p>}
      {!error && products.length === 0 && <section className="journey-empty"><h2>No saved items</h2><p>Save a listing to come back to it later.</p><Link className="button button-primary" href="/#shop">Browse listings</Link></section>}
      <div className="shop-product-grid">{products.map((product) => (
        <article className="shop-product" key={product.id}>
          <div className="shop-product-image">{product.image_urls[0] && <Image src={product.image_urls[0]} alt={product.title} fill unoptimized sizes="(max-width: 700px) 100vw, 33vw" />}</div>
          <div className="shop-product-body"><span className="shop-category">{product.division}</span><h3>{product.title}</h3><p>{product.description}</p><strong>KES {product.amount_kes.toLocaleString("en-KE")}</strong><button className="shop-save-button" onClick={() => remove(product.id)}>Remove saved item</button></div>
        </article>
      ))}</div>
    </main>
  );
}
