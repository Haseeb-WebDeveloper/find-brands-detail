# Brand Enrich — Step 2b: Instagram — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The research job's `instagram` step finds each brand's official Instagram account from the handles its own sites link (plus a few name variants when they link none), checks every candidate through Meta's Business Discovery, the verified-badge page and the bio link, scores it per spec §7, chooses the global account, and shows the evidence on the brand page.

**Architecture:** Same shape as 2a. Pure functions decide — `parseDiscovery` (Graph API JSON → profile or reason), `parseBadge` (crawler page → verified or unknown), `bioReachesBrand` (link page → reaches the brand's domains), `nameVariants`, `scoreInstagram`, `chooseInstagram` — and are unit-tested. Network functions (`lookupBusiness`, `fetchBadge`, `fetchPage`) are injected into `researchInstagram`, which never touches the database; `instagram-step.ts` persists. A one-off script exchanges a short Explorer token for a 60-day token and writes it to `.env.local` without printing it.

**Tech Stack:** Meta Graph API v26.0 (Business Discovery) via the existing app "Roofing"; fetch; cheerio (2a); Prisma 7; Vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-brand-enrich-design.md` — §5 (`ig-lookup`, `ig-badge`, `link-page`), §6 step 3, §7 Instagram rules, §9 (Meta token banner, limits), §10. Builds on 2a (`docs/superpowers/plans/2026-10-21-facts-2a-website.md`).

## Global Constraints

- All scaffold and 2a constraints apply (`AGENTS.md`), including rule 6 for schema changes (no schema change is planned here).
- Instagram verdicts exactly per spec §7: **proven** = Business Discovery succeeds **and** (linked from the brand's site **or** the bio link, following link pages, reaches the brand's domain) **and** it is the global account when several qualify; the verified badge is evidence, never required. **review** = exists but nothing ties it to the brand. **rejected** = not a business account (or does not exist), or followers under 5% of the largest candidate's.
- Meta limits: Business Discovery calls are sequential, at most 8 per brand; name variants only when the brand's sites link no handle that Business Discovery accepts.
- Badge check: Googlebot user agent, one request at a time with a 2 s pause; any failure is "unknown", never "not verified".
- Secrets: `META_ACCESS_TOKEN` and `META_APP_SECRET` are server-only, never printed, logged or sent to the browser.
- Choosing between proven accounts: linked from the brand's **global** site first (2a's `siteRegion`), then an account whose name contains "global", then most followers.

## File Structure

```
src/lib/instagram/variants.ts       nameVariants(brand)
src/lib/instagram/discovery.ts      parseDiscovery (pure) + lookupBusiness (Graph API)
src/lib/instagram/badge.ts          parseBadge (pure) + fetchBadge (crawler page)
src/lib/instagram/bio-link.ts       bioReachesBrand (pure) + checkBioLink (network)
src/lib/instagram/score.ts          scoreInstagram, chooseInstagram
src/lib/instagram/research.ts       researchInstagram — orchestration with injected deps
src/lib/instagram/token.ts          metaTokenStatus() for the expiry banner
src/lib/research/instagram-step.ts  runInstagramStep — persists
scripts/meta-token.ts               exchange a short token for a 60-day one into .env.local
src/components/app/meta-token-banner.tsx   warning in the shell when the token is near expiry
src/app/(app)/brands/[id]/page.tsx  + Instagram section
tests/test-set.ts, scripts/test-set.ts     + expected Instagram handles and traps
```

---

### Task 1: Meta token setup

**Files:**
- Create: `scripts/meta-token.ts`, `src/lib/instagram/token.ts`, `src/lib/instagram/token.test.ts`
- Modify: `package.json` (script `meta:token`), `.env.example`

**Interfaces:**
- Produces:
  - `pnpm meta:token` — reads `META_APP_ID`, `META_APP_SECRET` and a short-lived `META_TEST_USER_TOKEN` from `.env.local`; exchanges it for a long-lived token; finds the Instagram business account the token can use; writes `META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_TOKEN_EXPIRES_AT` (ISO) into `.env.local`, replacing old values; prints only the IG username and the expiry date.
  - `metaTokenStatus(now?: Date): { configured: boolean; expiresAt: string | null; daysLeft: number | null; warn: boolean }` — `warn` when 7 days or fewer remain, or the token is missing.

- [ ] **Step 1: Write the failing test `src/lib/instagram/token.test.ts`**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { metaTokenStatus } from "@/lib/instagram/token";

afterEach(() => {
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.META_IG_USER_ID;
  delete process.env.META_TOKEN_EXPIRES_AT;
});

describe("metaTokenStatus", () => {
  const now = new Date("2026-10-21T00:00:00Z");

  it("warns when nothing is configured", () => {
    expect(metaTokenStatus(now)).toEqual({ configured: false, expiresAt: null, daysLeft: null, warn: true });
  });

  it("is quiet with weeks left", () => {
    process.env.META_ACCESS_TOKEN = "t";
    process.env.META_IG_USER_ID = "1";
    process.env.META_TOKEN_EXPIRES_AT = "2026-12-15T00:00:00Z";
    expect(metaTokenStatus(now)).toMatchObject({ configured: true, daysLeft: 55, warn: false });
  });

  it("warns in the last week and after expiry", () => {
    process.env.META_ACCESS_TOKEN = "t";
    process.env.META_IG_USER_ID = "1";
    process.env.META_TOKEN_EXPIRES_AT = "2026-10-26T00:00:00Z";
    expect(metaTokenStatus(now)).toMatchObject({ daysLeft: 5, warn: true });
    process.env.META_TOKEN_EXPIRES_AT = "2026-10-01T00:00:00Z";
    expect(metaTokenStatus(now)).toMatchObject({ daysLeft: -20, warn: true });
  });
});
```

Run: `pnpm test src/lib/instagram/token.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement `src/lib/instagram/token.ts`**

```ts
const DAY_MS = 24 * 60 * 60 * 1000;

/** Spec §9: the app warns before the 60-day Meta token runs out. Reads env only; never the token's value. */
export function metaTokenStatus(now = new Date()): { configured: boolean; expiresAt: string | null; daysLeft: number | null; warn: boolean } {
  const configured = Boolean(process.env.META_ACCESS_TOKEN && process.env.META_IG_USER_ID);
  const expiresAt = process.env.META_TOKEN_EXPIRES_AT ?? null;
  if (!configured) return { configured: false, expiresAt: null, daysLeft: null, warn: true };
  const daysLeft = expiresAt ? Math.floor((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS) : null;
  return { configured, expiresAt, daysLeft, warn: daysLeft !== null && daysLeft <= 7 };
}
```

Run: `pnpm test src/lib/instagram/token.test.ts` — Expected: PASS, 3 tests.

- [ ] **Step 3: Write `scripts/meta-token.ts`**

```ts
/**
 * Swap a short Graph API Explorer token for a 60-day one:
 *   1. Explorer → app "Roofing" → permissions instagram_basic, instagram_manage_insights,
 *      pages_show_list, pages_read_engagement, business_management → Generate Access Token.
 *   2. Paste it into .env.local as META_TEST_USER_TOKEN=...
 *   3. pnpm meta:token
 * Writes META_ACCESS_TOKEN, META_IG_USER_ID and META_TOKEN_EXPIRES_AT into .env.local. Prints no secret.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const V = process.env.META_API_VERSION ?? "v26.0";
const { META_APP_ID: appId, META_APP_SECRET: secret, META_TEST_USER_TOKEN: short } = process.env;
if (!appId || !secret || !short) {
  console.error("Set META_APP_ID, META_APP_SECRET and META_TEST_USER_TOKEN in .env.local first.");
  process.exit(1);
}

async function graph(path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${V}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const body = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (body.error) throw new Error(`${path}: ${body.error.message ?? "Graph API error"}`);
  return body;
}

const exchanged = await graph("oauth/access_token", {
  grant_type: "fb_exchange_token",
  client_id: appId,
  client_secret: secret,
  fb_exchange_token: short,
});
const token = String(exchanged.access_token);
const expiresIn = Number(exchanged.expires_in ?? 60 * 24 * 60 * 60);
const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

// The Instagram business account: through the person's Pages, or a Business Manager's pages.
type Page = { instagram_business_account?: { id: string; username: string } };
const pages = (await graph("me/accounts", { fields: "instagram_business_account{id,username}", access_token: token })).data as Page[];
let ig = pages.find((p) => p.instagram_business_account)?.instagram_business_account;
if (!ig) {
  type Biz = { owned_pages?: { data: Page[] } };
  const biz = (await graph("me/businesses", { fields: "owned_pages{instagram_business_account{id,username}}", access_token: token })).data as Biz[];
  ig = biz.flatMap((b) => b.owned_pages?.data ?? []).find((p) => p.instagram_business_account)?.instagram_business_account;
}
if (!ig) {
  console.error("This token can't see an Instagram business account. Tick the Page and the Instagram account when generating it.");
  process.exit(1);
}

const set = (src: string, key: string, value: string) =>
  new RegExp(`^${key}=.*$`, "m").test(src) ? src.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`) : `${src.trimEnd()}\n${key}=${value}\n`;
let env = readFileSync(".env.local", "utf8");
env = set(env, "META_ACCESS_TOKEN", token);
env = set(env, "META_IG_USER_ID", ig.id);
env = set(env, "META_TOKEN_EXPIRES_AT", expiresAt);
writeFileSync(".env.local", env);
console.log(`Saved a long-lived token for @${ig.username}. It expires ${expiresAt.slice(0, 10)}.`);
```

Add to `package.json` scripts: `"meta:token": "tsx scripts/meta-token.ts"`.

Append to `.env.example`:
```
# Meta app "Roofing" (same values as contractor-sites). Server only. Used by `pnpm meta:token`.
META_APP_ID=
META_APP_SECRET=
META_API_VERSION=v26.0
# Written by `pnpm meta:token` — a 60-day token and the Instagram business account it looks up from.
META_ACCESS_TOKEN=
META_IG_USER_ID=
META_TOKEN_EXPIRES_AT=
```

- [ ] **Step 4: Commit**

```bash
git add scripts/meta-token.ts src/lib/instagram/token.ts src/lib/instagram/token.test.ts package.json .env.example
git commit -m "feat(instagram): 60-day Meta token script and expiry status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Business Discovery

**Files:**
- Create: `src/lib/instagram/discovery.ts`, `src/lib/instagram/discovery.test.ts`

**Interfaces:**
- Produces:
  - `type IgProfile = { username: string; name: string | null; biography: string | null; website: string | null; followers: number; mediaCount: number; profilePictureUrl: string | null; recentMedia: { mediaType: string; mediaUrl: string | null; permalink: string; caption: string | null; timestamp: string }[] }`.
  - `type Discovery = { ok: true; profile: IgProfile } | { ok: false; reason: "not_business" | "token" | "rate_limited" | "error"; message: string }`.
  - `parseDiscovery(json: unknown): Discovery`.
  - `lookupBusiness(username: string): Promise<Discovery>` — never throws.

- [ ] **Step 1: Write the failing test `src/lib/instagram/discovery.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseDiscovery } from "@/lib/instagram/discovery";

describe("parseDiscovery", () => {
  it("reads a business profile", () => {
    const json = {
      business_discovery: {
        username: "tirtir_global",
        name: "TIRTIR Global Official",
        biography: "Redefine Your Radiance.",
        website: "https://linktr.ee/TIRTIRGLOBAL",
        followers_count: 810543,
        media_count: 892,
        profile_picture_url: "https://cdn/p.jpg",
        media: { data: [{ media_type: "IMAGE", media_url: "https://cdn/1.jpg", permalink: "https://ig/p/1", caption: "New", timestamp: "2026-10-14T00:00:00+0000" }] },
      },
      id: "17841447593921597",
    };
    expect(parseDiscovery(json)).toEqual({
      ok: true,
      profile: {
        username: "tirtir_global",
        name: "TIRTIR Global Official",
        biography: "Redefine Your Radiance.",
        website: "https://linktr.ee/TIRTIRGLOBAL",
        followers: 810543,
        mediaCount: 892,
        profilePictureUrl: "https://cdn/p.jpg",
        recentMedia: [{ mediaType: "IMAGE", mediaUrl: "https://cdn/1.jpg", permalink: "https://ig/p/1", caption: "New", timestamp: "2026-10-14T00:00:00+0000" }],
      },
    });
  });

  it("treats 'Invalid user id' as not a business account (the impostor case)", () => {
    expect(parseDiscovery({ error: { message: "Invalid user id", code: 110 } })).toEqual({
      ok: false,
      reason: "not_business",
      message: "Not a business or creator account, or it doesn't exist.",
    });
  });

  it("names token and rate-limit problems", () => {
    expect(parseDiscovery({ error: { message: "Error validating access token", code: 190 } })).toMatchObject({ ok: false, reason: "token" });
    expect(parseDiscovery({ error: { message: "Application request limit reached", code: 4 } })).toMatchObject({ ok: false, reason: "rate_limited" });
    expect(parseDiscovery({ error: { message: "boom", code: 1 } })).toMatchObject({ ok: false, reason: "error" });
  });
});
```

Run: `pnpm test src/lib/instagram/discovery.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `src/lib/instagram/discovery.ts`**

```ts
export type IgProfile = {
  username: string;
  name: string | null;
  biography: string | null;
  website: string | null;
  followers: number;
  mediaCount: number;
  profilePictureUrl: string | null;
  recentMedia: { mediaType: string; mediaUrl: string | null; permalink: string; caption: string | null; timestamp: string }[];
};

export type Discovery =
  | { ok: true; profile: IgProfile }
  | { ok: false; reason: "not_business" | "token" | "rate_limited" | "error"; message: string };

type RawMedia = { media_type?: string; media_url?: string; permalink?: string; caption?: string; timestamp?: string };
type Raw = {
  business_discovery?: {
    username?: string;
    name?: string;
    biography?: string;
    website?: string;
    followers_count?: number;
    media_count?: number;
    profile_picture_url?: string;
    media?: { data?: RawMedia[] };
  };
  error?: { message?: string; code?: number };
};

export function parseDiscovery(json: unknown): Discovery {
  const raw = (json ?? {}) as Raw;
  if (raw.error) {
    const message = raw.error.message ?? "";
    const code = raw.error.code;
    if (code === 110 || /invalid user id/i.test(message)) {
      return { ok: false, reason: "not_business", message: "Not a business or creator account, or it doesn't exist." };
    }
    if (code === 190 || /access token/i.test(message)) return { ok: false, reason: "token", message: "The Meta token is missing or expired." };
    if (code === 4 || code === 17 || code === 32 || code === 613 || /limit/i.test(message)) {
      return { ok: false, reason: "rate_limited", message: "Meta's hourly limit was reached." };
    }
    return { ok: false, reason: "error", message: message || "Meta returned an error." };
  }
  const d = raw.business_discovery;
  if (!d?.username) return { ok: false, reason: "error", message: "Meta returned no profile." };
  return {
    ok: true,
    profile: {
      username: d.username,
      name: d.name ?? null,
      biography: d.biography ?? null,
      website: d.website ?? null,
      followers: d.followers_count ?? 0,
      mediaCount: d.media_count ?? 0,
      profilePictureUrl: d.profile_picture_url ?? null,
      recentMedia: (d.media?.data ?? []).map((m) => ({
        mediaType: m.media_type ?? "UNKNOWN",
        mediaUrl: m.media_url ?? null,
        permalink: m.permalink ?? "",
        caption: m.caption ?? null,
        timestamp: m.timestamp ?? "",
      })),
    },
  };
}

const FIELDS =
  "username,name,biography,website,followers_count,media_count,profile_picture_url,media.limit(12){media_type,media_url,permalink,caption,timestamp}";

/** One Business Discovery call, as the business account in META_IG_USER_ID. Never throws. */
export async function lookupBusiness(username: string): Promise<Discovery> {
  const token = process.env.META_ACCESS_TOKEN;
  const igUser = process.env.META_IG_USER_ID;
  if (!token || !igUser) return { ok: false, reason: "token", message: "The Meta token is missing or expired." };
  const version = process.env.META_API_VERSION ?? "v26.0";
  const url = new URL(`https://graph.facebook.com/${version}/${igUser}`);
  url.searchParams.set("fields", `business_discovery.username(${username}){${FIELDS}}`);
  url.searchParams.set("access_token", token);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    return parseDiscovery(await res.json());
  } catch (error) {
    return { ok: false, reason: "error", message: error instanceof Error ? error.message : "Request failed." };
  }
}
```

Run: `pnpm test src/lib/instagram/discovery.test.ts` — Expected: PASS, 3 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/instagram/discovery.ts src/lib/instagram/discovery.test.ts
git commit -m "feat(instagram): Business Discovery lookup and response parsing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Verified badge and bio link

**Files:**
- Create: `src/lib/instagram/badge.ts`, `src/lib/instagram/bio-link.ts`, `src/lib/instagram/evidence.test.ts`

**Interfaces:**
- Consumes: `registrableDomain` (2a); `fetchPage`, `FetchedPage` (2a); `extractFacts` is not needed — link pages are read with cheerio here.
- Produces:
  - `parseBadge(html: string, username: string): boolean | null` — the `is_verified` flag belonging to `username`; `null` when the page doesn't say.
  - `fetchBadge(username: string): Promise<boolean | null>` — Googlebot UA, 2 s pause before each request, never throws.
  - `bioReachesBrand(page: { finalUrl: string | null; html: string }, brandDomains: string[]): string | null` — the brand domain the link reaches (the page's own final domain, or a link on it), else `null`.
  - `checkBioLink(website: string | null, brandDomains: string[]): Promise<{ reached: string | null; via: string | null }>` — `via` is the bio URL followed.

- [ ] **Step 1: Write the failing test `src/lib/instagram/evidence.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseBadge } from "@/lib/instagram/badge";
import { bioReachesBrand } from "@/lib/instagram/bio-link";

describe("parseBadge", () => {
  it("reads the flag next to the username", () => {
    const html = '..."full_name":"Purito Seoul Global Official","is_verified":true,..."username":"purito_official"...';
    expect(parseBadge(html, "purito_official")).toBe(true);
  });

  it("reads false", () => {
    expect(parseBadge('{"username":"biodance_official","is_verified":false}', "biodance_official")).toBe(false);
  });

  it("is unknown when the page doesn't carry the profile", () => {
    expect(parseBadge("<html>Login • Instagram</html>", "x")).toBeNull();
    expect(parseBadge('{"username":"someone_else","is_verified":true}', "x")).toBeNull();
  });
});

describe("bioReachesBrand", () => {
  const domains = ["tirtir.global", "tirtir.co.kr"];

  it("accepts a bio that is the brand's own site", () => {
    expect(bioReachesBrand({ finalUrl: "https://tirtir.global/pages/x", html: "" }, domains)).toBe("tirtir.global");
  });

  it("follows a link page to the brand's site", () => {
    const html = '<a href="https://shop.tirtir.global/collections">Shop</a><a href="https://instagram.com/x">IG</a>';
    expect(bioReachesBrand({ finalUrl: "https://linktr.ee/TIRTIRGLOBAL", html }, domains)).toBe("tirtir.global");
  });

  it("is null when nothing reaches the brand", () => {
    expect(bioReachesBrand({ finalUrl: "https://linktr.ee/x", html: '<a href="https://amazon.com/x">A</a>' }, domains)).toBeNull();
  });
});
```

Run: `pnpm test src/lib/instagram/evidence.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `src/lib/instagram/badge.ts`**

```ts
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const PAUSE_MS = 2_000;

/**
 * Instagram's crawler-facing page embeds the profile JSON. The flag must belong to `username`, not
 * to a suggested account elsewhere on the page, so the nearest flag within 400 characters of the
 * username's own JSON entry is read.
 */
export function parseBadge(html: string, username: string): boolean | null {
  const at = html.indexOf(`"username":"${username}"`);
  if (at < 0) return null;
  const window = html.slice(Math.max(0, at - 400), at + 400);
  const m = window.match(/"is_verified":(true|false)/);
  return m ? m[1] === "true" : null;
}

let last = 0;

/** Paced, never throws; any failure is "unknown" (null), never "not verified". */
export async function fetchBadge(username: string): Promise<boolean | null> {
  const wait = last + PAUSE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  try {
    const res = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      headers: { "user-agent": GOOGLEBOT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return parseBadge(await res.text(), username);
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Implement `src/lib/instagram/bio-link.ts`**

```ts
import * as cheerio from "cheerio";
import { registrableDomain } from "@/lib/website/domain";

function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return registrableDomain(new URL(url).hostname);
  } catch {
    return null;
  }
}

/** The brand domain this bio link reaches: the page itself, or a link on it (Linktree-style pages). */
export function bioReachesBrand(page: { finalUrl: string | null; html: string }, brandDomains: string[]): string | null {
  const wanted = new Set(brandDomains.map((d) => d.toLowerCase()));
  const own = domainOf(page.finalUrl);
  if (own && wanted.has(own)) return own;
  const $ = cheerio.load(page.html);
  for (const el of $("a[href]").toArray()) {
    const d = domainOf($(el).attr("href"));
    if (d && wanted.has(d)) return d;
  }
  return null;
}
```

Append the network half to the same file:

```ts
import { fetchPage } from "@/lib/website/fetch-page";

export async function checkBioLink(website: string | null, brandDomains: string[]): Promise<{ reached: string | null; via: string | null }> {
  if (!website || brandDomains.length === 0) return { reached: null, via: website };
  const page = await fetchPage(website);
  return { reached: page.ok ? bioReachesBrand(page, brandDomains) : null, via: website };
}
```

Put both `import` lines at the top of the file (cheerio, `registrableDomain`, `fetchPage`). `fetch-page.ts` imports `server-only`, which the test setup stubs, so the pure test still runs.

Run: `pnpm test src/lib/instagram/evidence.test.ts` — Expected: PASS, 6 tests.

- [ ] **Step 4: Commit**

```bash
git add src/lib/instagram/badge.ts src/lib/instagram/bio-link.ts src/lib/instagram/evidence.test.ts
git commit -m "feat(instagram): verified-badge and bio-link evidence

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Variants, scoring and choosing

**Files:**
- Create: `src/lib/instagram/variants.ts`, `src/lib/instagram/score.ts`, `src/lib/instagram/score.test.ts`

**Interfaces:**
- Consumes: `compactName`, `nameTokens` (2a); `Discovery`, `IgProfile` (Task 2).
- Produces:
  - `nameVariants(brand: string): string[]` — up to 5: `<compact>`, `<compact>_official`, `<compact>_global`, `<compact>.global`, `<compact>.official`.
  - `type IgCandidate = { handle: string; foundOn: { url: string; region: "global" | "us" | "kr" | "other" }[]; discovery: Discovery; verified: boolean | null; bio: { reached: string | null; via: string | null } }`.
  - `type IgVerdict = { score: "proven" | "review" | "rejected"; reason: string }`.
  - `scoreInstagram(c: IgCandidate, maxFollowers: number): IgVerdict`.
  - `chooseInstagram(scored: { candidate: IgCandidate; verdict: IgVerdict }[]): IgCandidate | null`.

- [ ] **Step 1: Write the failing test `src/lib/instagram/score.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { nameVariants } from "@/lib/instagram/variants";
import { chooseInstagram, scoreInstagram, type IgCandidate } from "@/lib/instagram/score";
import type { IgProfile } from "@/lib/instagram/discovery";

const profile = (over: Partial<IgProfile>): IgProfile => ({
  username: "x",
  name: null,
  biography: null,
  website: null,
  followers: 100_000,
  mediaCount: 100,
  profilePictureUrl: null,
  recentMedia: [],
  ...over,
});

const cand = (over: Partial<IgCandidate> & { handle: string; followers?: number; name?: string }): IgCandidate => ({
  foundOn: [],
  verified: null,
  bio: { reached: null, via: null },
  discovery: { ok: true, profile: profile({ username: over.handle, followers: over.followers ?? 100_000, name: over.name ?? null }) },
  ...over,
});

describe("nameVariants", () => {
  it("builds a few likely handles from the brand name", () => {
    expect(nameVariants("TIRTIR")).toEqual(["tirtir", "tirtir_official", "tirtir_global", "tirtir.global", "tirtir.official"]);
    expect(nameVariants("Dr. Althea")[0]).toBe("dralthea");
  });
});

describe("scoreInstagram", () => {
  it("proves a business account the brand's site links", () => {
    const c = cand({ handle: "tirtir_global", foundOn: [{ url: "https://tirtir.global", region: "global" }] });
    expect(scoreInstagram(c, 810_000)).toEqual({ score: "proven", reason: "Linked from tirtir.global." });
  });

  it("proves one whose bio reaches the brand's site, even unlinked", () => {
    const c = cand({ handle: "dr.g_official", bio: { reached: "dr-g.co.kr", via: "https://linktr.ee/drg_global" } });
    expect(scoreInstagram(c, 65_000).score).toBe("proven");
  });

  it("reviews an account nothing ties to the brand", () => {
    expect(scoreInstagram(cand({ handle: "somebymi_x" }), 100_000)).toMatchObject({ score: "review" });
  });

  it("rejects a non-business account (the @haruharu_wonder impostor)", () => {
    const c = cand({ handle: "haruharu_wonder", discovery: { ok: false, reason: "not_business", message: "Not a business or creator account, or it doesn't exist." } });
    expect(scoreInstagram(c, 242_000)).toEqual({ score: "rejected", reason: "Not a business or creator account, or it doesn't exist." });
  });

  it("rejects a tiny account next to a big one (the @numbuzin squatter)", () => {
    expect(scoreInstagram(cand({ handle: "numbuzin", followers: 26 }), 232_000)).toMatchObject({ score: "rejected" });
  });

  it("reviews when Meta couldn't answer, rather than rejecting", () => {
    const c = cand({ handle: "x", discovery: { ok: false, reason: "rate_limited", message: "Meta's hourly limit was reached." } });
    expect(scoreInstagram(c, 0)).toMatchObject({ score: "review" });
  });
});

describe("chooseInstagram", () => {
  it("prefers the account linked from the global site, then a 'Global' name, then followers", () => {
    const kr = cand({ handle: "tirtir_official", followers: 387_000, foundOn: [{ url: "https://tirtir.co.kr", region: "kr" }] });
    const global = cand({ handle: "tirtir_global", followers: 810_000, foundOn: [{ url: "https://tirtir.global", region: "global" }] });
    const scored = [kr, global].map((c) => ({ candidate: c, verdict: scoreInstagram(c, 810_000) }));
    expect(chooseInstagram(scored)?.handle).toBe("tirtir_global");

    const a = cand({ handle: "numbuzin_official", followers: 116_000, bio: { reached: "numbuzin.com", via: "x" } });
    const b = cand({ handle: "numbuzin_global", name: "official | numbuzin global", followers: 232_000, bio: { reached: "numbuzin.com", via: "x" } });
    expect(chooseInstagram([a, b].map((c) => ({ candidate: c, verdict: scoreInstagram(c, 232_000) })))?.handle).toBe("numbuzin_global");
  });

  it("falls back to the best review candidate, and to nothing", () => {
    const r = cand({ handle: "maybe" });
    expect(chooseInstagram([{ candidate: r, verdict: scoreInstagram(r, 100_000) }])?.handle).toBe("maybe");
    expect(chooseInstagram([])).toBeNull();
  });
});
```

Run: `pnpm test src/lib/instagram/score.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `src/lib/instagram/variants.ts`**

```ts
import { compactName } from "@/lib/website/domain";

/** Likely handles when the brand's sites link none. Instagram handles allow letters, digits, `.` and `_`. */
export function nameVariants(brand: string): string[] {
  const base = compactName(brand).slice(0, 22);
  if (!base) return [];
  return [base, `${base}_official`, `${base}_global`, `${base}.global`, `${base}.official`];
}
```

- [ ] **Step 3: Implement `src/lib/instagram/score.ts`**

```ts
import type { Discovery } from "@/lib/instagram/discovery";

export type IgCandidate = {
  handle: string;
  foundOn: { url: string; region: "global" | "us" | "kr" | "other" }[];
  discovery: Discovery;
  verified: boolean | null;
  bio: { reached: string | null; via: string | null };
};

export type IgVerdict = { score: "proven" | "review" | "rejected"; reason: string };

/** Under this share of the biggest candidate's followers, an account is a squatter (spec §7). */
const TINY_SHARE = 0.05;

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Spec §7, Instagram. The badge is evidence only and never changes the score. */
export function scoreInstagram(c: IgCandidate, maxFollowers: number): IgVerdict {
  if (!c.discovery.ok) {
    return c.discovery.reason === "not_business"
      ? { score: "rejected", reason: c.discovery.message }
      : { score: "review", reason: `Couldn't check: ${c.discovery.message}` };
  }
  const p = c.discovery.profile;
  if (maxFollowers > 0 && p.followers < maxFollowers * TINY_SHARE) {
    return { score: "rejected", reason: `Only ${p.followers.toLocaleString("en-US")} followers next to a ${maxFollowers.toLocaleString("en-US")}-follower candidate.` };
  }
  if (c.foundOn.length > 0) return { score: "proven", reason: `Linked from ${host(c.foundOn[0].url)}.` };
  if (c.bio.reached) return { score: "proven", reason: `Bio link reaches ${c.bio.reached}.` };
  return { score: "review", reason: "Exists, but nothing ties it to the brand." };
}

const followers = (c: IgCandidate) => (c.discovery.ok ? c.discovery.profile.followers : 0);
const fromGlobal = (c: IgCandidate) => c.foundOn.some((f) => f.region === "global");
const namedGlobal = (c: IgCandidate) => (c.discovery.ok ? /global/i.test(`${c.discovery.profile.name ?? ""} ${c.handle}`) : false);

/** Global-site link first, then a "Global" name, then followers (Global Constraints). */
export function chooseInstagram(scored: { candidate: IgCandidate; verdict: IgVerdict }[]): IgCandidate | null {
  const rank = (c: IgCandidate) => [fromGlobal(c) ? 0 : 1, namedGlobal(c) ? 0 : 1, -followers(c)];
  const better = (a: IgCandidate, b: IgCandidate) => {
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

Run: `pnpm test src/lib/instagram/score.test.ts` — Expected: PASS, 9 tests.

- [ ] **Step 4: Commit**

```bash
git add src/lib/instagram/variants.ts src/lib/instagram/score.ts src/lib/instagram/score.test.ts
git commit -m "feat(instagram): name variants, §7 scoring and choosing the global account

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `researchInstagram` orchestration

**Files:**
- Create: `src/lib/instagram/research.ts`, `src/lib/instagram/research.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4; `PageFacts` (2a).
- Produces:
  - `type InstagramDeps = { lookupBusiness(u: string): Promise<Discovery>; fetchBadge(u: string): Promise<boolean | null>; checkBioLink(website: string | null, domains: string[]): Promise<{ reached: string | null; via: string | null }> }`.
  - `type InstagramInput = { brand: string; pages: { url: string; region: "global" | "us" | "kr" | "other"; facts: PageFacts }[]; brandDomains: string[] }`.
  - `type InstagramResearch = { scored: { candidate: IgCandidate; verdict: IgVerdict }[]; chosen: IgCandidate | null }`.
  - `researchInstagram(input: InstagramInput, deps: InstagramDeps): Promise<InstagramResearch>`.

Rules: handles from `pages[].facts.instagram` (deduplicated, lowercase), each remembering which pages linked it. Each is looked up (max 8 lookups total). If none succeeds, `nameVariants` fill the remaining budget. For every candidate Business Discovery accepts: `fetchBadge` and `checkBioLink(profile.website, brandDomains)`. Then score with `maxFollowers` over accepted candidates and choose.

- [ ] **Step 1: Write the failing test `src/lib/instagram/research.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { researchInstagram, type InstagramDeps } from "@/lib/instagram/research";
import type { Discovery } from "@/lib/instagram/discovery";
import type { PageFacts } from "@/lib/website/extract";

const facts = (instagram: string[]): PageFacts => ({
  title: null, siteName: null, description: null, instagram, tiktok: [], regionalSites: [], lang: null,
  ogImage: null, icons: [], logoImages: [], jsonLdLogos: [],
});

const ok = (username: string, followers: number, name: string | null = null, website: string | null = null): Discovery => ({
  ok: true,
  profile: { username, name, biography: null, website, followers, mediaCount: 10, profilePictureUrl: null, recentMedia: [] },
});

function deps(profiles: Record<string, Discovery>): InstagramDeps {
  return {
    lookupBusiness: vi.fn(async (u: string) => profiles[u] ?? { ok: false, reason: "not_business", message: "Not a business or creator account, or it doesn't exist." }),
    fetchBadge: vi.fn(async () => true),
    checkBioLink: vi.fn(async (website: string | null) => ({ reached: website ? "tirtir.global" : null, via: website })),
  };
}

describe("researchInstagram", () => {
  it("chooses the handle the global site links, over the Korean site's", async () => {
    const d = deps({ tirtir_global: ok("tirtir_global", 810_543), tirtir_official: ok("tirtir_official", 387_000) });
    const r = await researchInstagram(
      {
        brand: "TIRTIR",
        brandDomains: ["tirtir.global", "tirtir.co.kr"],
        pages: [
          { url: "https://www.tirtir.co.kr", region: "kr", facts: facts(["tirtir_official"]) },
          { url: "https://tirtir.global", region: "global", facts: facts(["tirtir_global"]) },
        ],
      },
      d,
    );
    expect(r.chosen?.handle).toBe("tirtir_global");
    expect(r.scored.every((s) => s.verdict.score === "proven")).toBe(true);
    expect(d.lookupBusiness).toHaveBeenCalledTimes(2);
  });

  it("tries name variants only when no linked handle is a business account", async () => {
    const d = deps({ "numbuzin_global": ok("numbuzin_global", 232_000, "numbuzin", "https://linktr.ee/numbuzin") });
    const r = await researchInstagram({ brand: "numbuzin", brandDomains: ["numbuzin.com"], pages: [{ url: "https://numbuzin.com", region: "kr", facts: facts(["numbuzin"]) }] }, d);
    expect(d.lookupBusiness).toHaveBeenCalledWith("numbuzin");
    expect(d.lookupBusiness).toHaveBeenCalledWith("numbuzin_global");
    expect(r.chosen?.handle).toBe("numbuzin_global");
    expect(r.scored.find((s) => s.candidate.handle === "numbuzin")?.verdict.score).toBe("rejected");
  });

  it("never exceeds the lookup budget", async () => {
    const many = Array.from({ length: 12 }, (_, i) => `handle${i}`);
    const d = deps({});
    await researchInstagram({ brand: "Acme", brandDomains: [], pages: [{ url: "https://acme.com", region: "global", facts: facts(many) }] }, d);
    expect((d.lookupBusiness as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(8);
  });
});
```

Run: `pnpm test src/lib/instagram/research.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `src/lib/instagram/research.ts`**

```ts
import type { PageFacts } from "@/lib/website/extract";
import type { Discovery } from "@/lib/instagram/discovery";
import { nameVariants } from "@/lib/instagram/variants";
import { chooseInstagram, scoreInstagram, type IgCandidate, type IgVerdict } from "@/lib/instagram/score";

export type InstagramDeps = {
  lookupBusiness(username: string): Promise<Discovery>;
  fetchBadge(username: string): Promise<boolean | null>;
  checkBioLink(website: string | null, domains: string[]): Promise<{ reached: string | null; via: string | null }>;
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
      bio = await deps.checkBioLink(discovery.profile.website, input.brandDomains);
    }
    candidates.push({ handle, foundOn, discovery, verified, bio });
  };

  for (const [handle, foundOn] of linked) await look(handle, foundOn);
  if (!candidates.some((c) => c.discovery.ok)) {
    for (const handle of nameVariants(input.brand)) await look(handle, linked.get(handle) ?? []);
  }

  const maxFollowers = Math.max(0, ...candidates.map((c) => (c.discovery.ok ? c.discovery.profile.followers : 0)));
  const scored = candidates.map((candidate) => ({ candidate, verdict: scoreInstagram(candidate, maxFollowers) }));
  return { scored, chosen: chooseInstagram(scored) };
}
```

Run: `pnpm test src/lib/instagram/research.test.ts` — Expected: PASS, 3 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/instagram/research.ts src/lib/instagram/research.test.ts
git commit -m "feat(instagram): researchInstagram orchestration within Meta's budget

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Persisting, the job step, the brand page, the token banner

**Files:**
- Create: `src/lib/research/instagram-step.ts`, `src/components/app/meta-token-banner.tsx`
- Modify: `src/lib/inngest/functions/research-brand.ts`, `src/lib/brands/scoped.ts`, `src/app/(app)/brands/[id]/page.tsx`, `src/app/(app)/layout.tsx`, `src/components/app/app-shell.tsx`

**Interfaces:**
- Consumes: `researchInstagram` (Task 5); `lookupBusiness`, `fetchBadge`, `checkBioLink`; `siteRegion`, `CheckedSite` (2a); `metaTokenStatus` (Task 1).
- Produces:
  - `runInstagramStep(brandId: string): Promise<void>` — reads the brand's live `brand_pages` and its `website` candidates; builds `brandDomains` from website candidates scored `proven` or `review` (registrable domains); `pages` from live `brand_pages` with each page's region computed by `siteRegion`; runs `researchInstagram`; replaces `instagram` candidates (value = handle, source = "Linked from <host>" or "Name variant" , evidence = followers, name, website, verified, bio, profilePictureUrl, recentMedia), sets the `instagram` selection to the chosen one or deletes it.
  - `BrandDetail.instagram` with the same shape as `BrandDetail.website`.
  - `MetaTokenBanner({ status })` and `ShellNav.metaToken: { warn: boolean; daysLeft: number | null; configured: boolean }`.

- [ ] **Step 1: Implement `src/lib/research/instagram-step.ts`**

```ts
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lookupBusiness } from "@/lib/instagram/discovery";
import { fetchBadge } from "@/lib/instagram/badge";
import { checkBioLink } from "@/lib/instagram/bio-link";
import { researchInstagram } from "@/lib/instagram/research";
import { siteRegion, type CheckedSite } from "@/lib/website/research";
import { registrableDomain } from "@/lib/website/domain";
import type { PageFacts } from "@/lib/website/extract";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/** Runs inside the Inngest job, after the website step. Takes no scope (AGENTS.md rule 2). */
export async function runInstagramStep(brandId: string): Promise<void> {
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: brandId },
    include: { pages: { where: { source: "live" } }, candidates: { where: { field: "website" } } },
  });

  const brandDomains = [
    ...new Set(brand.candidates.filter((c) => c.score !== "rejected").map((c) => registrableDomain(new URL(c.value).hostname))),
  ];
  const pages = brand.pages.map((p) => {
    const facts = p.facts as PageFacts;
    // siteRegion reads the verdict's siteUrl and the facts; a minimal CheckedSite carries both.
    const site = { url: p.url, source: "hint", verdict: { score: "proven", kind: "ok", reason: "", siteUrl: p.url }, facts, archive: null } as CheckedSite;
    return { url: p.url, region: siteRegion(site), facts };
  });

  const { scored, chosen } = await researchInstagram({ brand: brand.name, pages, brandDomains }, { lookupBusiness, fetchBadge, checkBioLink });

  await prisma.$transaction(async (tx) => {
    await tx.selection.deleteMany({ where: { brandId, field: "instagram" } });
    await tx.candidate.deleteMany({ where: { brandId, field: "instagram" } });
    let chosenId: string | null = null;
    for (const { candidate: c, verdict } of scored) {
      const p = c.discovery.ok ? c.discovery.profile : null;
      const row = await tx.candidate.create({
        data: {
          brandId,
          field: "instagram",
          value: c.handle,
          source: c.foundOn.length > 0 ? `Linked from ${host(c.foundOn[0].url)}` : "Name variant",
          score: verdict.score,
          reason: verdict.reason,
          evidence: json({
            followers: p?.followers ?? null,
            name: p?.name ?? null,
            website: p?.website ?? null,
            verified: c.verified,
            bioReached: c.bio.reached,
            profilePictureUrl: p?.profilePictureUrl ?? null,
            recentMedia: p?.recentMedia ?? [],
            discovery: c.discovery.ok ? "ok" : c.discovery.reason,
          }),
        },
        select: { id: true },
      });
      if (c === chosen) chosenId = row.id;
    }
    if (chosenId) await tx.selection.create({ data: { brandId, field: "instagram", candidateId: chosenId, chosenBy: "auto" } });
  });
}
```

- [ ] **Step 2: Call it from the job**

In `src/lib/inngest/functions/research-brand.ts`, import `runInstagramStep` and extend the step body:
```ts
        if (id === "website") await runWebsiteStep(brandId);
        if (id === "instagram") await runInstagramStep(brandId);
```
and make the pause skip it: `if (id !== "website" && id !== "instagram") await step.sleep(...)`.

- [ ] **Step 3: Add Instagram to `getBrandDetail`**

In `src/lib/brands/scoped.ts`, widen the `include` to fetch both fields:
```ts
      candidates: { where: { field: { in: ["website", "instagram"] } }, orderBy: { createdAt: "asc" } },
      selections: { where: { field: { in: ["website", "instagram"] } } },
```
Add `instagram` to `BrandDetail` with the same type as `website`, and build both with a helper:
```ts
  const section = (field: "website" | "instagram") => ({
    selectedCandidateId: brand.selections.find((s) => s.field === field)?.candidateId ?? null,
    candidates: brand.candidates
      .filter((c) => c.field === field)
      .map((c) => ({ id: c.id, value: c.value, source: c.source, score: c.score, reason: c.reason, evidence: (c.evidence ?? {}) as Record<string, unknown> })),
  });
```
returning `website: section("website"), instagram: section("instagram")`.

- [ ] **Step 4: Show Instagram on the brand page**

In `src/app/(app)/brands/[id]/page.tsx`, add a section after Website, using the same `ListGroup`/`ListRow`/`Pill` pattern and `TONE`/`LABEL` maps:
```tsx
      <section className="flex flex-col gap-2">
        <h2 className="text-headline text-label">Instagram</h2>
        {brand.instagram.candidates.length === 0 ? (
          <p className="text-callout text-label-secondary">No Instagram account checked yet.</p>
        ) : (
          <ListGroup>
            {brand.instagram.candidates.map((c, i) => {
              const e = c.evidence as { followers?: number | null; name?: string | null; verified?: boolean | null; bioReached?: string | null };
              const facts = [
                e.name,
                typeof e.followers === "number" ? `${e.followers.toLocaleString("en-US")} followers` : null,
                e.verified === true ? "verified badge" : e.verified === false ? "no badge" : null,
                e.bioReached ? `bio reaches ${e.bioReached}` : null,
              ].filter(Boolean);
              return (
                <ListRow
                  key={c.id}
                  first={i === 0}
                  title={
                    <span className="flex items-center gap-2">
                      {c.id === brand.instagram.selectedCandidateId ? <Pill tone="blue">Chosen</Pill> : null}
                      <Link href={`https://www.instagram.com/${c.value}/`} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                        @{c.value}
                      </Link>
                    </span>
                  }
                  detail={`${c.reason} · ${c.source}${facts.length ? ` · ${facts.join(" · ")}` : ""}`}
                  trailing={<Pill tone={TONE[c.score]}>{LABEL[c.score]}</Pill>}
                />
              );
            })}
          </ListGroup>
        )}
      </section>
```
Remove the "Instagram" row from the "Found on the brand's sites" list (TikTok stays until 2c) and change its footnote to "TikTok, logo and cover are checked in the next build steps.".

- [ ] **Step 5: The token banner**

`src/components/app/meta-token-banner.tsx`:
```tsx
/** Spec §9: warn before Instagram checks stop working. Shown in the shell for everyone. */
export function MetaTokenBanner({ configured, daysLeft }: { configured: boolean; daysLeft: number | null }) {
  const text = !configured
    ? "Instagram checks are off: no Meta token is set. Run pnpm meta:token."
    : daysLeft !== null && daysLeft < 0
      ? "Instagram checks have stopped: the Meta token has expired. Run pnpm meta:token."
      : `The Meta token expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Run pnpm meta:token to renew it.`;
  return <div className="border-b border-separator bg-system-orange/15 px-4 py-2 text-footnote text-label">{text}</div>;
}
```

In `src/app/(app)/layout.tsx`'s `loadNav`, add `metaToken: metaTokenStatus()` (import from `@/lib/instagram/token`) to the returned object, and add `metaToken: { configured: boolean; daysLeft: number | null; warn: boolean }` to `ShellNav` in `app-shell.tsx`. In `AppShell`, render above the top bar, inside the page column:
```tsx
              <Suspense fallback={null}>
                <TokenBanner nav={nav} />
              </Suspense>
```
with, in `app-shell.tsx`:
```tsx
function TokenBanner({ nav }: { nav: Promise<ShellNav | null> }) {
  const data = use(nav);
  return data?.metaToken.warn ? <MetaTokenBanner configured={data.metaToken.configured} daysLeft={data.metaToken.daysLeft} /> : null;
}
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` — Expected: all pass.

```bash
git add -A
git commit -m "feat(research): Instagram step, brand page section and Meta token banner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Test set — Instagram

**Files:**
- Modify: `tests/test-set.ts`, `scripts/test-set.ts`

**Interfaces:**
- Consumes: `researchWebsite` (2a), `researchInstagram` (Task 5) with real deps.
- Produces: `pnpm test-set` prints an Instagram column and `Instagram: right N/16`; exits 1 if an Instagram trap is chosen.

- [ ] **Step 1: Add expectations to `tests/test-set.ts`** (from the 2026-10-16 audit; verified accounts and known impostors)

Add `instagram: string | null; igTraps?: string[]` to `TestBrand`, and per brand:

| Brand | `instagram` | `igTraps` |
|---|---|---|
| haruharu wonder | `haruharuwonder_official` | `haruharu_wonder` |
| AXIS-Y | `axisy_official` | |
| numbuzin | `numbuzin_global` | `numbuzin` |
| SOME BY MI | `somebymi` | |
| Pyunkang Yul | `pyunkangyul_global` | |
| Dr. Althea | `dr.altheaglobal` | `doctoralthea` |
| Biodance | `biodance_official` | `biodance_global` |
| Celimax | `celimax.global` | `celimax` |
| Purito Seoul | `purito_official` | |
| Benton | `bentoncosmetic` | |
| Round A'Round | `roundaround_official` | |
| Dear, Klairs | `klairs.global` | |
| Jumiso | `jumiso_global` | |
| Aestura | `aestura.official` | |
| TIRTIR | `tirtir_global` | `tirtir_official` |
| Dr.G | `dr.g_official` | |

(`tirtir_official` is TIRTIR's real Korean account, listed as a trap only in the sense that the global one must win.)

- [ ] **Step 2: Extend `scripts/test-set.ts`**

After `researchWebsite`, build the Instagram input from its candidates and run it:
```ts
  const brandDomains = [...new Set(r.candidates.filter((c) => c.verdict.score !== "rejected").map((c) => registrableDomain(new URL(c.verdict.siteUrl).hostname)))];
  const igPages = r.candidates
    .filter((c) => c.facts)
    .map((c) => ({ url: c.verdict.siteUrl, region: siteRegion(c), facts: c.facts! }));
  const ig = await researchInstagram({ brand: b.name, pages: igPages, brandDomains }, { lookupBusiness, fetchBadge, checkBioLink });
  const igGot = ig.chosen?.handle ?? null;
  if (igGot === b.instagram) igRight++;
  if (igGot && b.igTraps?.includes(igGot)) igTrapChosen = true;
```
Print `ig ${igGot ?? "-"}${igGot === b.instagram ? "" : ` (want ${b.instagram})`}` at the end of each line, a final `Instagram: right ${igRight}/${n}.`, and exit 1 when `igTrapChosen` is true. Import `researchInstagram`, `lookupBusiness`, `fetchBadge`, `checkBioLink`.

- [ ] **Step 3: Run it**

Run: `pnpm test-set` — Expected: no Instagram trap chosen. Record the Instagram accuracy line. A `rate_limited` or `token` reason in the output means Meta could not be reached — fix the token (`pnpm meta:token`) and rerun rather than counting those as wrong.

- [ ] **Step 4: Commit**

```bash
git add tests/test-set.ts scripts/test-set.ts
git commit -m "test: Instagram accuracy on the audited brands

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Next plans

- **2c TikTok** — link-preview check and the GitHub Actions browser runner.
- **2d Images and scoring** — `image-check`; logo candidates from `brand_pages` and the chosen Instagram profile picture; cover candidates; review counts; test-set accuracy for every field.
