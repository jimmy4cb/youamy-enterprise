import { NextResponse } from "next/server";
import {
  CUSTOMER_SESSION_COOKIE,
  authenticateCustomer,
  createCustomerSession,
} from "@backend/lib/customer-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    identifier?: string;
    password?: string;
  } | null;

  if (!body?.identifier?.trim() || !body.password) {
    return NextResponse.json({ error: "Email or phone and password are required." }, { status: 400 });
  }

  try {
    const customer = await authenticateCustomer(body.identifier, body.password);
    if (!customer) {
      return NextResponse.json({ error: "Incorrect email/phone or password." }, { status: 401 });
    }
    const sessionId = await createCustomerSession(customer.id);
    const isHttps = request.headers.get("x-forwarded-proto") === "https" || request.url.startsWith("https://");
    const response = NextResponse.json({ ok: true, customer });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: 14 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Customer sign-in failed:", error);
    return NextResponse.json({ error: "Could not sign in right now." }, { status: 500 });
  }
}
