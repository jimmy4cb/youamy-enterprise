import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const isAdmin = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/");
  const isLogin = request.nextUrl.pathname === "/admin/login";

  if (isAdmin && !isLogin && !request.cookies.get("yel_admin_session")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (isLogin && request.cookies.get("yel_admin_session")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
