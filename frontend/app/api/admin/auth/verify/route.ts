import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminDatabase, syncAdminUserMirror } from "@backend/lib/admin-db";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";
import {
  PENDING_COOKIE,
  SESSION_COOKIE,
  createToken,
  verifyTotp,
} from "@backend/lib/admin-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { code?: string } | null;
  const code = body?.code?.replace(/\s/g, "") || "";
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(PENDING_COOKIE)?.value;
  if (!pendingToken || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter a valid six-digit code." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data: pending, error: pendingError } = await supabase
      .from("admin_pending_logins")
      .select("user_id, setup_secret")
      .eq("token", pendingToken)
      .gt("expires_at", now)
      .maybeSingle();
    if (pendingError) throw pendingError;
    if (!pending) {
      return NextResponse.json({ error: "Your sign-in request expired. Sign in again." }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
      .from("admin_users")
      .select("id, name, email, role, totp_secret, active")
      .eq("id", pending.user_id)
      .maybeSingle();
    if (userError) throw userError;
    if (!user || !user.active) {
      return NextResponse.json({ error: "Your account is inactive." }, { status: 401 });
    }

    const secret = pending.setup_secret || user.totp_secret;
    if (!secret) {
      return NextResponse.json({ error: "Two-step setup is unavailable." }, { status: 400 });
    }
    if (!verifyTotp(secret, code)) {
      return NextResponse.json({ error: "The verification code is incorrect." }, { status: 401 });
    }

    if (!user.totp_secret) {
      const { data: updatedUser, error: updateError } = await supabase
        .from("admin_users")
        .update({ totp_secret: secret })
        .eq("id", pending.user_id)
        .is("totp_secret", null)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updatedUser) {
        const { data: latestUser, error: latestUserError } = await supabase
          .from("admin_users")
          .select("totp_secret")
          .eq("id", pending.user_id)
          .maybeSingle();
        if (latestUserError) throw latestUserError;
        if (!latestUser?.totp_secret || !verifyTotp(latestUser.totp_secret, code)) {
          return NextResponse.json({ error: "The verification code is incorrect." }, { status: 401 });
        }
      }
    }

    const { error: deletePendingError } = await supabase
      .from("admin_pending_logins")
      .delete()
      .eq("token", pendingToken);
    if (deletePendingError) throw deletePendingError;

    const sessionId = createToken();
    const { error: sessionError } = await supabase
      .from("admin_sessions")
      .insert({
        id: sessionId,
        user_id: pending.user_id,
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      });
    if (sessionError) throw sessionError;

    try {
      await syncAdminUserMirror({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        totp_secret: user.totp_secret,
        active: user.active,
      });
      const db = await getAdminDatabase();
      await db.run(
        "INSERT INTO activity_log (user_id, action, details) VALUES (?, 'admin.login', 'Staff member signed in')",
        [pending.user_id],
      );
    } catch (error) {
      const { error: rollbackError } = await supabase
        .from("admin_sessions")
        .delete()
        .eq("id", sessionId);
      if (rollbackError) console.error("Could not roll back admin session after activity log failure", rollbackError);
      throw error;
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 28800,
      path: "/",
    });
    response.cookies.delete(PENDING_COOKIE);
    return response;
  } catch (error) {
    console.error("Could not verify admin sign-in", error);
    return NextResponse.json({ error: "Could not verify sign-in. Please try again." }, { status: 500 });
  }
}
