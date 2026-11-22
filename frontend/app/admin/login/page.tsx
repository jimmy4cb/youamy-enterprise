"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "verify">("password");
  const [setupSecret, setSetupSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.get("email"),
        password: data.get("password"),
      }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.error || "Could not sign in.");
      return;
    }
    setSetupSecret(result.setupSecret || "");
    setStep("verify");
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: data.get("code") }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.error || "Verification failed.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="admin-login-shell">
      <section className="admin-login-panel">
        <Image src="/yel-logo.jpg" alt="Youamy Enterprises Limited" width={72} height={54} priority />
        <p>Staff sign in</p>
        <h1>{step === "password" ? "Welcome back" : "Two-step verification"}</h1>

        {step === "password" ? (
          <form onSubmit={signIn} className="admin-login-form">
            <label>Email address<input name="email" type="email" autoComplete="username" required /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
            {error && <div className="admin-login-error">{error}</div>}
            <button type="submit" disabled={loading}>{loading ? "Signing in…" : "Continue"}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="admin-login-form">
            {setupSecret && (
              <div className="totp-setup">
                <strong>Set up two-step verification</strong>
                <span>Add this secret to your authenticator app:</span>
                <code>{setupSecret}</code>
              </div>
            )}
            <label>6-digit verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></label>
            {error && <div className="admin-login-error">{error}</div>}
            <button type="submit" disabled={loading}>{loading ? "Verifying…" : "Sign in"}</button>
          </form>
        )}
        <a href="/">Back to public website</a>
      </section>
    </main>
  );
}
