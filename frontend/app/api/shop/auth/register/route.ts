import { NextResponse } from "next/server";
import {
  CUSTOMER_SESSION_COOKIE,
  createCustomerSession,
  registerCustomer,
} from "@backend/lib/customer-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
    city?: string;
  } | null;

  if (!body?.fullName?.trim() || !body.password) {
    return NextResponse.json({ error: "Full name and password are required." }, { status: 400 });
  }

  try {
    const customer = await registerCustomer({
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      password: body.password,
      city: body.city,
    });
    const sessionId = await createCustomerSession(customer.id);
    const isHttps = request.headers.get("x-forwarded-proto") === "https" || request.url.startsWith("https://");
    const response = NextResponse.json({ ok: true, customer }, { status: 201 });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: 14 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not register account.";
    const code = typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;

    if (msg.includes("already exists") || code === "23505") {
      return NextResponse.json({ error: "An account already exists with these details." }, { status: 409 });
    }

    if (msg === "Provide at least an email address or phone number." || msg === "Password must be at least 8 characters.") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    console.error("Customer registration failed:", error);
    return NextResponse.json({ error: "Could not create an account right now." }, { status: 500 });
  }
}
