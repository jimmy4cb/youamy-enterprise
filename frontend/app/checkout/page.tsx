import { redirect } from "next/navigation";
import CheckoutForm from "@/components/checkout-form";
import { getCurrentCustomer } from "@backend/lib/customer-auth";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/sign-in?next=/checkout");
  return (
    <CheckoutForm
      customerName={customer.full_name}
      email={customer.email || ""}
      phone={customer.phone || ""}
    />
  );
}
