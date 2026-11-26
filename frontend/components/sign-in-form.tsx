"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/site-shell";

export default function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/checkout";
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const safeNextPath = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/checkout";

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/shop/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sign in failed.");
      router.replace(safeNextPath);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
      setBusy(false);
    }
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/shop/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create account.");
      router.replace(safeNextPath);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create account.");
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="journey-page">
        <section className="journey-panel">
          <p className="section-kicker">Youamy client account</p>
          <h1>{mode === "login" ? "Sign in to your account" : "Create your client account"}</h1>
          <p className="journey-intro">
            Your cart stays saved on this device. Sign in to manage bookings, view receipts, and pay securely.
          </p>

          <div className="journey-methods" role="tablist" aria-label="Account action">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => { setMode("login"); setError(""); }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "active" : ""}
              onClick={() => { setMode("register"); setError(""); }}
            >
              Create account
            </button>
          </div>

          {mode === "login" ? (
            <form className="journey-form" onSubmit={submitLogin}>
              <label>
                Email address or phone number
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="client@example.com or +254 712 345 678"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && <p className="journey-error">{error}</p>}
              <button type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in and continue"}
              </button>

            </form>
          ) : (
            <form className="journey-form" onSubmit={submitRegister}>
              <label>
                Full name
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                Phone number (M-Pesa / WhatsApp)
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+254 7xx xxx xxx"
                  autoComplete="tel"
                  required
                />
              </label>
              <label>
                Email address (optional if phone provided)
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>
              <label>
                Password (at least 8 characters)
                <input
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              {error && <p className="journey-error">{error}</p>}
              <button type="submit" disabled={busy}>
                {busy ? "Creating account…" : "Create account and continue"}
              </button>
            </form>
          )}

          <Link className="journey-back" href="/cart">Back to cart</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
