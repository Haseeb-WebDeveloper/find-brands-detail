import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/auth/config";

/**
 * A Supabase client bound to THIS request's cookies.
 *
 * A NEW ONE PER REQUEST, never a module singleton. On the server the client is essentially a
 * configured `fetch` closed over one request's cookie jar; sharing it across requests would mean
 * serving one visitor's session to another — the single worst bug available in this file.
 *
 * WHAT THIS CLIENT IS FOR, AND ONLY THIS. The auth handshake and reading who is signed in. It never
 * reads or writes application data — every table we own goes through Drizzle behind the scoped data
 * layer (`lib/auth/scope.ts`). Two query paths into the same database, each able to see different
 * rows, is how a tenant leak gets written by accident.
 */
/**
 * Forget this host's session by deleting its cookies, and NOTHING ELSE.
 *
 * NEVER `supabase.auth.signOut({ scope: "local" })` for this. "Local" reads like "cookies only" and
 * is not: auth-js calls `admin.signOut(accessToken, scope)` for every scope, which POSTs to GoTrue's
 * `/logout` and **revokes that session server-side**. The broker used it to drop its own copy after
 * handing a session on, and so destroyed the session it had just sealed into the handoff — the
 * target host redeemed a perfectly valid-looking pair of tokens and got `session_not_found` back
 * from `/auth/v1/user`, which auth-js reports as the thoroughly misleading "Auth session missing!".
 *
 * Two callers need exactly this and only this: the broker after a handoff, and a superadmin ending
 * impersonation on a client's host. Both are dropping a DUPLICATE of a session that must stay alive
 * somewhere else.
 *
 * Matching on the name rather than reconstructing `sb-<projectRef>-auth-token` because `@supabase/ssr`
 * chunks large cookies into `.0`, `.1` … and a missed chunk leaves a half-session behind.
 */
export async function forgetLocalSession(): Promise<void> {
  const jar = await cookies();
  for (const { name } of jar.getAll()) {
    if (name.startsWith("sb-") && name.includes("auth-token")) jar.delete(name);
  }
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Thrown when called from a Server Component, which cannot write cookies. Not an error:
          // `proxy.ts` refreshes the session on the way in, so the tokens are already current by the
          // time any component renders. Swallowing it here is what lets one client work in both
          // places — see the proxy's docblock.
        }
      },
    },
  });
}
