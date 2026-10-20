# Brand Enrich — Step 2c: TikTok — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The research job's `tiktok` step finds each brand's official TikTok account from the handles its own sites and its Instagram bio page link (plus the Instagram handle and a few name variants when those link none), reads each candidate's public profile, scores it per spec §7, chooses the global account, and shows the evidence on the brand page.

**Architecture:** Same shape as 2b. Pure functions decide — `parseProfile` (TikTok profile HTML → profile or reason), `sameLink`, `scoreTiktok`, `chooseTiktok` — and are unit-tested. Network functions (`lookupProfile`, `readLinkPage`, 2b's `checkBioLink`) are injected into `researchTiktok`, which never touches the database; `tiktok-step.ts` persists. Page loading shared with the Instagram step moves to `src/lib/research/pages.ts`.

**Tech Stack:** fetch; cheerio via 2a's `extractFacts`; Prisma 7; Vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-brand-enrich-design.md` — §5 (`tiktok-lookup`, `link-page`), §6 step 4, §7 TikTok rules, §9, §10. Builds on 2b (`docs/superpowers/plans/2026-10-21-facts-2b-instagram.md`).

### Decision: no browser runner in 2c (revises spec §3/§4 "TikTok data")

Probed 2026-10-20: a plain request for `https://www.tiktok.com/@<handle>` with a desktop Chrome user agent returns the profile JSON in `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">` → `__DEFAULT_SCOPE__["webapp.user-detail"]`: `statusCode` (0 = found, 10221 = no such account), `userInfo.user` (`uniqueId`, `nickname`, `verified`, `bioLink.link`, `signature`, `privateAccount`) and `userInfo.stats.followerCount`. That is everything the runner was for (badge and bio link). Googlebot gets 403 and `facebookexternalhit` gets a stub, so the Chrome UA is required. The GitHub Actions runner is dropped from 2c; if TikTok starts blocking, failures surface as "Couldn't check" (review) and the runner can be added then. (The repo also has no remote yet.)

Instagram bio pages (Linktree and similar) list the TikTok account for 11 of the 16 audited brands, often where the brand's site does not (JavaScript-rendered sites), so they are a discovery source.

## Global Constraints

- All scaffold, 2a and 2b constraints apply (`AGENTS.md`). No schema change: `FieldName` already has `tiktok`.
- TikTok verdicts per spec §7: **proven** = linked from the brand's site, or from the brand's chosen Instagram account's bio page, or the TikTok bio link reaches the brand's domain, or the TikTok bio link is the same page as the Instagram bio link. **review** = found by name only, or couldn't check (blocked). **rejected** = does not exist, or followers under 5% of the largest candidate's, or found by name only with under 100 followers (impostor; added after the first live run picked an 18-follower @roundaround_official).
- TikTok requests: one at a time, 3 s apart, at most 8 profile lookups per brand; after a blocked lookup, no more name variants are tried for that brand.
- Choosing between proven accounts: linked from a global page (the brand's global site, or the global Instagram account's bio page) first, then a name containing "global", then most followers.
- Log lines in plain language for a non-technical reader; no tool names or status codes.

## File Structure

```
src/lib/tiktok/profile.ts        parseProfile (pure) + lookupProfile (paced fetch)
src/lib/tiktok/profile.test.ts
src/lib/tiktok/link-page.ts      readLinkPage(url) → TikTok handles on a page
src/lib/tiktok/score.ts          TtCandidate, sameLink, scoreTiktok, chooseTiktok
src/lib/tiktok/score.test.ts
src/lib/tiktok/research.ts       researchTiktok — orchestration with injected deps
src/lib/tiktok/research.test.ts
src/lib/research/pages.ts        loadResearchPages(brandId) — shared by the Instagram and TikTok steps
src/lib/research/tiktok-step.ts  runTiktokStep(brandId, log)
Modify: src/lib/research/instagram-step.ts, src/lib/inngest/functions/research-brand.ts,
        src/lib/brands/scoped.ts, src/app/(app)/brands/[id]/page.tsx,
        tests/test-set.ts, scripts/test-set.ts, spec §3 table row "TikTok data"
```

---

### Task 1: Profile lookup

**Files:** Create `src/lib/tiktok/profile.ts`, `src/lib/tiktok/profile.test.ts`

**Interfaces:**
- Produces: `TtProfile`, `TtLookup`, `parseProfile(html: string, username: string): TtLookup`, `lookupProfile(username: string): Promise<TtLookup>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseProfile } from "@/lib/tiktok/profile";

const page = (detail: unknown) =>
  `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { "webapp.user-detail": detail } })}</script></html>`;

describe("parseProfile", () => {
  it("reads a found profile", () => {
    const html = page({
      statusCode: 0,
      userInfo: {
        user: { uniqueId: "celimax.global", nickname: "celimax.global", verified: false, signature: "Honest skin", privateAccount: false, bioLink: { link: "linktr.ee/celimax" } },
        stats: { followerCount: 229100 },
      },
    });
    expect(parseProfile(html, "celimax.global")).toEqual({
      ok: true,
      profile: { username: "celimax.global", name: "celimax.global", verified: false, bioLink: "https://linktr.ee/celimax", signature: "Honest skin", followers: 229100, private: false },
    });
  });

  it("says when the account does not exist", () => {
    expect(parseProfile(page({ statusCode: 10221 }), "nope")).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("treats a page without the profile data as blocked, not missing", () => {
    expect(parseProfile("<html>verify you are human</html>", "x")).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("never reads another account's data", () => {
    const html = page({ statusCode: 0, userInfo: { user: { uniqueId: "someone_else" }, stats: { followerCount: 5 } } });
    expect(parseProfile(html, "x")).toMatchObject({ ok: false, reason: "blocked" });
  });
});
```

- [ ] **Step 2: Run** `pnpm vitest run src/lib/tiktok/profile.test.ts` — expect FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
import * as cheerio from "cheerio";

export type TtProfile = {
  username: string;
  name: string | null;
  verified: boolean;
  bioLink: string | null;
  signature: string | null;
  followers: number;
  private: boolean;
};

export type TtLookup = { ok: true; profile: TtProfile } | { ok: false; reason: "not_found" | "blocked"; message: string };

/** TikTok's "no such account" status in the profile page's data. */
const NOT_FOUND = 10221;
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const PAUSE_MS = 3_000;

const BLOCKED = { ok: false, reason: "blocked", message: "TikTok didn't show the profile, so it couldn't be checked." } as const;

type Detail = {
  statusCode?: number;
  userInfo?: {
    user?: { uniqueId?: string; nickname?: string; verified?: boolean; signature?: string; privateAccount?: boolean; bioLink?: { link?: string } };
    stats?: { followerCount?: number };
  };
};

/**
 * The public profile page carries the profile as JSON for the app to hydrate. A page without it is
 * a bot check or a changed page: "blocked", never "doesn't exist".
 */
export function parseProfile(html: string, username: string): TtLookup {
  const raw = cheerio.load(html)("script#__UNIVERSAL_DATA_FOR_REHYDRATION__").text();
  if (!raw) return BLOCKED;
  let detail: Detail | undefined;
  try {
    detail = (JSON.parse(raw) as { __DEFAULT_SCOPE__?: Record<string, Detail> }).__DEFAULT_SCOPE__?.["webapp.user-detail"];
  } catch {
    return BLOCKED;
  }
  if (detail?.statusCode === NOT_FOUND) return { ok: false, reason: "not_found", message: "No TikTok account by this name." };
  const user = detail?.userInfo?.user;
  if (!user || user.uniqueId?.toLowerCase() !== username.toLowerCase()) return BLOCKED;
  const link = user.bioLink?.link?.trim() || null;
  return {
    ok: true,
    profile: {
      username: user.uniqueId.toLowerCase(),
      name: user.nickname || null,
      verified: user.verified === true,
      bioLink: link ? (/^https?:\/\//i.test(link) ? link : `https://${link}`) : null,
      signature: user.signature || null,
      followers: detail?.userInfo?.stats?.followerCount ?? 0,
      private: user.privateAccount === true,
    },
  };
}

let last = 0;

/** Paced, one at a time, never throws: any failure is "blocked". */
export async function lookupProfile(username: string): Promise<TtLookup> {
  const wait = last + PAUSE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  try {
    const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
      headers: { "user-agent": CHROME, "accept-language": "en-US,en;q=0.9", accept: "text/html" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return BLOCKED;
    return parseProfile(await res.text(), username);
  } catch {
    return BLOCKED;
  }
}
```

- [ ] **Step 4: Run** the test — expect PASS.
- [ ] **Step 5: Commit** `feat(tiktok): read public profile pages`

---

### Task 2: Scoring and choice

**Files:** Create `src/lib/tiktok/score.ts`, `src/lib/tiktok/score.test.ts`

**Interfaces:**
- Consumes: `TtLookup` (Task 1)
- Produces:
  - `TtCandidate = { handle: string; foundOn: { url: string; region: "global"|"us"|"kr"|"other"; kind: "site"|"instagram-bio" }[]; lookup: TtLookup; bio: { reached: string|null; via: string|null }; sameBioAsInstagram: boolean }`
  - `TtVerdict = { score: "proven"|"review"|"rejected"; reason: string }`
  - `sameLink(a: string|null, b: string|null): boolean`, `scoreTiktok(c, maxFollowers): TtVerdict`, `chooseTiktok(scored): TtCandidate | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { chooseTiktok, sameLink, scoreTiktok, type TtCandidate } from "@/lib/tiktok/score";

const cand = (handle: string, over: Partial<TtCandidate> & { followers?: number; name?: string } = {}): TtCandidate => {
  const { followers, name, ...rest } = over;
  return {
    handle,
    foundOn: [],
    bio: { reached: null, via: null },
    sameBioAsInstagram: false,
    lookup: { ok: true, profile: { username: handle, name: name ?? null, verified: false, bioLink: null, signature: null, followers: followers ?? 100_000, private: false } },
    ...rest,
  };
};

describe("sameLink", () => {
  it("ignores scheme, www, trailing slash, query and case", () => {
    expect(sameLink("https://linktr.ee/Jumiso?utm_source=x", "linktr.ee/jumiso/")).toBe(true);
    expect(sameLink("http://www.beacons.page/benton", "https://beacons.page/benton")).toBe(true);
    expect(sameLink("https://linktr.ee/a", "https://linktr.ee/b")).toBe(false);
    expect(sameLink(null, "https://linktr.ee/a")).toBe(false);
  });
});

describe("scoreTiktok", () => {
  it("proves an account the brand's site links", () => {
    const v = scoreTiktok(cand("celimax.global", { foundOn: [{ url: "https://celimax.com/", region: "global", kind: "site" }] }), 100_000);
    expect(v).toEqual({ score: "proven", reason: "Linked from celimax.com." });
  });

  it("proves an account the Instagram bio page links", () => {
    const v = scoreTiktok(cand("tirtir.official", { foundOn: [{ url: "https://linktr.ee/TIRTIRGLOBAL", region: "global", kind: "instagram-bio" }] }), 100_000);
    expect(v).toEqual({ score: "proven", reason: "Linked from the brand's Instagram bio page (linktr.ee)." });
  });

  it("proves an account whose bio link reaches the brand or matches the Instagram bio", () => {
    expect(scoreTiktok(cand("a", { bio: { reached: "jumiso.us", via: "https://linktr.ee/jumiso" } }), 100_000).score).toBe("proven");
    expect(scoreTiktok(cand("bentoncosmetic", { sameBioAsInstagram: true }), 100_000)).toEqual({
      score: "proven",
      reason: "Bio link is the same page as the brand's Instagram bio.",
    });
  });

  it("rejects a missing account and a tiny one next to a big candidate", () => {
    expect(scoreTiktok(cand("x", { lookup: { ok: false, reason: "not_found", message: "No TikTok account by this name." } }), 0).score).toBe("rejected");
    expect(scoreTiktok(cand("tirtir_official", { followers: 2 }), 900_000).score).toBe("rejected");
  });

  it("sends a name-only match or a blocked check to review", () => {
    expect(scoreTiktok(cand("benton"), 100_000).score).toBe("review");
    const blocked = scoreTiktok(cand("x", { lookup: { ok: false, reason: "blocked", message: "TikTok didn't show the profile, so it couldn't be checked." } }), 0);
    expect(blocked).toEqual({ score: "review", reason: "Couldn't check: TikTok didn't show the profile, so it couldn't be checked." });
  });
});

describe("chooseTiktok", () => {
  it("prefers a global link, then a global name, then followers", () => {
    const kr = cand("brand_kr", { followers: 900_000, foundOn: [{ url: "https://brand.co.kr", region: "kr", kind: "site" }] });
    const gl = cand("brand.global", { followers: 50_000, foundOn: [{ url: "https://linktr.ee/brand", region: "global", kind: "instagram-bio" }] });
    const scored = [kr, gl].map((c) => ({ candidate: c, verdict: scoreTiktok(c, 900_000) }));
    expect(chooseTiktok(scored)?.handle).toBe("brand.global");
  });

  it("falls back to review candidates and returns null when all are rejected", () => {
    const r = cand("benton");
    expect(chooseTiktok([{ candidate: r, verdict: { score: "review", reason: "" } }])?.handle).toBe("benton");
    expect(chooseTiktok([{ candidate: r, verdict: { score: "rejected", reason: "" } }])).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `pnpm vitest run src/lib/tiktok/score.test.ts` — expect FAIL.

- [ ] **Step 3: Implement**

```ts
import type { TtLookup } from "@/lib/tiktok/profile";

export type TtCandidate = {
  handle: string;
  foundOn: { url: string; region: "global" | "us" | "kr" | "other"; kind: "site" | "instagram-bio" }[];
  lookup: TtLookup;
  bio: { reached: string | null; via: string | null };
  sameBioAsInstagram: boolean;
};

export type TtVerdict = { score: "proven" | "review" | "rejected"; reason: string };

/** Under this share of the biggest candidate's followers, an account is an impostor (spec §7). */
const TINY_SHARE = 0.05;

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Two links to the same page, however they were written ("linktr.ee/Jumiso?utm…" = "https://linktr.ee/jumiso/"). */
export function sameLink(a: string | null, b: string | null): boolean {
  const norm = (u: string | null) =>
    u
      ? u
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/[?#].*$/, "")
          .replace(/\/+$/, "")
      : null;
  const [x, y] = [norm(a), norm(b)];
  return x !== null && x === y;
}

/** Spec §7, TikTok. The badge is evidence only and never changes the score. */
export function scoreTiktok(c: TtCandidate, maxFollowers: number): TtVerdict {
  if (!c.lookup.ok) {
    return c.lookup.reason === "not_found" ? { score: "rejected", reason: c.lookup.message } : { score: "review", reason: `Couldn't check: ${c.lookup.message}` };
  }
  const p = c.lookup.profile;
  if (maxFollowers > 0 && p.followers < maxFollowers * TINY_SHARE) {
    return { score: "rejected", reason: `Only ${p.followers.toLocaleString("en-US")} followers next to a ${maxFollowers.toLocaleString("en-US")}-follower candidate.` };
  }
  const site = c.foundOn.find((f) => f.kind === "site");
  if (site) return { score: "proven", reason: `Linked from ${host(site.url)}.` };
  const bioPage = c.foundOn.find((f) => f.kind === "instagram-bio");
  if (bioPage) return { score: "proven", reason: `Linked from the brand's Instagram bio page (${host(bioPage.url)}).` };
  if (c.bio.reached) return { score: "proven", reason: `Bio link reaches ${c.bio.reached}.` };
  if (c.sameBioAsInstagram) return { score: "proven", reason: "Bio link is the same page as the brand's Instagram bio." };
  return { score: "review", reason: "Exists, but nothing ties it to the brand." };
}

const followers = (c: TtCandidate) => (c.lookup.ok ? c.lookup.profile.followers : 0);
const fromGlobal = (c: TtCandidate) => c.foundOn.some((f) => f.region === "global");
const namedGlobal = (c: TtCandidate) => (c.lookup.ok ? /global/i.test(`${c.lookup.profile.name ?? ""} ${c.handle}`) : false);

/** Global link first, then a "Global" name, then followers — the Instagram rule (Global Constraints). */
export function chooseTiktok(scored: { candidate: TtCandidate; verdict: TtVerdict }[]): TtCandidate | null {
  const rank = (c: TtCandidate) => [fromGlobal(c) ? 0 : 1, namedGlobal(c) ? 0 : 1, -followers(c)];
  const better = (a: TtCandidate, b: TtCandidate) => {
    const [x, y] = [rank(a), rank(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i];
    return false;
  };
  for (const level of ["proven", "review"] as const) {
    const pool = scored.filter((s) => s.verdict.score === level).map((s) => s.candidate);
    if (pool.length > 0) return pool.reduce((best, c) => (better(c, best) ? c : best));
  }
  return null;
}
```

- [ ] **Step 4: Run** the test — expect PASS.
- [ ] **Step 5: Commit** `feat(tiktok): score and choose accounts`

---

### Task 3: Research orchestration and link pages

**Files:** Create `src/lib/tiktok/link-page.ts`, `src/lib/tiktok/research.ts`, `src/lib/tiktok/research.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2; `nameVariants`, `GLOBAL_SUFFIXES` from `@/lib/instagram/variants`; `checkBioLink` signature from `@/lib/instagram/bio-link`; `extractFacts` from `@/lib/website/extract`; `fetchPage` from `@/lib/website/fetch-page`.
- Produces:
  - `readLinkPage(url: string): Promise<string[]>`
  - `TiktokDeps = { lookupProfile(h): Promise<TtLookup>; readLinkPage(url): Promise<string[]>; checkBioLink(website, domains, brand): Promise<{ reached; via }> }`
  - `TiktokInput = { brand: string; pages: { url: string; region: Region; facts: PageFacts }[]; brandDomains: string[]; instagram: { handle: string; website: string | null } | null }`
  - `researchTiktok(input, deps, log?): Promise<{ scored: { candidate: TtCandidate; verdict: TtVerdict }[]; chosen: TtCandidate | null }>`

- [ ] **Step 1: Write the failing test** (`research.test.ts`)

```ts
import { describe, expect, it, vi } from "vitest";
import { researchTiktok, type TiktokDeps } from "@/lib/tiktok/research";
import type { TtLookup } from "@/lib/tiktok/profile";
import type { PageFacts } from "@/lib/website/extract";

const facts = (tiktok: string[]): PageFacts => ({
  title: null, siteName: null, description: null, instagram: [], tiktok, regionalSites: [], lang: null, ogImage: null, icons: [], logoImages: [], jsonLdLogos: [],
});

const ok = (username: string, followers: number, bioLink: string | null = null, name: string | null = null): TtLookup => ({
  ok: true,
  profile: { username, name, verified: false, bioLink, signature: null, followers, private: false },
});

function deps(profiles: Record<string, TtLookup>, linkPage: string[] = []) {
  return {
    lookupProfile: vi.fn(async (h: string): Promise<TtLookup> => profiles[h] ?? { ok: false, reason: "not_found", message: "No TikTok account by this name." }),
    readLinkPage: vi.fn(async () => linkPage),
    checkBioLink: vi.fn(async () => ({ reached: null, via: null })),
  } satisfies TiktokDeps;
}

describe("researchTiktok", () => {
  it("proves the account the Instagram bio page links and rejects the impostor variant", async () => {
    const d = deps({ "tirtir.official": ok("tirtir.official", 900_900), tirtir_official: ok("tirtir_official", 2) }, ["tirtir.official"]);
    const r = await researchTiktok(
      { brand: "TIRTIR", brandDomains: ["tirtir.global"], pages: [], instagram: { handle: "tirtir_global", website: "https://linktr.ee/TIRTIRGLOBAL" } },
      d,
    );
    expect(d.readLinkPage).toHaveBeenCalledWith("https://linktr.ee/TIRTIRGLOBAL");
    expect(r.chosen?.handle).toBe("tirtir.official");
    expect(r.scored.find((s) => s.candidate.handle === "tirtir.official")?.verdict.score).toBe("proven");
  });

  it("tries the Instagram handle first when nothing links an account", async () => {
    const d = deps({ bentoncosmetic: ok("bentoncosmetic", 28_000, "https://beacons.page/bentoncosmetic_official", "Benton Global") });
    const r = await researchTiktok(
      { brand: "Benton", brandDomains: ["benton.co.kr"], pages: [], instagram: { handle: "bentoncosmetic", website: "https://beacons.page/bentoncosmetic_official" } },
      d,
    );
    expect(d.lookupProfile.mock.calls[0][0]).toBe("bentoncosmetic");
    expect(r.chosen?.handle).toBe("bentoncosmetic");
    expect(r.scored.find((s) => s.candidate.handle === "bentoncosmetic")?.verdict.reason).toBe("Bio link is the same page as the brand's Instagram bio.");
  });

  it("uses handles the brand's sites link", async () => {
    const d = deps({ "celimax.global": ok("celimax.global", 229_100) });
    const r = await researchTiktok(
      { brand: "Celimax", brandDomains: ["celimax.com"], pages: [{ url: "https://celimax.com/", region: "global", facts: facts(["celimax.global"]) }], instagram: null },
      d,
    );
    expect(r.chosen?.handle).toBe("celimax.global");
    expect(d.lookupProfile).toHaveBeenCalledTimes(1);
  });

  it("stops trying names after TikTok blocks a lookup", async () => {
    const d = deps({});
    d.lookupProfile.mockResolvedValue({ ok: false, reason: "blocked", message: "TikTok didn't show the profile, so it couldn't be checked." });
    await researchTiktok({ brand: "Acme", brandDomains: [], pages: [], instagram: null }, d);
    expect(d.lookupProfile).toHaveBeenCalledTimes(1);
  });

  it("never exceeds the lookup budget", async () => {
    const many = Array.from({ length: 12 }, (_, i) => `handle${i}`);
    const d = deps({});
    await researchTiktok({ brand: "Acme", brandDomains: [], pages: [{ url: "https://acme.com", region: "global", facts: facts(many) }], instagram: null }, d);
    expect(d.lookupProfile.mock.calls.length).toBeLessThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run** `pnpm vitest run src/lib/tiktok/research.test.ts` — expect FAIL.

- [ ] **Step 3: Implement `link-page.ts`**

```ts
import "server-only";
import { extractFacts } from "@/lib/website/extract";
import { fetchPage } from "@/lib/website/fetch-page";

/** The TikTok handles a link page (Linktree and similar) lists. Never throws; a failed page lists none. */
export async function readLinkPage(url: string): Promise<string[]> {
  const page = await fetchPage(url);
  return page.ok ? extractFacts(page.html, page.finalUrl ?? url, "").tiktok : [];
}
```

- [ ] **Step 4: Implement `research.ts`**

```ts
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
```

Note the blocked test: the first name lookup sets `blocked`, and the loop's guard stops before the second. The test expects exactly one call.

- [ ] **Step 5: Run** the test — expect PASS. Then `pnpm -s typecheck`.
- [ ] **Step 6: Commit** `feat(tiktok): research accounts from sites, Instagram bio page and names`

---

### Task 4: Job step, persistence and brand page

**Files:** Create `src/lib/research/pages.ts`, `src/lib/research/tiktok-step.ts`; modify `src/lib/research/instagram-step.ts`, `src/lib/inngest/functions/research-brand.ts`, `src/lib/brands/scoped.ts`, `src/app/(app)/brands/[id]/page.tsx`

**Interfaces:**
- Produces: `loadResearchPages(brandId): Promise<{ name: string; pages: TiktokInput["pages"]; brandDomains: string[] }>`; `runTiktokStep(brandId: string, log: ResearchLog): Promise<void>`; `BrandDetail.tiktok: FieldSection`

- [ ] **Step 1: `pages.ts`** — move the page/domain loading out of `instagram-step.ts`:

```ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { siteRegion, type CheckedSite } from "@/lib/website/research";
import { registrableDomain } from "@/lib/website/domain";
import type { PageFacts } from "@/lib/website/extract";

/** What the social steps read from the website step: the brand's live pages with their market, and its domains. */
export async function loadResearchPages(brandId: string) {
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: brandId },
    include: { pages: { where: { source: "live" } }, candidates: { where: { field: "website" } } },
  });
  const brandDomains = [
    ...new Set(brand.candidates.filter((c) => c.score !== "rejected").map((c) => registrableDomain(new URL(c.value).hostname))),
  ];
  const pages = brand.pages.map((p) => {
    const facts = p.facts as PageFacts;
    // siteRegion reads only the site's URL and facts; a minimal CheckedSite carries both.
    const site = { url: p.url, source: "hint", verdict: { score: "proven", kind: "ok", reason: "", siteUrl: p.url }, facts, archive: null } as CheckedSite;
    return { url: p.url, region: siteRegion(site), facts };
  });
  return { name: brand.name, pages, brandDomains };
}
```

`instagram-step.ts` then starts with `const { name, pages, brandDomains } = await loadResearchPages(brandId);` and passes `brand: name`; drop its now-unused imports.

- [ ] **Step 2: `tiktok-step.ts`**

```ts
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lookupProfile } from "@/lib/tiktok/profile";
import { readLinkPage } from "@/lib/tiktok/link-page";
import { checkBioLink } from "@/lib/instagram/bio-link";
import { researchTiktok } from "@/lib/tiktok/research";
import { loadResearchPages } from "@/lib/research/pages";
import type { ResearchLog } from "@/lib/research/log-types";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/**
 * Runs inside the Inngest job, after the Instagram step, so it takes no scope (AGENTS.md rule 2
 * exception). Re-running replaces the TikTok candidates and the auto selection.
 */
export async function runTiktokStep(brandId: string, log: ResearchLog): Promise<void> {
  const [{ name, pages, brandDomains }, ig] = await Promise.all([
    loadResearchPages(brandId),
    prisma.selection.findFirst({ where: { brandId, field: "instagram" }, include: { candidate: true } }),
  ]);
  const igEvidence = (ig?.candidate?.evidence ?? {}) as { website?: string | null };
  const instagram = ig?.candidate ? { handle: ig.candidate.value, website: igEvidence.website ?? null } : null;

  // The network work happens before the transaction, so no database connection waits on TikTok.
  const { scored, chosen } = await researchTiktok({ brand: name, pages, brandDomains, instagram }, { lookupProfile, readLinkPage, checkBioLink }, log);

  await prisma.$transaction(async (tx) => {
    await tx.selection.deleteMany({ where: { brandId, field: "tiktok" } });
    await tx.candidate.deleteMany({ where: { brandId, field: "tiktok" } });
    let chosenId: string | null = null;
    for (const { candidate: c, verdict } of scored) {
      const p = c.lookup.ok ? c.lookup.profile : null;
      const first = c.foundOn[0];
      const row = await tx.candidate.create({
        data: {
          brandId,
          field: "tiktok",
          value: c.handle,
          source: !first ? "Name variant" : first.kind === "site" ? `Linked from ${host(first.url)}` : `Linked from the Instagram bio page (${host(first.url)})`,
          score: verdict.score,
          reason: verdict.reason,
          evidence: json({
            followers: p?.followers ?? null,
            name: p?.name ?? null,
            verified: p?.verified ?? null,
            private: p?.private ?? null,
            bioLink: p?.bioLink ?? null,
            bioReached: c.bio.reached,
            sameBioAsInstagram: c.sameBioAsInstagram,
            lookup: c.lookup.ok ? "ok" : c.lookup.reason,
          }),
        },
        select: { id: true },
      });
      if (c === chosen) chosenId = row.id;
    }
    if (chosenId) await tx.selection.create({ data: { brandId, field: "tiktok", candidateId: chosenId, chosenBy: "auto" } });
  });
}
```

- [ ] **Step 3: Wire the job** — in `research-brand.ts` import `runTiktokStep`, add `tiktok: runTiktokStep` to `RUNNERS`, delete the `tiktok` line from `NOT_YET`.

- [ ] **Step 4: Reader** — in `scoped.ts`: `FIELDS = ["website", "instagram", "tiktok"] as const`, add `tiktok: FieldSection` to `BrandDetail` and `tiktok: section("tiktok")` to the return.

- [ ] **Step 5: Brand page** — add a TikTok section after Instagram, same shape as the Instagram one; facts = name, followers, "verified badge"/"no badge", "private account", "bio reaches X" or "same bio link as Instagram"; link `https://www.tiktok.com/@<handle>`. Replace the "Found on the brand's sites" section with a single "Pages read" list row, and change its footnote to "Logo and cover are checked in the next build step." Remove the unused `found` helper.

- [ ] **Step 6: Verify** — `pnpm -s typecheck && pnpm -s lint && pnpm -s test`.
- [ ] **Step 7: Commit** `feat(tiktok): run the TikTok step in the research job and show it on the brand page`

---

### Task 5: Test set and live run

**Files:** Modify `tests/test-set.ts`, `scripts/test-set.ts`, spec §3

- [ ] **Step 1: Ground truth.** Add `tiktok?: string | null` (undefined = not audited) and `ttTraps?: string[]` to `TestBrand`, with values confirmed 2026-10-20 (linked from the brand's site or its Instagram bio page, profile read):

| Brand | tiktok | ttTraps |
|---|---|---|
| haruharu wonder | `haruharuwonder_official` | `haruharuwonder` |
| numbuzin | `numbuzin_global` | |
| SOME BY MI | `somebymi.official` | |
| Pyunkang Yul | `pyunkangyul.official` | |
| Dr. Althea | `dr.althea_official` | |
| Biodance | `biodance_global` | |
| Celimax | `celimax.global` | |
| Purito Seoul | `purito_official` | |
| Benton | `bentoncosmetic` | `benton_official` |
| Round A'Round | — | `roundaround_official` |
| Dear, Klairs | `klairs.global` | |
| Jumiso | `jumiso_global` | |
| TIRTIR | `tirtir.official` | `tirtir_official` |
| Dr.G | — | `drg_global` |

AXIS-Y and Aestura: not audited (no TikTok link found anywhere).

- [ ] **Step 2: Runner.** In `scripts/test-set.ts`, after Instagram: call `researchTiktok` with `instagram: ig.chosen ? { handle: ig.chosen.handle, website: ig.chosen.discovery.ok ? ig.chosen.discovery.profile.website : null } : null` and deps `{ lookupProfile, readLinkPage, checkBioLink }`. Count `ttRight` over brands where `b.tiktok` is a string; a chosen `ttTraps` handle fails the run; print `· tt <got>` per row and `TikTok: right X/Y.` at the end; note `[tiktok: blocked]` when any lookup was blocked.

- [ ] **Step 3: Spec.** §3 row "TikTok data" → "Public profile page read directly (name, followers, badge, bio link); the Instagram bio page as a discovery source. A browser runner only if TikTok starts blocking (revised 2026-10-20)".

- [ ] **Step 4: Run** `pnpm test-set` (hints). Target: TikTok right on at least 12 of the 14 audited brands, no trap chosen; Instagram stays 16/16.
- [ ] **Step 5: Live job.** Retry Jumiso from the UI (or send the Inngest event) and confirm the TikTok lines and section.
- [ ] **Step 6: Commit** `test(tiktok): test-set ground truth and accuracy`
