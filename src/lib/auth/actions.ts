"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authConfigured } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { hasPendingInvite, normalizeEmail } from "@/lib/auth/pending-access";
import { requestOrigin } from "@/lib/auth/origin";
import { safeNext } from "@/lib/auth/safe-next";
import { rateLimit } from "@/lib/rate-limit";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Always answers ok for a well-formed address, so the form can't be used to discover who has an
 * account. A new account can only be created when the email has a pending invitation.
 */
export async function requestMagicLink(email: string, next?: string): Promise<Result> {
  const address = normalizeEmail(email);
  if (!address || !address.includes("@") || address.length > 254) {
    return { ok: false, error: "That doesn't look like an email address." };
  }
  if (!authConfigured()) return { ok: false, error: "Sign-in isn't configured on this environment." };

  const h = await headers();
  const caller = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`login:${caller}`, 5);
  if (!limit.ok) return { ok: false, error: `Too many attempts. Try again in ${limit.retryAfterSeconds}s.` };

  const callback = new URL("/auth/callback", await requestOrigin());
  callback.searchParams.set("next", safeNext(next ?? null));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: await hasPendingInvite(address), emailRedirectTo: callback.toString() },
  });
  if (error) {
    console.error("[auth] magic link failed:", error.message);
    if (process.env.NODE_ENV === "development") return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
