import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { authConfigured } from "@/lib/auth/config";

/**
 * Who is signed in, verified.
 *
 * `getClaims()`, NOT `getSession()`, and not `getUser()`.
 *
 *   getSession()  reads the cookie and believes it. Supabase's own documentation says never to trust
 *                 it in server code, because the cookie is attacker-supplied storage.
 *   getUser()     is trustworthy but costs a round trip to the auth server on every call.
 *   getClaims()   verifies the JWT's signature against the project's published signing keys, so it
 *                 is both trustworthy and local.
 *
 * Wrapped in React `cache()` for the same reason `isAuthenticated` was: a single render asks who is
 * signed in from the layout, the page, and any server action underneath it. Without the memo that is
 * three verifications per request, and the number only grows as the dashboard does.
 *
 * Returns null rather than throwing on every failure path — no keys configured, no cookie, an expired
 * or tampered token all mean the same thing to a caller: nobody is signed in. Fail closed, quietly.
 */
export const currentSession = cache(async (): Promise<AuthSession | null> => {
  /**
   * READ THE COOKIES FIRST, UNCONDITIONALLY. This line looks redundant — `createSupabaseServerClient`
   * awaits `cookies()` itself — and it is not.
   *
   * `cookies()` is what tells Next this request cannot be prerendered. With the early return below
   * placed above it, a build with the Supabase keys unset never reached a dynamic API at all, so
   * `cacheComponents` happily prerendered `/office` and `/admin` as fully static — baking in the
   * `redirect("/login")` that an unauthenticated prerender produces. Every signed-in visitor would
   * have been bounced to the login page by a cached redirect, on a build that passed every check.
   *
   * Whether a route is dynamic must not depend on whether an environment variable happens to be set.
   */
  await cookies();

  if (!authConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;

    const { sub, email } = data.claims;
    if (typeof sub !== "string" || !sub) return null;

    return { userId: sub, email: typeof email === "string" ? email : null };
  } catch (error) {
    // A verification failure is a signed-out user, not a 500. Logged because a *persistent* one means
    // the signing keys or the project URL are wrong, which no visitor can tell us about.
    console.error("[auth] claim verification failed:", error);
    return null;
  }
});

/** The verified identity behind a request. Deliberately minimal — roles come from our own tables. */
export type AuthSession = {
  /** `auth.users.id`, and therefore also `users.id` — the join key for everything we own. */
  userId: string;
  email: string | null;
};
