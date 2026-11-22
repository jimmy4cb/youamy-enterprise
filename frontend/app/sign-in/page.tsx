import { Suspense } from "react";
import SignInForm from "@/components/sign-in-form";

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="journey-page"><section className="journey-panel">Loading sign in…</section></main>}>
      <SignInForm />
    </Suspense>
  );
}
