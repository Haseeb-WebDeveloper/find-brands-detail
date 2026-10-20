import type { PageFacts } from "@/lib/website/extract";
import type { Discovery } from "@/lib/instagram/discovery";
import { GLOBAL_SUFFIXES, nameVariants } from "@/lib/instagram/variants";
import { chooseInstagram, scoreInstagram, type IgCandidate, type IgVerdict } from "@/lib/instagram/score";

/** The network, injected so the logic is tested with fakes and reused by the test-set runner. */
export type InstagramDeps = {
  lookupBusiness(username: string): Promise<Discovery>;
  fetchBadge(username: string): Promise<boolean | null>;
  checkBioLink(website: string | null, domains: string[], brand: string): Promise<{ reached: string | null; via: string | null }>;
};

type Region = "global" | "us" | "kr" | "other";
export type InstagramInput = { brand: string; pages: { url: string; region: Region; facts: PageFacts }[]; brandDomains: string[] };
export type InstagramResearch = { scored: { candidate: IgCandidate; verdict: IgVerdict }[]; chosen: IgCandidate | null };

const MAX_LOOKUPS = 8;

export async function researchInstagram(input: InstagramInput, deps: InstagramDeps): Promise<InstagramResearch> {
  const linked = new Map<string, IgCandidate["foundOn"]>();
  for (const page of input.pages) {
    for (const h of page.facts.instagram ?? []) {
      const handle = h.toLowerCase();
      linked.set(handle, [...(linked.get(handle) ?? []), { url: page.url, region: page.region }]);
    }
  }

  const candidates: IgCandidate[] = [];
  const seen = new Set<string>();
  const look = async (handle: string, foundOn: IgCandidate["foundOn"]) => {
    if (seen.has(handle) || seen.size >= MAX_LOOKUPS) return;
    seen.add(handle);
    // Sequential on purpose: Meta's hourly limit (Global Constraints).
    const discovery = await deps.lookupBusiness(handle);
    let verified: boolean | null = null;
    let bio: IgCandidate["bio"] = { reached: null, via: null };
    if (discovery.ok) {
      verified = await deps.fetchBadge(handle);
      bio = await deps.checkBioLink(discovery.profile.website, input.brandDomains, input.brand);
    }
    candidates.push({ handle, foundOn, discovery, verified, bio });
  };

  for (const [handle, foundOn] of linked) await look(handle, foundOn);
  // Name variants: all of them when no linked handle is a business account; only the global forms
  // when the sites link nothing but regional accounts (TIRTIR's Korean site links @tirtir_official).
  const accepted = candidates.filter((c) => c.discovery.ok);
  const variants =
    accepted.length === 0 ? nameVariants(input.brand)
    : accepted.some((c) => c.foundOn.some((f) => f.region === "global")) ? []
    : nameVariants(input.brand, GLOBAL_SUFFIXES);
  for (const handle of variants) await look(handle, linked.get(handle) ?? []);

  const maxFollowers = Math.max(0, ...candidates.map((c) => (c.discovery.ok ? c.discovery.profile.followers : 0)));
  const scored = candidates.map((candidate) => ({ candidate, verdict: scoreInstagram(candidate, maxFollowers) }));
  return { scored, chosen: chooseInstagram(scored) };
}
