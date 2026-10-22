import type { ImageCheckResult } from "@/lib/images/check-image";
import { collectImages, type ImageLead, type ImagesInput } from "@/lib/images/collect";
import { linkExpiry } from "@/lib/images/expiry";
import { chooseImage, scoreImage, type ImageCandidate, type ImageVerdict } from "@/lib/images/score";
import { rankCoverHits, type ImageHit } from "@/lib/images/search";
import { domainMatchesBrand, registrableDomain } from "@/lib/website/domain";
import { noLog, type ResearchLog } from "@/lib/research/log-types";

/** The network, injected so the logic is tested with fakes. */
export type ImagesDeps = {
  checkImage(url: string, slot: "logo" | "cover"): Promise<ImageCheckResult>;
  /** Free image search (lib/images/search.ts), for a cover the brand's own pages don't give. */
  searchImages(query: string, options: { wide?: boolean }): Promise<{ hits: ImageHit[]; engine: string | null }>;
};
export type Scored = { scored: { candidate: ImageCandidate; verdict: ImageVerdict }[]; chosen: ImageCandidate | null };

const WORD = { logo: "Logo", cover: "Cover" } as const;
/** Image-search results checked for a cover: the best few by the rules in rankCoverHits. */
const SEARCH_CHECKS = 4;

export async function researchImages(input: ImagesInput, deps: ImagesDeps, log: ResearchLog = noLog, now = new Date()): Promise<{ logo: Scored; cover: Scored }> {
  const leads = collectImages(input);
  const result: { logo: Scored; cover: Scored } = { logo: { scored: [], chosen: null }, cover: { scored: [], chosen: null } };
  const owned = (url: string) => {
    try {
      const h = new URL(url).hostname;
      return input.brandDomains.includes(registrableDomain(h)) || domainMatchesBrand(h, input.brand);
    } catch {
      return false;
    }
  };
  // One at a time: politeness to each host (Global Constraints).
  const check = async (slot: "logo" | "cover", list: ImageLead[]) => {
    for (const lead of list) {
      const checked = await deps.checkImage(lead.url, slot);
      const candidate: ImageCandidate = { ...lead, check: checked, expiresAt: linkExpiry(lead.url) };
      result[slot].scored.push({ candidate, verdict: scoreImage(candidate, now) });
    }
  };

  for (const slot of ["logo", "cover"] as const) {
    const mine = leads.filter((l) => l.slot === slot);
    await log(
      mine.length > 0 ? `Checking ${mine.length} possible ${slot} image${mine.length === 1 ? "" : "s"}…` : `No ${slot} image found on the brand's sites or profiles.`,
      mine.length > 0 ? "info" : "warn",
    );
    await check(slot, mine);

    // No usable cover from the brand's pages: a wide image search (free, no AI).
    if (slot === "cover" && !result.cover.scored.some((s) => s.verdict.score !== "rejected")) {
      const { hits, engine } = await deps.searchImages(`${input.brand} campaign banner`, { wide: true });
      const ranked = rankCoverHits(hits, input.brand, owned, SEARCH_CHECKS).filter((h) => !mine.some((l) => l.url === h.url));
      await log(
        engine ? `Searched ${engine} for a wide ${input.brand} image: ${ranked.length} of ${hits.length} result${hits.length === 1 ? "" : "s"} name the brand.` : "Couldn't search images for a cover.",
        engine ? "info" : "warn",
      );
      await check(
        "cover",
        ranked.map((h) => {
          let label = h.page;
          try {
            label = new URL(h.page).hostname.replace(/^www\./, "");
          } catch {
            // Keep the raw address as the label.
          }
          return { slot: "cover", url: h.url, source: { kind: owned(h.page) || owned(h.url) ? "site" : "third_party", label } };
        }),
      );
    }

    const chosen = chooseImage(result[slot].scored);
    result[slot].chosen = chosen;
    const verdict = result[slot].scored.find((s) => s.candidate === chosen)?.verdict;
    const rejected = result[slot].scored.filter((s) => s.verdict.score === "rejected").length;
    if (rejected > 0) await log(`${rejected} ${slot} image${rejected === 1 ? " was" : "s were"} too small, not landscape, or not an image.`);
    await log(
      chosen && verdict ? `${WORD[slot]}: ${verdict.reason}${verdict.score === "proven" ? "" : " Needs a look."}` : `No usable ${slot} image. Needs a look.`,
      verdict?.score === "proven" ? "good" : "warn",
    );
  }
  return result;
}
