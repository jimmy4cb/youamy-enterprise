import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { PENDING_COOKIE, createToken, generateTotpSecret } from "@backend/lib/admin-auth";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password || "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: user, error: userError } = await supabase
      .from("admin_users")
      .select("id, password_hash, totp_secret, active")
      .eq("email", email)
      .maybeSingle();
    if (userError) throw userError;
    if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    const now = new Date().toISOString();
    const { error: expiredPendingError } = await supabase
      .from("admin_pending_logins")
      .delete()
      .lt("expires_at", now);
    if (expiredPendingError) throw expiredPendingError;
    const { error: expiredSessionError } = await supabase
      .from("admin_sessions")
      .delete()
      .lt("expires_at", now);
    if (expiredSessionError) throw expiredSessionError;

    const pendingToken = createToken();
    const setupSecret = user.totp_secret ? null : generateTotpSecret();
    const { error: pendingError } = await supabase
      .from("admin_pending_logins")
      .insert({
        token: pendingToken,
        user_id: user.id,
        setup_secret: setupSecret,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
    if (pendingError) throw pendingError;

    const response = NextResponse.json({
      needsTwoStep: true,
      setup: !user.totp_secret,
      setupSecret,
    });
    response.cookies.set(PENDING_COOKIE, pendingToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Could not start admin sign-in", error);
    return NextResponse.json({ error: "Could not start sign-in. Please try again." }, { status: 500 });
  }
}
