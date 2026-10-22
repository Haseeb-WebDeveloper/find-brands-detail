"use server";

import { revalidatePath } from "next/cache";
import { getTeamScope, scopeCan } from "@/lib/auth/scope";
import { parseBatchInput } from "@/lib/batches/parse-input";
import { cleanBatchName } from "@/lib/batches/name";
import { createBatchWithBrands } from "@/lib/batches/store";
import { inngest } from "@/lib/inngest/client";
import { brandResearchEvent } from "@/lib/inngest/events";

/** `name` is what the reviewer typed, or the page's default (the date in their own time). */
export async function startBatch(text: string, name: string): Promise<{ ok: true; batchId: string } | { ok: false; error: string }> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return { ok: false, error: "You can't start research." };

  const { brands, errors } = parseBatchInput(text);
  if (errors.length > 0) return { ok: false, error: errors.join("\n") };
  if (brands.length === 0) return { ok: false, error: "Paste at least one brand name." };

  const { batchId, brandIds } = await createBatchWithBrands(scope, brands, cleanBatchName(name));
  try {
    await inngest.send(brandIds.map(brandResearchEvent));
  } catch (error) {
    console.error("[batches] could not queue research", error);
    return { ok: false, error: "The batch was saved but research couldn't start. Try again in a minute." };
  }
  revalidatePath("/batches");
  return { ok: true, batchId };
}
