import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@backend/lib/admin-auth";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  if (sessionId) {
    try {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("admin_sessions").delete().eq("id", sessionId);
      if (error) throw error;
    } catch (error) {
      console.error("Could not revoke admin session", error);
      return NextResponse.json({ error: "Could not complete sign-out." }, { status: 500 });
    }
  }
  return response;
}
