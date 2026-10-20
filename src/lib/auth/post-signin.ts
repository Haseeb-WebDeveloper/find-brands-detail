import "server-only";
import type { Session } from "@supabase/supabase-js";
import { claimAccess } from "@/lib/auth/pending-access";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { safeNext } from "@/lib/auth/safe-next";

/** Where a fresh session goes: claim any invitation, then the requested page or /batches. */
export async function destinationAfterSignIn(session: Session | null, requested: string | null): Promise<string> {
  if (!session) return "/login?error=link";
  const access = await claimAccess({ userId: session.user.id, email: session.user.email ?? null });
  if (access === "none") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return "/login?error=access";
  }
  return safeNext(requested);
}
