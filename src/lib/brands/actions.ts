"use server";

import { revalidatePath } from "next/cache";
import { getTeamScope, scopeCan } from "@/lib/auth/scope";
import { resetForRetry } from "@/lib/brands/store";
import { inngest } from "@/lib/inngest/client";
import { brandResearchEvent } from "@/lib/inngest/events";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Runs the whole research job again for one brand. Safe to repeat: each step replaces its results. */
export async function retryResearch(brandId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return { ok: false, error: "You can't start research." };
  if (!UUID.test(brandId)) return { ok: false, error: "That brand doesn't exist." };
  const brand = await resetForRetry(scope, brandId);
  if (!brand) return { ok: false, error: "That brand doesn't exist." };
  try {
    await inngest.send(brandResearchEvent(brandId));
  } catch (error) {
    console.error("[brands] could not queue research again", error);
    return { ok: false, error: "Research couldn't restart. Try again in a minute." };
  }
  revalidatePath(`/brands/${brandId}`);
  revalidatePath(`/batches/${brand.batchId}`);
  return { ok: true };
}
