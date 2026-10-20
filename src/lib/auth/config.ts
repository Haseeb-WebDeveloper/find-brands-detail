/**
 * Supabase Auth configuration — the two public values, read once.
 *
 * Both are referenced as literal `process.env.NEXT_PUBLIC_…` member expressions because that is what
 * Next inlines at build time; a dynamic lookup would come back undefined in the browser bundle.
 *
 * WHY THESE ARE SAFE IN THE BUNDLE. The publishable key (older dashboards call it the anon key)
 * carries no privileges of its own — it identifies the project, and every request it makes is gated
 * by the signed-in user's own token. The service-role key, which bypasses row-level security
 * entirely, is a different class of credential and is deliberately absent from this codebase. See
 * the block in `.env.example`.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Whether sign-in is possible at all in this environment.
 *
 * Unset means NOBODY CAN SIGN IN, which is the safe default and mirrors how `ADMIN_PASSWORD` used to
 * behave — a fresh clone or a preview build without the keys refuses everyone rather than falling
 * open. The login page reads this to explain itself instead of failing with a Supabase stack trace.
 */
export function authConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}
