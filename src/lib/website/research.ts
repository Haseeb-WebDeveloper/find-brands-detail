import { extractFacts, type PageFacts } from "@/lib/website/extract";
import { judgeSite, type FetchedPage, type SiteVerdict } from "@/lib/website/judge";
import type { SiteSuggestion } from "@/lib/website/discover";
import { noLog, type ResearchLog } from "@/lib/research/log-types";

/** The network, injected so the logic is tested with fakes and reused by the test-set runner. */
export type WebsiteDeps = {
  fetchPage(url: string): Promise<FetchedPage>;
  latestSnapshot(url: string): Promise<{ timestamp: string; page: FetchedPage } | null>;
  findOfficialSites(brand: string, log?: ResearchLog): Promise<SiteSuggestion[]>;
};

export type CheckedSite = {
  url: string;
  source: "hint" | "search" | "regional-link";
  verdict: SiteVerdict;
  facts: PageFacts | null;
  archive: { timestamp: string; facts: PageFacts } | null;
};

export type WebsiteResearch = { candidates: CheckedSite[]; chosen: CheckedSite | null };

const MAX_CANDIDATES = 4;
const MAX_REGIONAL = 3;
/** Rejections where the brand's older site may still tell us something via the Wayback Machine. */
const ARCHIVE_KINDS = new Set(["unreachable", "parked", "offline", "hijacked"]);

function normalize(url: string): string {
  const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  return `${u.origin}/`;
}

async function check(brand: string, url: string, source: CheckedSite["source"], deps: WebsiteDeps, log: ResearchLog): Promise<CheckedSite> {
  await log(`Opening ${hostOf(url)}…`);
  const page = await deps.fetchPage(url);
  const verdict = judgeSite(page, brand);
  await log(`${hostOf(url)}: ${verdict.reason}`, verdict.score === "proven" ? "good" : "warn");
  const facts = verdict.score !== "rejected" && page.html ? extractFacts(page.html, page.finalUrl ?? url, brand) : null;
  let archive: CheckedSite["archive"] = null;
  // Archive facts are evidence only: they never improve the verdict (Global Constraints).
  if (verdict.score === "rejected" && ARCHIVE_KINDS.has(verdict.kind)) {
    const snap = await deps.latestSnapshot(url);
    if (snap) {
      archive = { timestamp: snap.timestamp, facts: extractFacts(snap.page.html, url, brand) };
      await log(`Read the Wayback Machine copy of ${hostOf(url)} from ${snap.timestamp.slice(0, 4)} for clues.`);
    }
  }
  return { url, source, verdict, facts, archive };
}

/** Hangul syllables or jamo: a Korean-language page. */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

/**
 * Which market a site serves. The page language decides first (a Korean or Japanese page is not
 * the global site, whatever its domain), then the host. English, or no stated language on a
 * generic domain, is global.
 */
export function siteRegion(site: CheckedSite): "global" | "us" | "kr" | "other" {
  let host = "";
  try {
    host = new URL(site.verdict.siteUrl).hostname.toLowerCase();
  } catch {
    host = site.url.toLowerCase();
  }
  const lang = site.facts?.lang ?? null;
  if (lang === "ko" || host.endsWith(".kr") || HANGUL.test(site.facts?.title ?? "")) return "kr";
  if (lang && lang !== "en") return "other";
  if (host.endsWith(".us") || host.startsWith("us.") || /(^|[.-])usa?([.-]|$)/.test(host.split(".").slice(0, -1).join("."))) return "us";
  // A country-code domain that isn't US or Korean (".jp", ".pl", ".co.uk") serves that country.
  const tld = host.split(".").pop() ?? "";
  if (tld.length === 2 && tld !== "us") return "other";
  return "global";
}

const REGION_RANK = { global: 0, us: 1, kr: 2, other: 3 } as const;

const REGION_WORD = { global: "global site", us: "US site", kr: "Korean site", other: "regional site" } as const;

/** The host for a log line: "tirtir.co.kr", not the whole URL. */
function hostOf(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Proven beats needs-a-look; within proven, the global site beats the US site beats the Korean one
 * beats any other country's — the same "global account first" rule as Instagram (spec §7). Ties
 * keep discovery order.
 */
export function chooseSite(candidates: CheckedSite[]): CheckedSite | null {
  const proven = candidates.filter((c) => c.verdict.score === "proven");
  if (proven.length > 0) {
    return proven.reduce((best, c) => (REGION_RANK[siteRegion(c)] < REGION_RANK[siteRegion(best)] ? c : best));
  }
  return candidates.find((c) => c.verdict.score === "review") ?? null;
}

export async function researchWebsite(brand: string, hint: string | null, deps: WebsiteDeps, log: ResearchLog = noLog): Promise<WebsiteResearch> {
  const candidates: CheckedSite[] = [];
  const seen = new Set<string>();
  // One at a time, never in parallel: politeness to each site (Global Constraints).
  const add = async (url: string, source: CheckedSite["source"]) => {
    const key = normalize(url);
    if (seen.has(key) || candidates.length >= MAX_CANDIDATES + MAX_REGIONAL) return;
    seen.add(key);
    candidates.push(await check(brand, key, source, deps, log));
  };

  if (hint) {
    await log(`Starting with the website given: ${hostOf(hint)}.`);
    await add(hint, "hint");
  } else {
    await log("No website was given, so searching for it.");
  }
  // No usable hint: ask Gemini. A hint that is proven or in review is trusted on its own.
  if (!candidates.some((c) => c.verdict.score !== "rejected")) {
    const found = (await deps.findOfficialSites(brand, log)).slice(0, MAX_CANDIDATES);
    if (found.length > 0) await log(`Search suggested ${found.map((s) => hostOf(s.url)).join(", ")}.`);
    for (const s of found) await add(s.url, "search");
  }

  const chosen = chooseSite(candidates);
  const regional = (chosen?.facts?.regionalSites ?? []).slice(0, MAX_REGIONAL);
  if (regional.length > 0) await log(`The site links to other brand sites: ${regional.map(hostOf).join(", ")}.`);
  for (const url of regional) await add(url, "regional-link");

  const final = chooseSite(candidates);
  await log(
    final
      ? `Website: ${hostOf(final.verdict.siteUrl)} (${REGION_WORD[siteRegion(final)]}${final.verdict.score === "proven" ? "" : ", needs a look"}).`
      : "No official website found. Needs a look.",
    final?.verdict.score === "proven" ? "good" : "warn",
  );
  return { candidates, chosen: final };
}
