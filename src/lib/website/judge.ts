import { compactName, domainMatchesBrand, registrableDomain } from "@/lib/website/domain";

export type FetchedPage = {
  requestedUrl: string;
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  html: string;
  error: string | null;
  elapsedMs: number;
};

export type SiteKind = "ok" | "name_missing" | "unreachable" | "server_error" | "parked" | "offline" | "hijacked" | "blocked";

export type SiteVerdict = { score: "proven" | "review" | "rejected"; kind: SiteKind; reason: string; siteUrl: string };

/** Under this many bytes a 200 is not a real page (leadforge's MIN_REAL_PAGE_BYTES). */
const MIN_REAL_PAGE_BYTES = 2_000;

const PARKED = [
  /window\.location(\.href)?\s*=\s*["']\/lander["']/i,
  /this domain (may be|is) for sale/i,
  /domain is for sale/i,
  /buy (this|the) domain/i,
  /hugedomains|sedoparking|parkingcrew|bodis\.com|afternic|dan\.com\/|above\.com|parklogic/i,
];

const OFFLINE = [/this store is unavailable/i, /store is temporarily unavailable/i, /site (is )?not (found|available)/i];

const CHALLENGE = [/just a moment\.\.\./i, /attention required!? \| cloudflare/i, /cf-chl/i, /captcha/i, /access denied/i];

function origin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function namesBrand(html: string, brand: string): boolean {
  return compactName(html).includes(compactName(brand));
}

/**
 * Spec §7, Website. The order matters: a page that doesn't load, or that has been handed to
 * someone else, is decided before anything is read from it; a parked or offline page can mention
 * the brand (it's the brand's old domain) and must still be rejected.
 */
export function judgeSite(page: FetchedPage, brand: string): SiteVerdict {
  const requested = origin(page.requestedUrl);

  if (!page.ok && page.status === null) {
    return {
      score: "rejected",
      kind: "unreachable",
      reason: `Doesn't load${page.error ? ` (${page.error})` : ""}.`,
      siteUrl: requested,
    };
  }

  const final = page.finalUrl ?? page.requestedUrl;
  const finalHost = hostOf(final);
  const sameSite = registrableDomain(finalHost) === registrableDomain(hostOf(page.requestedUrl));
  if (!sameSite && !domainMatchesBrand(finalHost, brand)) {
    return {
      score: "rejected",
      kind: "hijacked",
      reason: `Redirects to an unrelated site (${registrableDomain(finalHost)}) — the domain is no longer the brand's.`,
      siteUrl: requested,
    };
  }
  const siteUrl = origin(final);

  if (PARKED.some((re) => re.test(page.html))) {
    return { score: "rejected", kind: "parked", reason: "Parked or for sale — not the brand's site.", siteUrl };
  }
  if (OFFLINE.some((re) => re.test(page.html))) {
    return { score: "rejected", kind: "offline", reason: "Shows a store-unavailable page.", siteUrl };
  }
  if (page.status !== null && [202, 401, 403, 429, 503].includes(page.status) && CHALLENGE.some((re) => re.test(page.html))) {
    return { score: "review", kind: "blocked", reason: "Blocked by a bot check — couldn't verify it automatically.", siteUrl };
  }
  if (page.status !== null && page.status >= 500) {
    return namesBrand(page.html, brand) && page.html.length >= MIN_REAL_PAGE_BYTES
      ? { score: "review", kind: "server_error", reason: `Answers with an error (${page.status}) but shows the brand.`, siteUrl }
      : { score: "rejected", kind: "server_error", reason: `Answers with an error (${page.status}).`, siteUrl };
  }
  if (page.html.length < MIN_REAL_PAGE_BYTES && !namesBrand(page.html, brand)) {
    return { score: "rejected", kind: "parked", reason: "Loads an almost empty page — likely parked.", siteUrl };
  }
  if (!namesBrand(page.html, brand)) {
    return { score: "review", kind: "name_missing", reason: "Loads, but the page never names the brand.", siteUrl };
  }
  return { score: "proven", kind: "ok", reason: "Loads and names the brand.", siteUrl };
}
