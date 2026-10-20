# Brand Enrich — Step 2a: Website — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The research job's `website` and `crawl` steps find a brand's official site(s), judge each one (live, parked, hijacked, offline, bot-blocked, names the brand), fall back to the Wayback Machine when the live site is unusable, extract the facts later steps need (social handles, regional sites, logo and image candidates), and show it all on a clickable brand page.

**Architecture:** Pure functions do the thinking — `judgeSite` (verdict for a fetched page), `extractFacts` (cheerio over HTML), `parseCdx` / `parseSitesAnswer` (archive and AI answers) — and are unit-tested with inline HTML. Thin network functions (`fetchPage`, `latestSnapshot`, `findOfficialSites`) are injected into `researchWebsite`, which orchestrates without touching the database, so it is tested with fakes and reused by the test-set runner. `website-step.ts` persists results (candidates, selection, pages) and the Inngest job calls it.

**Tech Stack:** cheerio ^1.1.2, ai ^7.0.136 + @ai-sdk/google ^4.0.93 (Gemini with Google Search grounding), Prisma 7, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-brand-enrich-design.md` — §5 (`site-probe`, `site-crawl`, `archive`), §6 steps 1–2, §7 Website rules, §10 test set. Builds on the scaffold (`docs/superpowers/plans/2026-10-20-scaffold.md`, merged).

## Global Constraints

- All scaffold constraints still apply (`AGENTS.md`): Prisma server-side only; `import "server-only"` on server modules; no browser table reads; design tokens; commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Website verdicts exactly per spec §7: **proven** = loads, not parked/for sale, no redirect to another domain, names the brand; **review** = loads but brand not named, or several plausible domains, or blocked by a bot check; **rejected** = dead, parked, hijacked (reason shown).
- Every candidate stored with `source` and plain-words `evidence`; nothing selected without a source.
- Politeness: at most 4 website candidates per brand; one request at a time per domain; 15 s timeout; 2 MB body cap; browser user agent.
- Archive results are labelled `source: "archive"` and never scored better than `review`.
- New table → repeat the lockdown block in the same migration, then `pnpm verify:lockdown` (AGENTS.md rule 5).
- AI: Gemini only (`GOOGLE_GENERATIVE_AI_API_KEY`), model `gemini-2.5-flash`; no Claude.

## File Structure

```
src/lib/website/domain.ts            registrableDomain, compactName, nameTokens, domainMatchesBrand
src/lib/website/judge.ts             judgeSite — the §7 verdict for one fetched page
src/lib/website/extract.ts           extractFacts — social handles, regional sites, images, title
src/lib/website/fetch-page.ts        fetchPage — the one network fetch (timeout, cap, UA)
src/lib/website/archive.ts           parseCdx, snapshotUrl, latestSnapshot (Wayback)
src/lib/website/discover.ts          parseSitesAnswer, findOfficialSites (Gemini + Google Search)
src/lib/website/research.ts          researchWebsite — orchestration with injected deps, no DB
src/lib/research/website-step.ts     runWebsiteStep / runCrawlStep — persists via Prisma
src/lib/brands/scoped.ts             getBrandDetail(scope, id)
src/app/(app)/brands/[id]/{page,loading}.tsx   brand page (read-only website section)
prisma/schema.prisma                 + BrandPage model
prisma/migrations/*_brand_pages/     table + repeated lockdown
scripts/test-set.ts, tests/test-set.ts   website accuracy on the 16 audited brands
```

---

### Task 1: Domain and name helpers

**Files:**
- Create: `src/lib/website/domain.ts`, `src/lib/website/domain.test.ts`

**Interfaces:**
- Produces:
  - `registrableDomain(host: string): string` — eTLD+1 with common two-level suffixes (`co.kr`, `co.uk`, `com.au`, `co.jp`, `com.cn`, `com.tw`, `com.hk`, `co.nz`, `com.sg`, `com.br`, `co.id`, `com.my`, `co.th`, `com.vn`); strips `www.`; lowercase.
  - `compactName(text: string): string` — lowercase, accents removed (NFD), only `[a-z0-9]` kept. `"L'Oréal"` → `"loreal"`.
  - `nameTokens(brand: string): string[]` — the compact name, plus each word of ≥ 4 compact characters. `"Dr. Althea"` → `["dralthea", "althea"]`.
  - `domainMatchesBrand(host: string, brand: string): boolean` — the compacted registrable domain (hyphens removed) contains any token.

- [ ] **Step 1: Write the failing test `src/lib/website/domain.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { compactName, domainMatchesBrand, nameTokens, registrableDomain } from "@/lib/website/domain";

describe("registrableDomain", () => {
  it("keeps two labels for ordinary domains", () => {
    expect(registrableDomain("www.tirtir.global")).toBe("tirtir.global");
    expect(registrableDomain("us.numbuzin.com")).toBe("numbuzin.com");
  });

  it("keeps three labels for two-level suffixes", () => {
    expect(registrableDomain("www.dr-g.co.kr")).toBe("dr-g.co.kr");
    expect(registrableDomain("shop.brand.co.uk")).toBe("brand.co.uk");
  });
});

describe("names", () => {
  it("compacts accents and punctuation", () => {
    expect(compactName("L'Oréal Paris")).toBe("lorealparis");
    expect(compactName("AXIS-Y")).toBe("axisy");
  });

  it("tokens are the compact name plus long words", () => {
    expect(nameTokens("Dr. Althea")).toEqual(["dralthea", "althea"]);
    expect(nameTokens("Dr.G")).toEqual(["drg"]);
    expect(nameTokens("Dear, Klairs")).toEqual(["dearklairs", "dear", "klairs"]);
  });
});

describe("domainMatchesBrand", () => {
  it("matches brand domains", () => {
    expect(domainMatchesBrand("doctoraltheaglobal.com", "Dr. Althea")).toBe(true);
    expect(domainMatchesBrand("www.axis-y.com", "AXIS-Y")).toBe(true);
    expect(domainMatchesBrand("dr-g.co.kr", "Dr.G")).toBe(true);
    expect(domainMatchesBrand("klairscosmetics.com", "Dear, Klairs")).toBe(true);
  });

  it("rejects unrelated domains (the pyunkangyul.us hijack)", () => {
    expect(domainMatchesBrand("xoilaclivettbdu.tv", "Pyunkang Yul")).toBe(false);
  });
});
```

Run: `pnpm test src/lib/website/domain.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement `src/lib/website/domain.ts`**

```ts
const TWO_LEVEL_SUFFIXES = new Set([
  "co.kr", "or.kr", "co.uk", "com.au", "co.jp", "com.cn", "com.tw", "com.hk",
  "co.nz", "com.sg", "com.br", "co.id", "com.my", "co.th", "com.vn",
]);

/** eTLD+1, good enough for brand sites: a short list of two-level suffixes, not the full PSL. */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  return TWO_LEVEL_SUFFIXES.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
}

export function compactName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** The compact name, then each word of four or more compact characters ("Dr. Althea" → althea). */
export function nameTokens(brand: string): string[] {
  const words = brand.split(/[\s,.&/'’-]+/).map(compactName).filter((w) => w.length >= 4);
  return [...new Set([compactName(brand), ...words])].filter(Boolean);
}

export function domainMatchesBrand(host: string, brand: string): boolean {
  const domain = compactName(registrableDomain(host).split(".")[0] ?? "");
  return nameTokens(brand).some((token) => domain.includes(token));
}
```

Note `split(".")[0]` takes the name part of the registrable domain (`dr-g` of `dr-g.co.kr`), and `compactName` drops its hyphen.

Run: `pnpm test src/lib/website/domain.test.ts` — Expected: PASS, 6 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/website/domain.ts src/lib/website/domain.test.ts
git commit -m "feat(website): registrable domain and brand-name helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The website verdict

**Files:**
- Create: `src/lib/website/judge.ts`, `src/lib/website/judge.test.ts`

**Interfaces:**
- Consumes: `registrableDomain`, `compactName`, `domainMatchesBrand` (Task 1).
- Produces:
  - `type FetchedPage = { requestedUrl: string; ok: boolean; status: number | null; finalUrl: string | null; html: string; error: string | null; elapsedMs: number }`.
  - `type SiteKind = "ok" | "name_missing" | "unreachable" | "server_error" | "parked" | "offline" | "hijacked" | "blocked"`.
  - `type SiteVerdict = { score: "proven" | "review" | "rejected"; kind: SiteKind; reason: string; siteUrl: string }` — `siteUrl` is the origin the verdict is about (final URL when the redirect stayed with the brand).
  - `judgeSite(page: FetchedPage, brand: string): SiteVerdict`.

- [ ] **Step 1: Write the failing test `src/lib/website/judge.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { judgeSite, type FetchedPage } from "@/lib/website/judge";

const page = (over: Partial<FetchedPage>): FetchedPage => ({
  requestedUrl: "https://brand.com/",
  ok: true,
  status: 200,
  finalUrl: "https://brand.com/",
  html: "",
  error: null,
  elapsedMs: 300,
  ...over,
});

const REAL = (title: string) => `<html><head><title>${title}</title></head><body>${"x".repeat(3000)}</body></html>`;

describe("judgeSite", () => {
  it("proves a live site that names the brand", () => {
    const v = judgeSite(page({ requestedUrl: "https://tirtir.global/", finalUrl: "https://tirtir.global/", html: REAL("TIRTIR Global Official") }), "TIRTIR");
    expect(v).toMatchObject({ score: "proven", kind: "ok", siteUrl: "https://tirtir.global" });
  });

  it("matches the brand with accents and punctuation removed", () => {
    expect(judgeSite(page({ html: REAL("L’Oréal Paris | Official") }), "L'Oréal").score).toBe("proven");
  });

  it("sends a live site that never names the brand to review", () => {
    expect(judgeSite(page({ html: REAL("Welcome") }), "Benton")).toMatchObject({ score: "review", kind: "name_missing" });
  });

  it("rejects a site that does not load", () => {
    expect(judgeSite(page({ ok: false, status: null, finalUrl: null, error: "ENOTFOUND" }), "Dr.G")).toMatchObject({
      score: "rejected",
      kind: "unreachable",
    });
  });

  it("rejects a parked domain that bounces to /lander (jumiso.com)", () => {
    const html = '<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>';
    expect(judgeSite(page({ requestedUrl: "https://jumiso.com/", finalUrl: "https://jumiso.com/", html }), "Jumiso")).toMatchObject({
      score: "rejected",
      kind: "parked",
    });
  });

  it("rejects a for-sale page", () => {
    const html = REAL("brand.com is for sale") + " This domain may be for sale. Buy now on HugeDomains.";
    expect(judgeSite(page({ html }), "Brand").kind).toBe("parked");
  });

  it("rejects an offline store page (roundaround.co.kr on cafe24)", () => {
    const html = "<html><head><title>This store is unavailable</title></head><body>Sorry, this store is temporarily unavailable.</body></html>";
    expect(judgeSite(page({ html }), "Round A'Round")).toMatchObject({ score: "rejected", kind: "offline" });
  });

  it("rejects a redirect to an unrelated domain (pyunkangyul.us)", () => {
    const v = judgeSite(
      page({ requestedUrl: "https://pyunkangyul.us/", finalUrl: "https://xoilaclivettbdu.tv/", html: REAL("Watch live") }),
      "Pyunkang Yul",
    );
    expect(v).toMatchObject({ score: "rejected", kind: "hijacked" });
    expect(v.reason).toContain("xoilaclivettbdu.tv");
  });

  it("follows a redirect that stays with the brand", () => {
    const v = judgeSite(
      page({ requestedUrl: "https://www.aestura.com/", finalUrl: "https://www.aestura.com/web/main.do", html: REAL("AESTURA") }),
      "Aestura",
    );
    expect(v).toMatchObject({ score: "proven", siteUrl: "https://www.aestura.com" });
  });

  it("sends a bot check to review rather than guessing", () => {
    const html = "<html><head><title>Just a moment...</title></head><body>cf-chl</body></html>";
    expect(judgeSite(page({ status: 403, html }), "Brand")).toMatchObject({ score: "review", kind: "blocked" });
  });

  it("rejects a bare server error, but reviews one that still shows the brand", () => {
    expect(judgeSite(page({ status: 500, html: "Internal Server Error" }), "Brand").kind).toBe("server_error");
    expect(judgeSite(page({ status: 500, html: REAL("Dear Klairs") }), "Dear, Klairs")).toMatchObject({
      score: "review",
      kind: "server_error",
    });
  });
});
```

Run: `pnpm test src/lib/website/judge.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement `src/lib/website/judge.ts`**

```ts
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
```

Run: `pnpm test src/lib/website/judge.test.ts` — Expected: PASS, 11 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/website/judge.ts src/lib/website/judge.test.ts
git commit -m "feat(website): verdict for a fetched page — parked, hijacked, offline, blocked

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Facts from a page

**Files:**
- Modify: `package.json` (add `cheerio`)
- Create: `src/lib/website/extract.ts`, `src/lib/website/extract.test.ts`

**Interfaces:**
- Consumes: `registrableDomain`, `domainMatchesBrand` (Task 1).
- Produces:
  - `type PageFacts = { title: string | null; siteName: string | null; description: string | null; instagram: string[]; tiktok: string[]; regionalSites: string[]; ogImage: string | null; icons: string[]; logoImages: string[]; jsonLdLogos: string[] }`.
  - `extractFacts(html: string, pageUrl: string, brand: string): PageFacts` — handles lowercase, de-duplicated, without `@`; URLs absolute; `regionalSites` are origins on other brand domains or other hosts of the same domain (e.g. `https://us.numbuzin.com`), never the page's own origin.

- [ ] **Step 1: Add cheerio**

Run: `pnpm add cheerio@^1.1.2`

- [ ] **Step 2: Write the failing test `src/lib/website/extract.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { extractFacts } from "@/lib/website/extract";

const html = `<!doctype html><html><head>
<title>TIRTIR Global Official</title>
<meta property="og:site_name" content="TIRTIR">
<meta property="og:image" content="/cdn/hero.jpg">
<meta name="description" content="Mask Fit cushions">
<link rel="apple-touch-icon" href="/icons/touch.png">
<link rel="alternate" hreflang="ko" href="https://www.tirtir.co.kr/">
<script type="application/ld+json">{"@type":"Organization","logo":"https://tirtir.global/logo.svg","sameAs":["https://www.instagram.com/tirtir_global/"]}</script>
<script>var cfg = {"social":"https:\\/\\/www.tiktok.com\\/@tirtir.official"};</script>
</head><body>
<header><img class="site-logo" data-src="/img/logo.png" alt="TIRTIR"></header>
<a href="https://www.instagram.com/tirtir_global/">IG</a>
<a href="https://instagram.com/p/ABC123/">a post</a>
<a href="https://www.instagram.com/explore/tags/kbeauty/">tag</a>
<a href="https://us.tirtir.global/">US store</a>
<a href="https://www.sephora.com/brand/tirtir">Sephora</a>
<a href="https://tirtir.global/pages/about">About</a>
</body></html>`;

describe("extractFacts", () => {
  const facts = extractFacts(html, "https://tirtir.global/", "TIRTIR");

  it("reads title, site name, description", () => {
    expect(facts).toMatchObject({ title: "TIRTIR Global Official", siteName: "TIRTIR", description: "Mask Fit cushions" });
  });

  it("finds profile handles, including JSON-escaped and JSON-LD sameAs links, but not posts or tags", () => {
    expect(facts.instagram).toEqual(["tirtir_global"]);
    expect(facts.tiktok).toEqual(["tirtir.official"]);
  });

  it("finds regional brand sites and skips retailers and its own origin", () => {
    expect(facts.regionalSites.sort()).toEqual(["https://us.tirtir.global", "https://www.tirtir.co.kr"]);
  });

  it("resolves image candidates to absolute URLs", () => {
    expect(facts.ogImage).toBe("https://tirtir.global/cdn/hero.jpg");
    expect(facts.icons).toEqual(["https://tirtir.global/icons/touch.png"]);
    expect(facts.logoImages).toEqual(["https://tirtir.global/img/logo.png"]);
    expect(facts.jsonLdLogos).toEqual(["https://tirtir.global/logo.svg"]);
  });
});
```

Run: `pnpm test src/lib/website/extract.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/website/extract.ts`**

```ts
import * as cheerio from "cheerio";
import { domainMatchesBrand, registrableDomain } from "@/lib/website/domain";

export type PageFacts = {
  title: string | null;
  siteName: string | null;
  description: string | null;
  instagram: string[];
  tiktok: string[];
  regionalSites: string[];
  ogImage: string | null;
  icons: string[];
  logoImages: string[];
  jsonLdLogos: string[];
};

/** Instagram paths that are not profiles. */
const IG_RESERVED = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "tv", "share", "direct", "about", "developer", "legal"]);
const IG_RE = /instagram\.com\/([A-Za-z0-9._]{1,30})(?=[/?"'#\s]|$)/gi;
const TT_RE = /tiktok\.com\/@([A-Za-z0-9._]{2,24})(?=[/?"'#\s]|$)/gi;

function absolute(href: string | undefined, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href.trim(), base).toString();
  } catch {
    return null;
  }
}

function handles(source: string, re: RegExp, reserved = new Set<string>()): string[] {
  const out = new Set<string>();
  for (const m of source.matchAll(re)) {
    const h = m[1].toLowerCase().replace(/\.+$/, "");
    if (h && !reserved.has(h)) out.add(h);
  }
  return [...out];
}

function jsonLd($: cheerio.CheerioAPI): unknown[] {
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((el) => {
      try {
        const v = JSON.parse($(el).text());
        return Array.isArray(v) ? v : [v];
      } catch {
        return [];
      }
    });
}

export function extractFacts(html: string, pageUrl: string, brand: string): PageFacts {
  const $ = cheerio.load(html);
  // Handles also hide in scripts as JSON with escaped slashes (`https:\/\/www.tiktok.com\/@x`).
  const raw = html.replace(/\\\//g, "/");
  const ownOrigin = new URL(pageUrl).origin;
  const ownDomain = registrableDomain(new URL(pageUrl).hostname);

  const regional = new Set<string>();
  const consider = (href: string | undefined) => {
    const abs = absolute(href, pageUrl);
    if (!abs) return;
    const u = new URL(abs);
    if (!/^https?:$/.test(u.protocol) || u.origin === ownOrigin) return;
    const sameDomain = registrableDomain(u.hostname) === ownDomain;
    if (sameDomain || domainMatchesBrand(u.hostname, brand)) regional.add(u.origin);
  };
  $("a[href]").each((_, el) => consider($(el).attr("href")));
  $('link[rel="alternate"][hreflang]').each((_, el) => consider($(el).attr("href")));

  const ld = jsonLd($);
  const ldLogos = ld
    .map((o) => (o && typeof o === "object" ? (o as { logo?: unknown }).logo : null))
    .map((logo) => (typeof logo === "string" ? logo : (logo as { url?: string } | null)?.url))
    .map((u) => absolute(u ?? undefined, pageUrl))
    .filter((u): u is string => Boolean(u));

  const logoImages = $("img")
    .toArray()
    .filter((el) => /logo/i.test([$(el).attr("class"), $(el).attr("id"), $(el).attr("alt"), $(el).attr("src"), $(el).attr("data-src")].join(" ")))
    .map((el) => absolute($(el).attr("src") ?? $(el).attr("data-src"), pageUrl))
    .filter((u): u is string => Boolean(u) && !u!.startsWith("data:"));

  const icons = $('link[rel~="apple-touch-icon"], link[rel~="icon"]')
    .toArray()
    .map((el) => absolute($(el).attr("href"), pageUrl))
    .filter((u): u is string => Boolean(u));

  return {
    title: $("title").first().text().trim() || null,
    siteName: $('meta[property="og:site_name"]').attr("content")?.trim() || null,
    description: ($('meta[name="description"]').attr("content") ?? $('meta[property="og:description"]').attr("content"))?.trim() || null,
    instagram: handles(raw, IG_RE, IG_RESERVED),
    tiktok: handles(raw, TT_RE),
    regionalSites: [...regional],
    ogImage: absolute($('meta[property="og:image"]').attr("content"), pageUrl),
    icons: [...new Set(icons)],
    logoImages: [...new Set(logoImages)],
    jsonLdLogos: [...new Set(ldLogos)],
  };
}
```

Note: the retailer link (`sephora.com`) is excluded because neither its domain is `tirtir.global` nor does `sephora` contain `tirtir`. The `/pages/about` link is the page's own origin, so it is not a regional site.

Run: `pnpm test src/lib/website/extract.test.ts` — Expected: PASS, 4 tests. If `regionalSites` also contains `https://www.instagram.com`-like hosts, that is a bug: social hosts never match the brand domain rule; check `consider`.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/website/extract.ts src/lib/website/extract.test.ts
git commit -m "feat(website): extract handles, regional sites and image candidates from a page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Fetching a page and the Wayback Machine

**Files:**
- Create: `src/lib/website/fetch-page.ts`, `src/lib/website/archive.ts`, `src/lib/website/archive.test.ts`

**Interfaces:**
- Consumes: `FetchedPage` (Task 2).
- Produces:
  - `fetchPage(url: string): Promise<FetchedPage>` — never throws; 15 s timeout; 2 MB cap; desktop Chrome user agent; follows redirects; reads `<meta http-equiv=refresh>` once.
  - `parseCdx(json: unknown): string[]` — timestamps, newest first.
  - `snapshotUrl(timestamp: string, url: string): string` — `https://web.archive.org/web/<ts>id_/<url>`.
  - `latestSnapshot(url: string, now?: Date): Promise<{ timestamp: string; page: FetchedPage } | null>` — newest 200-status capture in the last 3 years whose page is not itself parked/empty.

- [ ] **Step 1: Write the failing test `src/lib/website/archive.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseCdx, snapshotUrl } from "@/lib/website/archive";

describe("parseCdx", () => {
  it("reads timestamps newest first and skips the header row", () => {
    expect(parseCdx([["timestamp"], ["20230130142252"], ["20251203093431"], ["20240121170818"]])).toEqual([
      "20251203093431",
      "20240121170818",
      "20230130142252",
    ]);
  });

  it("is empty for anything unexpected", () => {
    expect(parseCdx(null)).toEqual([]);
    expect(parseCdx("nope")).toEqual([]);
    expect(parseCdx([["timestamp"]])).toEqual([]);
  });
});

describe("snapshotUrl", () => {
  it("asks for the raw capture without the Wayback toolbar", () => {
    expect(snapshotUrl("20210727130542", "https://roundaround.co.kr/")).toBe(
      "https://web.archive.org/web/20210727130542id_/https://roundaround.co.kr/",
    );
  });
});
```

Run: `pnpm test src/lib/website/archive.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `src/lib/website/fetch-page.ts`**

```ts
import "server-only";
import type { FetchedPage } from "@/lib/website/judge";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000;

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, MAX_BYTES));
}

async function once(url: string): Promise<{ res: Response; html: string }> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { res, html: await readCapped(res) };
}

/** The one place the research job fetches a web page. Never throws: failures come back as data. */
export async function fetchPage(url: string): Promise<FetchedPage> {
  const started = Date.now();
  try {
    let { res, html } = await once(url);
    // One hop of <meta http-equiv="refresh" content="0; url=...">, which fetch does not follow.
    const refresh = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"'>]+)/i)?.[1];
    if (refresh) {
      const next = new URL(refresh.trim(), res.url).toString();
      ({ res, html } = await once(next));
    }
    return { requestedUrl: url, ok: res.ok, status: res.status, finalUrl: res.url, html, error: null, elapsedMs: Date.now() - started };
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause?.code;
    const message = cause ?? (error instanceof Error ? error.name : "fetch failed");
    return { requestedUrl: url, ok: false, status: null, finalUrl: null, html: "", error: message, elapsedMs: Date.now() - started };
  }
}
```

- [ ] **Step 3: Implement `src/lib/website/archive.ts`**

```ts
import "server-only";
import { fetchPage } from "@/lib/website/fetch-page";
import type { FetchedPage } from "@/lib/website/judge";

export function parseCdx(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json
    .slice(1)
    .map((row) => (Array.isArray(row) ? String(row[0] ?? "") : ""))
    .filter((ts) => /^\d{14}$/.test(ts))
    .sort()
    .reverse();
}

export function snapshotUrl(timestamp: string, url: string): string {
  return `https://web.archive.org/web/${timestamp}id_/${url}`;
}

/**
 * The newest usable capture from the last three years, or null. "Usable" means a real page: the
 * newest captures of a hijacked or parked domain are the hijack or the parking page, so a capture
 * that is tiny or is a /lander bounce is skipped in favour of an older one.
 */
export async function latestSnapshot(url: string, now = new Date()): Promise<{ timestamp: string; page: FetchedPage } | null> {
  const host = new URL(url).hostname;
  const from = String(now.getUTCFullYear() - 3);
  const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(host)}&output=json&filter=statuscode:200&collapse=timestamp:6&from=${from}&fl=timestamp`;
  try {
    const res = await fetch(cdx, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    for (const ts of parseCdx(await res.json()).slice(0, 6)) {
      const page = await fetchPage(snapshotUrl(ts, `https://${host}/`));
      if (page.ok && page.html.length >= 2_000 && !/\/lander/.test(page.html.slice(0, 500))) return { timestamp: ts, page };
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `pnpm test src/lib/website && pnpm typecheck` — Expected: PASS (archive 3 tests), no type errors.

```bash
git add src/lib/website/fetch-page.ts src/lib/website/archive.ts src/lib/website/archive.test.ts
git commit -m "feat(website): page fetch with caps and Wayback Machine fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Finding official sites with Gemini

**Files:**
- Modify: `package.json` (add `ai`, `@ai-sdk/google`), `.env.example`
- Create: `src/lib/website/discover.ts`, `src/lib/website/discover.test.ts`

**Interfaces:**
- Produces:
  - `type SiteSuggestion = { url: string; region: "global" | "us" | "kr" | "other" }`.
  - `parseSitesAnswer(text: string): SiteSuggestion[]` — reads the first JSON object in the text; keeps up to 4 `https` origins; drops social, marketplace and retailer hosts.
  - `findOfficialSites(brand: string): Promise<SiteSuggestion[]>` — Gemini `gemini-2.5-flash` with the Google Search tool; returns `[]` (never throws) when the key is missing or the call fails.

- [ ] **Step 1: Add the AI SDK and the env name**

Run: `pnpm add ai@^7.0.136 @ai-sdk/google@^4.0.93`

Append to `.env.example`:
```
# Google AI Studio key. Gemini with Google Search finds official websites when no hint is given.
GOOGLE_GENERATIVE_AI_API_KEY=
```

- [ ] **Step 2: Write the failing test `src/lib/website/discover.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseSitesAnswer } from "@/lib/website/discover";

describe("parseSitesAnswer", () => {
  it("reads the JSON object out of a prose answer", () => {
    const text = 'Here you go:\n```json\n{"sites":[{"url":"https://tirtir.global/","region":"global"},{"url":"tirtir.co.kr","region":"kr"}]}\n```';
    expect(parseSitesAnswer(text)).toEqual([
      { url: "https://tirtir.global", region: "global" },
      { url: "https://tirtir.co.kr", region: "kr" },
    ]);
  });

  it("drops retailers, marketplaces and social profiles", () => {
    const text = '{"sites":[{"url":"https://www.sephora.com/brand/x","region":"us"},{"url":"https://www.amazon.com/stores/x","region":"us"},{"url":"https://instagram.com/x","region":"global"},{"url":"https://acme-beauty.com","region":"global"}]}';
    expect(parseSitesAnswer(text)).toEqual([{ url: "https://acme-beauty.com", region: "global" }]);
  });

  it("is empty for unreadable answers", () => {
    expect(parseSitesAnswer("I could not find it.")).toEqual([]);
    expect(parseSitesAnswer('{"sites": "nope"}')).toEqual([]);
  });
});
```

Run: `pnpm test src/lib/website/discover.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/website/discover.ts`**

```ts
import { z } from "zod";

export type SiteSuggestion = { url: string; region: "global" | "us" | "kr" | "other" };

const Answer = z.object({
  sites: z.array(z.object({ url: z.string(), region: z.enum(["global", "us", "kr", "other"]).catch("other") })),
});

/** Hosts that are never a brand's own site. */
const NOT_OFFICIAL = /(^|\.)(instagram|tiktok|facebook|youtube|x|twitter|linkedin|amazon|sephora|ulta|oliveyoung|yesstyle|stylevana|stylekorean|ebay|walmart|target|wikipedia|linktr)\.[a-z.]+$/i;

export function parseSitesAnswer(text: string): SiteSuggestion[] {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  let parsed: z.infer<typeof Answer>;
  try {
    parsed = Answer.parse(JSON.parse(json));
  } catch {
    return [];
  }
  const out: SiteSuggestion[] = [];
  for (const s of parsed.sites) {
    try {
      const u = new URL(/^https?:\/\//i.test(s.url) ? s.url : `https://${s.url}`);
      if (NOT_OFFICIAL.test(u.hostname)) continue;
      const origin = `https://${u.hostname}`;
      if (!out.some((o) => o.url === origin)) out.push({ url: origin, region: s.region });
    } catch {
      continue;
    }
  }
  return out.slice(0, 4);
}

/**
 * Gemini with Google Search grounding. Grounded calls cannot also enforce a JSON schema, so the
 * prompt asks for JSON and `parseSitesAnswer` validates it. Never throws: no key or a failed call
 * means no suggestions, and the brand goes to review.
 */
export async function findOfficialSites(brand: string): Promise<SiteSuggestion[]> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return [];
  try {
    const { generateText } = await import("ai");
    const { google } = await import("@ai-sdk/google");
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      tools: { google_search: google.tools.googleSearch({}) },
      prompt:
        `Find the official website(s) owned by the beauty/fashion brand "${brand}". ` +
        `Include its global site and regional official sites (US, Korea) if they exist. ` +
        `Exclude retailers, marketplaces, distributors and social media. ` +
        `Answer with JSON only: {"sites":[{"url":"https://...","region":"global|us|kr|other"}]}`,
    });
    return parseSitesAnswer(text);
  } catch (error) {
    console.error("[website] Gemini site search failed", error);
    return [];
  }
}
```

If `google.tools.googleSearch` is not the tool factory in the installed `@ai-sdk/google`, read `node_modules/@ai-sdk/google/dist/index.d.ts` for the Google Search tool's name and use it; the call shape (`tools: { google_search: … }`) and behaviour stay the same.

Run: `pnpm test src/lib/website/discover.test.ts && pnpm typecheck` — Expected: PASS, 3 tests; no type errors.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example src/lib/website/discover.ts src/lib/website/discover.test.ts
git commit -m "feat(website): find official sites with Gemini + Google Search

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `researchWebsite` — orchestration without the database

**Files:**
- Create: `src/lib/website/research.ts`, `src/lib/website/research.test.ts`

**Interfaces:**
- Consumes: `judgeSite`, `FetchedPage`, `SiteVerdict` (Task 2); `extractFacts`, `PageFacts` (Task 3); `SiteSuggestion` (Task 5).
- Produces:
  - `type WebsiteDeps = { fetchPage(url: string): Promise<FetchedPage>; latestSnapshot(url: string): Promise<{ timestamp: string; page: FetchedPage } | null>; findOfficialSites(brand: string): Promise<SiteSuggestion[]> }`.
  - `type CheckedSite = { url: string; source: "hint" | "search" | "regional-link"; verdict: SiteVerdict; facts: PageFacts | null; archive: { timestamp: string; facts: PageFacts } | null }`.
  - `type WebsiteResearch = { candidates: CheckedSite[]; chosen: CheckedSite | null }`.
  - `researchWebsite(brand: string, hint: string | null, deps: WebsiteDeps): Promise<WebsiteResearch>`.
  - `chooseSite(candidates: CheckedSite[]): CheckedSite | null` — first `proven`, preferring `region` order hint → global search → other; else first `review`; else null.

Rules: candidates are the hint (if any) else Gemini's suggestions (max 4). Each is fetched one at a time and judged. A proven/review site's facts are extracted; its `regionalSites` (max 3, not already candidates) are fetched and judged as `regional-link` candidates. A `rejected` site whose kind is `unreachable`, `parked`, `offline` or `hijacked` gets an archive lookup; archive facts are attached but never change the verdict score.

- [ ] **Step 1: Write the failing test `src/lib/website/research.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { researchWebsite, type WebsiteDeps } from "@/lib/website/research";
import type { FetchedPage } from "@/lib/website/judge";

const real = (title: string, body = "") => `<html><head><title>${title}</title></head><body>${body}${"x".repeat(3000)}</body></html>`;

function deps(pages: Record<string, Partial<FetchedPage>>, over: Partial<WebsiteDeps> = {}): WebsiteDeps {
  return {
    fetchPage: vi.fn(async (url: string) => ({
      requestedUrl: url,
      ok: true,
      status: 200,
      finalUrl: url,
      html: "",
      error: null,
      elapsedMs: 10,
      ...(pages[url] ?? { ok: false, status: null, finalUrl: null, error: "ENOTFOUND" }),
    })),
    latestSnapshot: vi.fn(async () => null),
    findOfficialSites: vi.fn(async () => []),
    ...over,
  };
}

describe("researchWebsite", () => {
  it("proves the hint and follows its regional links", async () => {
    const d = deps({
      "https://numbuzin.com/": { html: real("numbuzin", '<a href="https://us.numbuzin.com/">US</a>') },
      "https://us.numbuzin.com/": { html: real("numbuzin US") },
    });
    const r = await researchWebsite("numbuzin", "https://numbuzin.com/", d);
    expect(r.chosen?.url).toBe("https://numbuzin.com/");
    expect(r.candidates.map((c) => [c.url, c.source, c.verdict.score])).toEqual([
      ["https://numbuzin.com/", "hint", "proven"],
      ["https://us.numbuzin.com/", "regional-link", "proven"],
    ]);
    expect(d.findOfficialSites).not.toHaveBeenCalled();
  });

  it("rejects a hijacked hint and attaches the archive, then asks Gemini", async () => {
    const d = deps(
      {
        "https://pyunkangyul.us/": { finalUrl: "https://xoilaclivettbdu.tv/", html: real("live sport") },
        "https://pyunkangyul.com/": { html: real("Pyunkang Yul") },
      },
      {
        latestSnapshot: vi.fn(async () => ({
          timestamp: "20240121170818",
          page: { requestedUrl: "", ok: true, status: 200, finalUrl: "", html: real("Pyunkang Yul US Official"), error: null, elapsedMs: 1 },
        })),
        findOfficialSites: vi.fn(async () => [{ url: "https://pyunkangyul.com", region: "global" as const }]),
      },
    );
    const r = await researchWebsite("Pyunkang Yul", "https://pyunkangyul.us/", d);
    const hint = r.candidates.find((c) => c.source === "hint")!;
    expect(hint.verdict.kind).toBe("hijacked");
    expect(hint.archive?.timestamp).toBe("20240121170818");
    expect(r.chosen?.url).toBe("https://pyunkangyul.com/");
  });

  it("uses Gemini when there is no hint, and chooses nothing when nothing loads", async () => {
    const d = deps({}, { findOfficialSites: vi.fn(async () => [{ url: "https://dr-g.co.kr", region: "kr" as const }]) });
    const r = await researchWebsite("Dr.G", null, d);
    expect(d.findOfficialSites).toHaveBeenCalledWith("Dr.G");
    expect(r.candidates[0].verdict.kind).toBe("unreachable");
    expect(r.chosen).toBeNull();
  });
});
```

Run: `pnpm test src/lib/website/research.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `src/lib/website/research.ts`**

```ts
import { extractFacts, type PageFacts } from "@/lib/website/extract";
import { judgeSite, type FetchedPage, type SiteVerdict } from "@/lib/website/judge";
import type { SiteSuggestion } from "@/lib/website/discover";

export type WebsiteDeps = {
  fetchPage(url: string): Promise<FetchedPage>;
  latestSnapshot(url: string): Promise<{ timestamp: string; page: FetchedPage } | null>;
  findOfficialSites(brand: string): Promise<SiteSuggestion[]>;
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
const ARCHIVE_KINDS = new Set(["unreachable", "parked", "offline", "hijacked"]);

function normalize(url: string): string {
  const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  return `${u.origin}/`;
}

async function check(brand: string, url: string, source: CheckedSite["source"], deps: WebsiteDeps): Promise<CheckedSite> {
  const page = await deps.fetchPage(url);
  const verdict = judgeSite(page, brand);
  const facts = verdict.score !== "rejected" && page.html ? extractFacts(page.html, page.finalUrl ?? url, brand) : null;
  let archive: CheckedSite["archive"] = null;
  if (verdict.score === "rejected" && ARCHIVE_KINDS.has(verdict.kind)) {
    const snap = await deps.latestSnapshot(url);
    if (snap) archive = { timestamp: snap.timestamp, facts: extractFacts(snap.page.html, url, brand) };
  }
  return { url, source, verdict, facts, archive };
}

export function chooseSite(candidates: CheckedSite[]): CheckedSite | null {
  return candidates.find((c) => c.verdict.score === "proven") ?? candidates.find((c) => c.verdict.score === "review") ?? null;
}

export async function researchWebsite(brand: string, hint: string | null, deps: WebsiteDeps): Promise<WebsiteResearch> {
  const candidates: CheckedSite[] = [];
  const seen = new Set<string>();
  const add = async (url: string, source: CheckedSite["source"]) => {
    const key = normalize(url);
    if (seen.has(key) || candidates.length >= MAX_CANDIDATES + MAX_REGIONAL) return;
    seen.add(key);
    candidates.push(await check(brand, key, source, deps));
  };

  if (hint) await add(hint, "hint");
  // No usable hint: ask Gemini. A hint that is proven or in review is trusted on its own.
  if (!candidates.some((c) => c.verdict.score !== "rejected")) {
    for (const s of (await deps.findOfficialSites(brand)).slice(0, MAX_CANDIDATES)) await add(s.url, "search");
  }

  const chosen = chooseSite(candidates);
  for (const regional of (chosen?.facts?.regionalSites ?? []).slice(0, MAX_REGIONAL)) await add(regional, "regional-link");

  return { candidates, chosen: chooseSite(candidates) };
}
```

Run: `pnpm test src/lib/website/research.test.ts` — Expected: PASS, 3 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/website/research.ts src/lib/website/research.test.ts
git commit -m "feat(website): researchWebsite orchestration with injected network deps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Persisting — `brand_pages`, candidates, selection, and the job

**Files:**
- Modify: `prisma/schema.prisma`, `src/lib/inngest/functions/research-brand.ts`
- Create: `prisma/migrations/<ts>_brand_pages/migration.sql`, `src/lib/research/website-step.ts`

**Interfaces:**
- Consumes: `researchWebsite`, `CheckedSite` (Task 6); `fetchPage` (Task 4); `latestSnapshot` (Task 4); `findOfficialSites` (Task 5); `markStep` (scaffold).
- Produces:
  - Prisma model `BrandPage { id, brandId, url, source ("live" | "archive"), archivedAt String?, verdictKind String, facts Json, fetchedAt }` mapped to `brand_pages`.
  - `runWebsiteStep(brandId: string): Promise<void>` — runs `researchWebsite`, replaces the brand's `website` candidates, writes one `brand_pages` row per candidate with facts (live) and per archive capture (archive), sets the `website` selection (`chosenBy: "auto"`) to the chosen candidate or deletes it when none.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Add to `model Brand` the relation line `pages BrandPage[]`, then append:

```prisma
/// What the crawl found on one page of a brand's site, live or from the Wayback Machine.
model BrandPage {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  brandId     String   @map("brand_id") @db.Uuid
  brand       Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  url         String
  source      String
  archivedAt  String?  @map("archived_at")
  verdictKind String   @map("verdict_kind")
  facts       Json     @default("{}")
  fetchedAt   DateTime @default(now()) @map("fetched_at") @db.Timestamptz(6)

  @@index([brandId])
  @@map("brand_pages")
}
```

- [ ] **Step 2: Create the migration with the lockdown block**

Run: `pnpm db:migrate --create-only --name brand_pages` — Expected: a migration containing `CREATE TABLE "brand_pages"`.

Append to that `migration.sql` (AGENTS.md rule 5):
```sql
-- Lockdown for the new table (same block as the lockdown migration).
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
```

Run: `pnpm db:migrate:deploy` — Expected: migration applied.
Add `"brand_pages"` to `TABLES` in `scripts/verify-lockdown.ts`, then run `pnpm verify:lockdown` — Expected: `brand_pages read 401 · write 401`, "Locked down…".

- [ ] **Step 3: Implement `src/lib/research/website-step.ts`**

```ts
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchPage } from "@/lib/website/fetch-page";
import { latestSnapshot } from "@/lib/website/archive";
import { findOfficialSites } from "@/lib/website/discover";
import { researchWebsite, type CheckedSite } from "@/lib/website/research";

const SOURCE_LABEL: Record<CheckedSite["source"], string> = {
  hint: "Website given in the batch",
  search: "Found by Google search (Gemini)",
  "regional-link": "Linked from the brand's own site",
};

/** Runs inside the Inngest job; takes no scope (AGENTS.md rule 2 exception). */
export async function runWebsiteStep(brandId: string): Promise<void> {
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: { name: true, websiteHint: true } });
  const { candidates, chosen } = await researchWebsite(brand.name, brand.websiteHint, { fetchPage, latestSnapshot, findOfficialSites });

  await prisma.$transaction(async (tx) => {
    await tx.selection.deleteMany({ where: { brandId, field: "website" } });
    await tx.candidate.deleteMany({ where: { brandId, field: "website" } });
    await tx.brandPage.deleteMany({ where: { brandId } });

    let chosenId: string | null = null;
    for (const c of candidates) {
      const row = await tx.candidate.create({
        data: {
          brandId,
          field: "website",
          value: c.verdict.siteUrl,
          source: SOURCE_LABEL[c.source],
          score: c.verdict.score,
          reason: c.verdict.reason,
          evidence: {
            checkedUrl: c.url,
            kind: c.verdict.kind,
            title: c.facts?.title ?? null,
            archivedAt: c.archive?.timestamp ?? null,
          },
        },
        select: { id: true },
      });
      if (c === chosen) chosenId = row.id;
      if (c.facts) {
        await tx.brandPage.create({ data: { brandId, url: c.verdict.siteUrl, source: "live", verdictKind: c.verdict.kind, facts: c.facts as unknown as Prisma.InputJsonValue } });
      }
      if (c.archive) {
        await tx.brandPage.create({
          data: { brandId, url: c.url, source: "archive", archivedAt: c.archive.timestamp, verdictKind: c.verdict.kind, facts: c.archive.facts as unknown as Prisma.InputJsonValue },
        });
      }
    }
    if (chosenId) {
      await tx.selection.create({ data: { brandId, field: "website", candidateId: chosenId, chosenBy: "auto" } });
    }
  });
}
```

- [ ] **Step 4: Call it from the job**

In `src/lib/inngest/functions/research-brand.ts`, import `runWebsiteStep` and replace the step loop body so the `website` step does real work and `crawl` is folded into it (the crawl of regional sites happens inside `researchWebsite`):

```ts
    for (const { id } of RESEARCH_STEPS) {
      await step.run(`step:${id}`, async () => {
        await markStep(brandId, id);
        if (id === "website") await runWebsiteStep(brandId);
      });
      if (id !== "website") await step.sleep(`pause:${id}`, "1s");
    }
```

The `crawl` step stays as a visible progress stage (its work is done by `website` in this plan; later plans give it the logo and cover crawl).

- [ ] **Step 5: Verify and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint` — Expected: all pass.

```bash
git add prisma src/lib/research/website-step.ts src/lib/inngest/functions/research-brand.ts scripts/verify-lockdown.ts
git commit -m "feat(research): website step persists candidates, pages and the auto selection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Brand page (read-only) and clickable rows

**Files:**
- Create: `src/lib/brands/scoped.ts`, `src/app/(app)/brands/[id]/page.tsx`, `src/app/(app)/brands/[id]/loading.tsx`
- Modify: `src/app/(app)/batches/[id]/page.tsx` (rows link to the brand page)

**Interfaces:**
- Consumes: `requireMember`, `TeamScope`; design `DesignPage`, `PageHeader`, `ListGroup`, `ListRow`, `Pill`; `progressText`, `progressTone`.
- Produces: `getBrandDetail(scope, id): Promise<BrandDetail | null>` with `type BrandDetail = { id: string; name: string; batchId: string; status: BrandStatus; currentStep: string | null; reviewCount: number; error: string | null; website: { selectedCandidateId: string | null; candidates: { id: string; value: string; source: string; score: CandidateScore; reason: string; evidence: Record<string, unknown> }[] }; pages: { url: string; source: string; archivedAt: string | null; facts: PageFacts }[] }`.

- [ ] **Step 1: Implement `src/lib/brands/scoped.ts`**

```ts
import "server-only";
import type { BrandStatus, CandidateScore } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import type { PageFacts } from "@/lib/website/extract";

export type BrandDetail = {
  id: string;
  name: string;
  batchId: string;
  status: BrandStatus;
  currentStep: string | null;
  reviewCount: number;
  error: string | null;
  website: {
    selectedCandidateId: string | null;
    candidates: { id: string; value: string; source: string; score: CandidateScore; reason: string; evidence: Record<string, unknown> }[];
  };
  pages: { url: string; source: string; archivedAt: string | null; facts: PageFacts }[];
};

export async function getBrandDetail(_scope: TeamScope, id: string): Promise<BrandDetail | null> {
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      candidates: { where: { field: "website" }, orderBy: { createdAt: "asc" } },
      selections: { where: { field: "website" } },
      pages: { orderBy: { fetchedAt: "asc" } },
    },
  });
  if (!brand) return null;
  return {
    id: brand.id,
    name: brand.name,
    batchId: brand.batchId,
    status: brand.status,
    currentStep: brand.currentStep,
    reviewCount: brand.reviewCount,
    error: brand.error,
    website: {
      selectedCandidateId: brand.selections[0]?.candidateId ?? null,
      candidates: brand.candidates.map((c) => ({
        id: c.id,
        value: c.value,
        source: c.source,
        score: c.score,
        reason: c.reason,
        evidence: (c.evidence ?? {}) as Record<string, unknown>,
      })),
    },
    pages: brand.pages.map((p) => ({ url: p.url, source: p.source, archivedAt: p.archivedAt, facts: p.facts as PageFacts })),
  };
}
```

- [ ] **Step 2: Implement the brand page**

`src/app/(app)/brands/[id]/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DesignPage } from "@/design/page";
import { PageHeader } from "@/design/page-header";
import { ListGroup, ListRow, Pill } from "@/design/list";
import { requireMember } from "@/lib/auth/scope";
import { getBrandDetail } from "@/lib/brands/scoped";
import { progressText, progressTone } from "@/lib/brands/progress";
import { RowsLoading } from "@/components/app/shell/page-skeletons";

export const metadata: Metadata = { title: "Brand" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TONE = { proven: "green", review: "orange", rejected: "red" } as const;
const LABEL = { proven: "Proven", review: "Needs a look", rejected: "Rejected" } as const;

async function Brand({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, scope] = await Promise.all([params, requireMember()]);
  if (!UUID.test(id)) notFound();
  const brand = await getBrandDetail(scope, id);
  if (!brand) notFound();

  const live = brand.pages.filter((p) => p.source === "live");
  const archived = brand.pages.filter((p) => p.source === "archive");
  const found = (key: "instagram" | "tiktok") => [...new Set(brand.pages.flatMap((p) => p.facts[key] ?? []))];

  return (
    <>
      <PageHeader
        title={brand.name}
        back={{ href: `/batches/${brand.batchId}`, label: "Batch" }}
        actions={<Pill tone={progressTone(brand)}>{progressText(brand)}</Pill>}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-headline text-label">Website</h2>
        {brand.website.candidates.length === 0 ? (
          <p className="text-callout text-label-secondary">No website checked yet.</p>
        ) : (
          <ListGroup>
            {brand.website.candidates.map((c, i) => (
              <ListRow
                key={c.id}
                first={i === 0}
                title={
                  <span className="flex items-center gap-2">
                    {c.id === brand.website.selectedCandidateId ? <Pill tone="blue">Chosen</Pill> : null}
                    <Link href={c.value} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      {c.value.replace(/^https?:\/\//, "")}
                    </Link>
                  </span>
                }
                detail={`${c.reason} · ${c.source}${c.evidence.archivedAt ? ` · archive copy from ${String(c.evidence.archivedAt).slice(0, 4)}` : ""}`}
                trailing={<Pill tone={TONE[c.score]}>{LABEL[c.score]}</Pill>}
              />
            ))}
          </ListGroup>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-headline text-label">Found on the brand&apos;s sites</h2>
        <ListGroup>
          <ListRow first title="Instagram" detail={found("instagram").map((h) => `@${h}`).join(", ") || "None linked"} />
          <ListRow title="TikTok" detail={found("tiktok").map((h) => `@${h}`).join(", ") || "None linked"} />
          <ListRow title="Pages read" detail={`${live.length} live${archived.length ? `, ${archived.length} from the Wayback Machine` : ""}`} />
        </ListGroup>
        <p className="text-footnote text-label-secondary">
          Instagram, TikTok, logo and cover are checked in the next build steps; this shows what the site links to.
        </p>
      </section>
    </>
  );
}

export default function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <DesignPage>
      <Suspense fallback={<RowsLoading count={5} />}>
        <Brand params={params} />
      </Suspense>
    </DesignPage>
  );
}
```

`src/app/(app)/brands/[id]/loading.tsx`:
```tsx
import { DetailPageLoading } from "@/components/app/shell/page-skeletons";

export default function Loading() {
  return <DetailPageLoading />;
}
```

`progressText`/`progressTone` take a `BrandRow`; `BrandDetail` has every `BrandRow` field (`id`, `name`, `status`, `currentStep`, `reviewCount`, `error`), so it is accepted structurally.

- [ ] **Step 3: Make batch rows clickable**

In `src/app/(app)/batches/[id]/page.tsx`, give each `ListRow` `href={`/brands/${b.id}`}`:
```tsx
          <ListRow key={b.id} first={i === 0} href={`/brands/${b.id}`} title={b.name} trailing={<Pill tone={progressTone(b)}>{progressText(b)}</Pill>} />
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` — Expected: all pass; the architecture guard requires `requireMember(` in the new page, which it has.

```bash
git add src/lib/brands/scoped.ts "src/app/(app)/brands" "src/app/(app)/batches/[id]/page.tsx"
git commit -m "feat(brands): read-only brand page with the website verdicts; batch rows link to it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Test set and accuracy runner

**Files:**
- Create: `tests/test-set.ts`, `scripts/test-set.ts`
- Modify: `package.json` (script `test-set`)

**Interfaces:**
- Consumes: `researchWebsite` (Task 6) with real `fetchPage`, `latestSnapshot`, `findOfficialSites`; `registrableDomain` (Task 1).
- Produces: `pnpm test-set [--no-hints]` — prints one line per brand (expected site, chosen site, verdict) and the website accuracy; exits non-zero if a trap is ever chosen.

- [ ] **Step 1: Write `tests/test-set.ts`** (from the 2026-10-16 audit, spec §10)

```ts
/**
 * The audited brands (2026-10-16). `hint` is the website the original sheet gave; `expect` is the
 * registrable domain of the brand's real site; `trap` marks hints that must never be chosen.
 * `null` expect = no usable official site at audit time.
 */
export type TestBrand = { name: string; hint: string; expect: string | null; trap?: boolean };

export const TEST_SET: TestBrand[] = [
  { name: "haruharu wonder", hint: "https://haruharu.com/", expect: "haruharu.com" },
  { name: "AXIS-Y", hint: "https://www.axis-y.com/", expect: "axis-y.com" },
  { name: "numbuzin", hint: "https://numbuzin.com/", expect: "numbuzin.com" },
  { name: "SOME BY MI", hint: "https://somebymi.com/", expect: "somebymi.com" },
  { name: "Pyunkang Yul", hint: "https://pyunkangyul.us/", expect: "pyunkangyul.com", trap: true },
  { name: "Dr. Althea", hint: "https://doctoraltheaglobal.com/", expect: "doctoraltheaglobal.com" },
  { name: "Biodance", hint: "https://biodance.com/", expect: "biodance.com" },
  { name: "Celimax", hint: "https://celimax.us/", expect: "celimax.us" },
  { name: "Purito Seoul", hint: "https://purito.com/", expect: "purito.com" },
  { name: "Benton", hint: "https://bentoncosmetic.com/", expect: "bentoncosmetic.com" },
  { name: "Round A'Round", hint: "https://roundaround.co.kr/", expect: null, trap: true },
  { name: "Dear, Klairs", hint: "https://www.klairscosmetics.com/", expect: "klairscosmetics.com" },
  { name: "Jumiso", hint: "https://jumiso.com/", expect: "jumiso.us", trap: true },
  { name: "Aestura", hint: "https://www.aestura.com/", expect: "aestura.com" },
  { name: "TIRTIR", hint: "https://www.tirtir.co.kr/", expect: "tirtir.co.kr" },
  { name: "Dr.G", hint: "https://www.dr-g.co.kr/", expect: "dr-g.co.kr" },
];
```

- [ ] **Step 2: Write `scripts/test-set.ts`**

```ts
/**
 * Website accuracy on the audited brands:  pnpm test-set            (with the sheet's hints)
 *                                          pnpm test-set --no-hints (Gemini discovery only)
 * Makes real requests. A chosen trap is a hard failure (exit 1).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { TEST_SET } from "../tests/test-set";
import { researchWebsite } from "../src/lib/website/research";
import { fetchPage } from "../src/lib/website/fetch-page";
import { latestSnapshot } from "../src/lib/website/archive";
import { findOfficialSites } from "../src/lib/website/discover";
import { registrableDomain } from "../src/lib/website/domain";

const noHints = process.argv.includes("--no-hints");
let right = 0;
let trapChosen = false;

for (const b of TEST_SET) {
  const r = await researchWebsite(b.name, noHints ? null : b.hint, { fetchPage, latestSnapshot, findOfficialSites });
  const got = r.chosen ? registrableDomain(new URL(r.chosen.verdict.siteUrl).hostname) : null;
  const ok = got === b.expect;
  if (ok) right++;
  const hintDomain = registrableDomain(new URL(b.hint).hostname);
  if (b.trap && got === hintDomain && got !== b.expect) trapChosen = true;
  const hintVerdict = r.candidates.find((c) => c.source === "hint")?.verdict;
  console.log(
    `${ok ? "✓" : "✗"} ${b.name.padEnd(16)} expect ${String(b.expect).padEnd(22)} got ${String(got).padEnd(22)}` +
      (hintVerdict ? ` hint: ${hintVerdict.score}/${hintVerdict.kind}` : ""),
  );
}

console.log(`\nWebsite: ${right}/${TEST_SET.length} correct${noHints ? " (no hints)" : ""}.`);
if (trapChosen) {
  console.error("FAIL: a trap site was chosen.");
  process.exit(1);
}
```

Add to `package.json` scripts: `"test-set": "tsx --conditions=react-server scripts/test-set.ts"` (the `react-server` condition makes `server-only` a no-op outside Next).

- [ ] **Step 3: Run it**

Run: `pnpm test-set` — Expected: every trap shows `hint: rejected/...` (`pyunkangyul.us` hijacked, `jumiso.com` parked, `roundaround.co.kr` offline) and no trap is chosen. Record the accuracy line. Sites that block or time out from this machine (e.g. `dr-g.co.kr`) are reported as `✗` with `unreachable`; that is a real result, not a failure of the runner.

If `GOOGLE_GENERATIVE_AI_API_KEY` is set, also run `pnpm test-set --no-hints` and record its accuracy line.

- [ ] **Step 4: Commit**

```bash
git add tests/test-set.ts scripts/test-set.ts package.json
git commit -m "test: website accuracy runner over the 16 audited brands

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Next plans

- **2b Instagram** — `ig-lookup` (Business Discovery via the Meta app, long-lived token), `ig-badge`, `link-page`; candidates from `brand_pages.facts.instagram`.
- **2c TikTok** — link-preview check and the GitHub Actions browser runner.
- **2d Images and scoring** — `image-check`, logo/cover candidates from `brand_pages`, the full scoring pass and review counts; test-set accuracy for every field.
