import { redirect } from "next/navigation";
import CheckoutForm from "@/components/checkout-form";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@backend/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/checkout");
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("phone").eq("id", user.id).single();
  return <CheckoutForm email={user.email || ""} phone={profile?.phone || ""} />;
}
