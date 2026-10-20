import type { PageFacts } from "@/lib/website/extract";
import type { Discovery } from "@/lib/instagram/discovery";
import { GLOBAL_SUFFIXES, nameVariants } from "@/lib/instagram/variants";
import { chooseInstagram, scoreInstagram, type IgCandidate, type IgVerdict } from "@/lib/instagram/score";
import { noLog, type ResearchLog } from "@/lib/research/log-types";

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
const handles = (list: string[]) => list.map((h) => `@${h}`).join(", ");

/** One line about an account, as the person watching would want it. */
function describe(c: IgCandidate): string {
  if (!c.discovery.ok) return `@${c.handle}: ${c.discovery.message}`;
  const p = c.discovery.profile;
  return [
    `@${c.handle}: business account, ${p.followers.toLocaleString("en-US")} followers`,
    c.verified === true ? "verified badge" : null,
    c.bio.reached ? `bio link reaches ${c.bio.reached}` : p.website ? "bio link doesn't reach the brand" : "no bio link",
  ]
    .filter(Boolean)
    .join(" · ");
}

export async function researchInstagram(input: InstagramInput, deps: InstagramDeps, log: ResearchLog = noLog): Promise<InstagramResearch> {
  const linked = new Map<string, IgCandidate["foundOn"]>();
  for (const page of input.pages) {
    for (const h of page.facts.instagram ?? []) {
      const handle = h.toLowerCase();
      linked.set(handle, [...(linked.get(handle) ?? []), { url: page.url, region: page.region }]);
    }
  }
  await log(linked.size > 0 ? `The brand's sites link ${handles([...linked.keys()])}.` : "The brand's sites link no Instagram account.");

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
    const candidate = { handle, foundOn, discovery, verified, bio };
    candidates.push(candidate);
    await log(describe(candidate), discovery.ok ? "info" : "warn");
  };

  for (const [handle, foundOn] of linked) await look(handle, foundOn);
  // Name variants: all of them when no linked handle is a business account; only the global forms
  // when the sites link nothing but regional accounts (TIRTIR's Korean site links @tirtir_official).
  const accepted = candidates.filter((c) => c.discovery.ok);
  const variants =
    accepted.length === 0
      ? nameVariants(input.brand)
      : accepted.some((c) => c.foundOn.some((f) => f.region === "global"))
        ? []
        : nameVariants(input.brand, GLOBAL_SUFFIXES);
  const toTry = variants.filter((h) => !seen.has(h)).slice(0, MAX_LOOKUPS - seen.size);
  if (toTry.length > 0) {
    await log(accepted.length === 0 ? `Trying likely names: ${handles(toTry)}.` : `Checking for a global account: ${handles(toTry)}.`);
  }
  for (const handle of toTry) await look(handle, linked.get(handle) ?? []);

  const maxFollowers = Math.max(0, ...candidates.map((c) => (c.discovery.ok ? c.discovery.profile.followers : 0)));
  const scored = candidates.map((candidate) => ({ candidate, verdict: scoreInstagram(candidate, maxFollowers) }));
  const chosen = chooseInstagram(scored);
  const verdict = scored.find((s) => s.candidate === chosen)?.verdict;
  await log(
    chosen && verdict
      ? `Instagram: @${chosen.handle}. ${verdict.reason}${verdict.score === "proven" ? "" : " Needs a look."}`
      : "No Instagram account found. Needs a look.",
    verdict?.score === "proven" ? "good" : "warn",
  );
  return { scored, chosen };
}
