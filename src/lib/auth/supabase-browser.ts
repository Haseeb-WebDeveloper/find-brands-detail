"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/auth/config";

/**
 * The browser-side Supabase client.
 *
 * Used for exactly two things: asking for a magic link, and signing out. It is deliberately not a
 * data client — nothing in the browser reads a table. Anything a signed-in page needs comes from a
 * server component that already proved who is asking.
 *
 * `createBrowserClient` memoises internally, so calling this per component is cheap and each caller
 * still gets a client wired to the same session storage.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
