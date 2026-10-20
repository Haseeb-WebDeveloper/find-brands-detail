import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/auth/config";

/**
 * Keep the session alive, and say whether there is one.
 *
 * WHY THIS HAS TO EXIST AT ALL. Supabase access tokens are short-lived and refresh by writing new
 * cookies. Server Components cannot write cookies, so a refresh attempted during render is silently
 * dropped (`lib/auth/supabase-server.ts` swallows exactly that) and the session would expire mid-use.
 * Something upstream of rendering has to do it, and the proxy is the only thing there.
 *
 * WHAT THIS IS NOT. It is not the authorization check. Next 16's guidance and Supabase's own
 * documentation agree: the proxy is a UX and session-lifecycle layer, and a cookie-shaped check at
 * the edge is not a security boundary. Every real decision happens below — the layout, the page, the
 * server action and the scoped data layer. The `hasSession` flag returned here is used for one thing
 * only: bouncing a signed-out visitor to the login form so they don't watch a shell render first.
 *
 * The response-rebuilding dance in `setAll` is Supabase's documented pattern, and the ordering
 * matters: the refreshed cookies must land on BOTH the onward request (so the render sees them) and
 * the outgoing response (so the browser keeps them).
 */
export async function refreshSession(
  request: NextRequest,
): Promise<{ response: NextResponse; hasSession: boolean }> {
  let response = NextResponse.next({ request });

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { response, hasSession: false };
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    // Verifies the JWT's signature and refreshes it when due. `getClaims`, not `getSession`, for the
    // reason given in `lib/auth/session.ts` — a cookie is attacker-supplied storage.
    const { data } = await supabase.auth.getClaims();
    return { response, hasSession: Boolean(data?.claims?.sub) };
  } catch {
    // A refresh failure means "signed out" to everyone downstream. It must never be a 500: the proxy
    // sits in front of the login page too, and failing there would make the site unrecoverable.
    return { response, hasSession: false };
  }
}
