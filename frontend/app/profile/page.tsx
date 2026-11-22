"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

export default function ProfilePage() {
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/shop/profile")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setForm(result.profile);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load your profile."));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const response = await fetch("/api/shop/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: form.full_name, phone: form.phone }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Could not save your profile.");
    else setNotice("Profile saved.");
  }

  return (
    <main className="journey-page">
      <section className="journey-panel">
        <p className="section-kicker">Your account</p>
        <h1>Profile</h1>
        <form className="journey-form" onSubmit={save}>
          <label>Full name<input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} autoComplete="name" required /></label>
          <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} autoComplete="tel" type="tel" required /></label>
          <label>Email<input value={form.email} disabled /></label>
          {error && <p className="journey-error">{error}</p>}
          {notice && <p className="journey-notice">{notice}</p>}
          <button type="submit">Save profile</button>
        </form>
        <nav className="profile-links"><Link href="/orders">My Orders</Link><Link href="/alerts">Alerts</Link><Link href="/saved">Saved items</Link></nav>
        <button
          className="journey-signout"
          onClick={async () => {
            const response = await fetch("/api/shop/auth/logout", { method: "POST" });
            if (response.ok) window.location.assign("/");
            else setError("Could not sign out. Please try again.");
          }}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}
