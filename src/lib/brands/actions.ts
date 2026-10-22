"use server";

import { revalidatePath } from "next/cache";
import { getTeamScope, scopeCan } from "@/lib/auth/scope";
import { queueAiFill, resetForRetry } from "@/lib/brands/store";
import { aiAvailable } from "@/lib/ai/models";
import { inngest } from "@/lib/inngest/client";
import { brandAiFillEvent, brandResearchEvent } from "@/lib/inngest/events";

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

/**
 * "Fill in missing AI parts" for one brand or a whole batch: only the campaigns (when a brand has none)
 * and empty details, for researched brands not yet reviewed. Everything else stays.
 */
export async function fillMissingAi(target: { brandId: string } | { batchId: string }): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return { ok: false, error: "You can't start research." };
  const id = "brandId" in target ? target.brandId : target.batchId;
  if (!UUID.test(id)) return { ok: false, error: "That doesn't exist." };
  if (!aiAvailable()) return { ok: false, error: "No AI key is set up, so there's nothing to fill them in with." };
  const { ids, batchIds } = await queueAiFill(scope, target);
  if (ids.length === 0) return { ok: false, error: "Nothing is missing that the AI can fill in." };
  try {
    await inngest.send(ids.map(brandAiFillEvent));
  } catch (error) {
    console.error("[brands] could not queue the AI fill", error);
    return { ok: false, error: "It couldn't start. Try again in a minute." };
  }
  for (const b of ids) revalidatePath(`/brands/${b}`);
  for (const b of batchIds) revalidatePath(`/batches/${b}`);
  return { ok: true, count: ids.length };
}
