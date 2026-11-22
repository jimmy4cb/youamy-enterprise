import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@backend/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = request.nextUrl.searchParams.get("next") || "/checkout";
  const safeNextPath = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/checkout";
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNextPath, request.url));
  }
  return NextResponse.redirect(new URL("/sign-in?error=callback", request.url));
}
