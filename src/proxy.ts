import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/auth/supabase-proxy";

/**
 * Keeps the Supabase session fresh and sends signed-out visitors to /login. It is NOT the
 * authorization boundary: pages and actions re-check membership through src/lib/auth/scope.ts.
 */
const PUBLIC_PREFIXES = ["/login", "/auth/", "/api/inngest"];

export async function proxy(request: NextRequest) {
  const { response, hasSession } = await refreshSession(request);
  const { pathname, search } = request.nextUrl;

  if (hasSession || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return response;
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
