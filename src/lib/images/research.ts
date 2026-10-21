import type { ImageCheckResult } from "@/lib/images/check-image";
import { collectImages, type ImagesInput } from "@/lib/images/collect";
import { linkExpiry } from "@/lib/images/expiry";
import { chooseImage, scoreImage, type ImageCandidate, type ImageVerdict } from "@/lib/images/score";
import { noLog, type ResearchLog } from "@/lib/research/log-types";

/** The network, injected so the logic is tested with fakes. */
export type ImagesDeps = { checkImage(url: string, slot: "logo" | "cover"): Promise<ImageCheckResult> };
export type Scored = { scored: { candidate: ImageCandidate; verdict: ImageVerdict }[]; chosen: ImageCandidate | null };

const WORD = { logo: "Logo", cover: "Cover" } as const;

export async function researchImages(input: ImagesInput, deps: ImagesDeps, log: ResearchLog = noLog, now = new Date()): Promise<{ logo: Scored; cover: Scored }> {
  const leads = collectImages(input);
  const result: { logo: Scored; cover: Scored } = { logo: { scored: [], chosen: null }, cover: { scored: [], chosen: null } };
  for (const slot of ["logo", "cover"] as const) {
    const mine = leads.filter((l) => l.slot === slot);
    await log(
      mine.length > 0 ? `Checking ${mine.length} possible ${slot} image${mine.length === 1 ? "" : "s"}…` : `No ${slot} image found on the brand's sites or profiles.`,
      mine.length > 0 ? "info" : "warn",
    );
    // One at a time: politeness to each host (Global Constraints).
    for (const lead of mine) {
      const check = await deps.checkImage(lead.url, slot);
      const candidate: ImageCandidate = { ...lead, check, expiresAt: linkExpiry(lead.url) };
      result[slot].scored.push({ candidate, verdict: scoreImage(candidate, now) });
    }
    const chosen = chooseImage(result[slot].scored);
    result[slot].chosen = chosen;
    const verdict = result[slot].scored.find((s) => s.candidate === chosen)?.verdict;
    const rejected = result[slot].scored.filter((s) => s.verdict.score === "rejected").length;
    if (rejected > 0) await log(`${rejected} ${slot} image${rejected === 1 ? " was" : "s were"} too small or not an image.`);
    await log(
      chosen && verdict ? `${WORD[slot]}: ${verdict.reason}${verdict.score === "proven" ? "" : " Needs a look."}` : `No usable ${slot} image. Needs a look.`,
      verdict?.score === "proven" ? "good" : "warn",
    );
  }
  return result;
}
