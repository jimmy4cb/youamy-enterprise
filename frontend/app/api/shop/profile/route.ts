import { NextResponse } from "next/server";
import { getCurrentCustomer, normalizePhone } from "@backend/lib/customer-auth";
import { executeSql } from "@backend/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json({
    profile: {
      full_name: customer.full_name,
      phone: customer.phone || "",
      email: customer.email || "",
      city: customer.city || "",
      loyalty_tier: customer.loyalty_tier,
    },
  });
}

export async function PATCH(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    full_name?: string;
    phone?: string;
    city?: string;
  } | null;

  if (!body?.full_name?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: "Name and phone number are required." }, { status: 400 });
  }

  try {
    const phone = normalizePhone(body.phone);
    await executeSql(
      `UPDATE customers SET full_name = ?, phone = ?, city = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
      [body.full_name.trim(), phone, (body.city || "").trim(), customer.id],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update customer profile:", err);
    return NextResponse.json({ error: "Could not save your profile (phone may already be in use)." }, { status: 409 });
  }
}
