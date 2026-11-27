"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "verify">("password");
  const [setupSecret, setSetupSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
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
      if (!response.ok) {
        setError(result.error || "Could not sign in.");
        setLoading(false);
        return;
      }
      if (!result.needsTwoStep && !result.requireTotp) {
        router.push("/admin");
        router.refresh();
        return;
      }
      setSetupSecret(result.setupSecret || "");
      setStep("verify");
      setLoading(false);
    } catch {
      setError("Network error while signing in.");
      setLoading(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/admin/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: data.get("code") }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Verification failed.");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error while verifying code.");
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-shell">
      <section className="admin-login-card" aria-label="Administration sign in">
        <aside className="admin-login-brand">
          <Image
            src="/yel-logo.jpg"
            alt="Youamy Enterprises Limited"
            width={88}
            height={66}
            priority
          />
          <div className="admin-login-brand-copy">
            <p>Administration</p>
            <h2>One workspace.<br />Every division.</h2>
          </div>
          <span className="admin-login-brand-mark" aria-hidden="true">YEL</span>
        </aside>

        <div className="admin-login-panel">
          <Link className="admin-login-back" href="/">← Public website</Link>
          <div className="admin-login-heading">
            <span className="admin-login-step">
              {step === "password" ? "Secure access" : "Identity check"}
            </span>
            <h1>{step === "password" ? "Welcome back" : "Enter verification code"}</h1>
            <p>
              {step === "password"
                ? "Sign in to manage Youamy Enterprises."
                : "Open your authenticator app and enter the six-digit code."}
            </p>
          </div>

          {step === "password" ? (
            <form onSubmit={signIn} className="admin-login-form">
              <label>
                Work email
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@youamyenterprises.com"
                  required
                />
              </label>
              <label>
                Password
                <span className="admin-password-field">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
              </label>
              {error && <div className="admin-login-error" role="alert">{error}</div>}
              <button className="admin-login-submit" type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="admin-login-form">
              {setupSecret && (
                <div className="totp-setup">
                  <strong>Set up authenticator</strong>
                  <span>Add this secret to your authenticator app:</span>
                  <code>{setupSecret}</code>
                </div>
              )}
              <label>
                Verification code
                <input
                  className="admin-totp-input"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  required
                />
              </label>
              {error && <div className="admin-login-error" role="alert">{error}</div>}
              <button className="admin-login-submit" type="submit" disabled={loading}>
                {loading ? "Verifying…" : "Verify and continue"}
              </button>
              <button
                className="admin-login-secondary"
                type="button"
                onClick={() => {
                  setError("");
                  setSetupSecret("");
                  setStep("password");
                }}
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
