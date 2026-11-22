"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/checkout";
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [step, setStep] = useState<"details" | "code">("details");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [profile, setProfile] = useState({ full_name: "", phone: "" });

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const login = method === "email"
        ? await supabase.auth.signInWithOtp({
            email: identifier.trim(),
            options: {
              shouldCreateUser: true,
              data: { full_name: profile.full_name.trim(), phone: profile.phone.trim() },
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
            },
          })
        : await supabase.auth.signInWithOtp({
            phone: identifier.trim(),
            options: {
              shouldCreateUser: true,
              data: { full_name: profile.full_name.trim(), phone: profile.phone.trim() },
            },
          });
      if (login.error) throw login.error;
      setStep("code");
      setMessage(`We sent a sign-in code to ${identifier}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send a sign-in code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = new FormData(event.currentTarget);
      const supabase = createSupabaseBrowserClient();
      const verification = method === "email"
        ? await supabase.auth.verifyOtp({ email: identifier.trim(), token: String(data.get("code")), type: "email" })
        : await supabase.auth.verifyOtp({ phone: identifier.trim(), token: String(data.get("code")), type: "sms" });
      if (verification.error) throw verification.error;
      const profileResponse = await fetch("/api/shop/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!profileResponse.ok) {
        const result = await profileResponse.json();
        throw new Error(result.error || "Signed in, but your profile could not be saved.");
      }
      const safeNextPath = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/checkout";
      router.replace(safeNextPath);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not verify the code.");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
      });
      if (oauthError) throw oauthError;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start Google sign-in.");
    }
  }

  return (
    <main className="journey-page">
      <section className="journey-panel">
        <p className="section-kicker">Youamy client account</p>
        <h1>{step === "code" ? "Check your messages" : "Sign in or create an account"}</h1>
        <p className="journey-intro">Your cart stays on this device while you sign in. You’ll return straight to checkout.</p>
        {step === "details" ? (
          <>
            <button type="button" className="journey-google" onClick={googleSignIn}>Continue with Google</button>
            <div className="journey-divider"><span>or continue with a code</span></div>
            <div className="journey-methods">
              <button type="button" className={method === "email" ? "active" : ""} onClick={() => setMethod("email")}>Email</button>
              <button type="button" className={method === "phone" ? "active" : ""} onClick={() => setMethod("phone")}>Phone / SMS</button>
            </div>
            <form className="journey-form" onSubmit={sendCode}>
              <label>Your name<input value={profile.full_name} onChange={(event) => setProfile({ ...profile, full_name: event.target.value })} autoComplete="name" required /></label>
              <label>Phone number<input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} autoComplete="tel" type="tel" required /></label>
              <label>{method === "email" ? "Email address" : "Mobile number"}
                <input
                  type={method === "email" ? "email" : "tel"}
                  autoComplete={method === "email" ? "email" : "tel"}
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                />
              </label>
              {error && <p className="journey-error">{error}</p>}
              <button type="submit" disabled={busy}>
                {busy ? "Sending code…" : method === "phone" ? "Continue with phone" : "Continue with email"}
              </button>
            </form>
          </>
        ) : (
          <form className="journey-form" onSubmit={verifyCode}>
            <p>{message}</p>
            <label>6-digit code<input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></label>
            {error && <p className="journey-error">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify and continue"}</button>
            <button type="button" className="journey-secondary" onClick={() => setStep("details")}>Change sign-in details</button>
          </form>
        )}
        {error && step === "details" && <p className="journey-error">{error}</p>}
        <a className="journey-back" href="/cart">Back to cart</a>
      </section>
    </main>
  );
}
