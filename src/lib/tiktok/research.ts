import type { PageFacts } from "@/lib/website/extract";
import type { TtLookup } from "@/lib/tiktok/profile";
import { GLOBAL_SUFFIXES, nameVariants } from "@/lib/instagram/variants";
import { chooseTiktok, sameLink, scoreTiktok, type TtCandidate, type TtVerdict } from "@/lib/tiktok/score";
import { noLog, type ResearchLog } from "@/lib/research/log-types";

/** The network, injected so the logic is tested with fakes and reused by the test-set runner. */
export type TiktokDeps = {
  lookupProfile(username: string): Promise<TtLookup>;
  readLinkPage(url: string): Promise<string[]>;
  checkBioLink(website: string | null, domains: string[], brand: string): Promise<{ reached: string | null; via: string | null }>;
};

type Region = "global" | "us" | "kr" | "other";
export type TiktokInput = {
  brand: string;
  pages: { url: string; region: Region; facts: PageFacts }[];
  brandDomains: string[];
  /** The brand's chosen Instagram account: its handle is a likely TikTok name, its bio page often lists TikTok. */
  instagram: { handle: string; website: string | null } | null;
};
export type TiktokResearch = { scored: { candidate: TtCandidate; verdict: TtVerdict }[]; chosen: TtCandidate | null };

const MAX_LOOKUPS = 8;
const handles = (list: string[]) => list.map((h) => `@${h}`).join(", ");
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** One line about an account, as the person watching would want it. */
function describe(c: TtCandidate): string {
  if (!c.lookup.ok) return `@${c.handle} on TikTok: ${c.lookup.message}`;
  const p = c.lookup.profile;
  return [
    `@${c.handle} on TikTok: ${p.followers.toLocaleString("en-US")} followers`,
    p.verified ? "verified badge" : null,
    p.private ? "private account" : null,
    c.bio.reached ? `bio link reaches ${c.bio.reached}` : c.sameBioAsInstagram ? "same bio link as Instagram" : p.bioLink ? "bio link doesn't reach the brand" : "no bio link",
  ]
    .filter(Boolean)
    .join(" · ");
}

export async function researchTiktok(input: TiktokInput, deps: TiktokDeps, log: ResearchLog = noLog): Promise<TiktokResearch> {
  const linked = new Map<string, TtCandidate["foundOn"]>();
  const link = (handle: string, at: TtCandidate["foundOn"][number]) => {
    const h = handle.toLowerCase();
    linked.set(h, [...(linked.get(h) ?? []), at]);
  };
  for (const page of input.pages) for (const h of page.facts.tiktok ?? []) link(h, { url: page.url, region: page.region, kind: "site" });
  await log(linked.size > 0 ? `The brand's sites link ${handles([...linked.keys()])} on TikTok.` : "The brand's sites link no TikTok account.");

  const igBio = input.instagram?.website ?? null;
  if (igBio) {
    const onBio = await deps.readLinkPage(igBio);
    // The chosen Instagram account is the global one, so its bio page counts as a global link.
    for (const h of onBio) link(h, { url: igBio, region: "global", kind: "instagram-bio" });
    await log(
      onBio.length > 0
        ? `The Instagram bio page (${host(igBio)}) links ${handles(onBio)} on TikTok.`
        : `The Instagram bio page (${host(igBio)}) links no TikTok account.`,
    );
  }

  const candidates: TtCandidate[] = [];
  const seen = new Set<string>();
  let blocked = false;
  const look = async (handle: string) => {
    if (seen.has(handle) || seen.size >= MAX_LOOKUPS) return;
    seen.add(handle);
    // Sequential on purpose: one TikTok request at a time (Global Constraints).
    const lookup = await deps.lookupProfile(handle);
    if (!lookup.ok && lookup.reason === "blocked") blocked = true;
    let bio: TtCandidate["bio"] = { reached: null, via: null };
    let sameBioAsInstagram = false;
    if (lookup.ok && lookup.profile.bioLink) {
      sameBioAsInstagram = sameLink(lookup.profile.bioLink, igBio);
      if (!sameBioAsInstagram) bio = await deps.checkBioLink(lookup.profile.bioLink, input.brandDomains, input.brand);
    }
    const candidate = { handle, foundOn: linked.get(handle) ?? [], lookup, bio, sameBioAsInstagram };
    candidates.push(candidate);
    await log(describe(candidate), lookup.ok ? "info" : "warn");
  };

  for (const handle of linked.keys()) await look(handle);
  // Names: the Instagram handle and the usual forms when nothing linked exists; only the global
  // forms when everything linked is regional. Never after TikTok has blocked a lookup.
  const accepted = candidates.filter((c) => c.lookup.ok);
  const names =
    accepted.length === 0
      ? [...(input.instagram ? [input.instagram.handle.toLowerCase()] : []), ...nameVariants(input.brand)]
      : accepted.some((c) => c.foundOn.some((f) => f.region === "global"))
        ? []
        : nameVariants(input.brand, GLOBAL_SUFFIXES);
  const toTry = blocked ? [] : [...new Set(names)].filter((h) => !seen.has(h)).slice(0, MAX_LOOKUPS - seen.size);
  if (toTry.length > 0) {
    await log(accepted.length === 0 ? `Trying likely TikTok names: ${handles(toTry)}.` : `Checking TikTok for a global account: ${handles(toTry)}.`);
  }
  for (const handle of toTry) {
    if (blocked) {
      await log("TikTok stopped answering, so the remaining names weren't tried.", "warn");
      break;
    }
    await look(handle);
  }

  const maxFollowers = Math.max(0, ...candidates.map((c) => (c.lookup.ok ? c.lookup.profile.followers : 0)));
  const scored = candidates.map((candidate) => ({ candidate, verdict: scoreTiktok(candidate, maxFollowers) }));
  const chosen = chooseTiktok(scored);
  const verdict = scored.find((s) => s.candidate === chosen)?.verdict;
  await log(
    chosen && verdict
      ? `TikTok: @${chosen.handle}. ${verdict.reason}${verdict.score === "proven" ? "" : " Needs a look."}`
      : "No TikTok account found. Needs a look.",
    verdict?.score === "proven" ? "good" : "warn",
  );
  return { scored, chosen };
}
