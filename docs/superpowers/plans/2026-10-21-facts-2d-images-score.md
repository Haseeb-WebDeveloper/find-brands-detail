# Brand Enrich — Step 2d: Logo, Cover and Scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The research job's `images` step gathers logo and cover candidates from the brand's own sites and its chosen Instagram and TikTok accounts, checks every one the way the DB importer will (download, real dimensions, minimums), scores it per spec §7 and chooses one per field; the `score` step then counts the fields that still need a person and writes `review_count`. Both show on the brand page and in the Activity log.

**Architecture:** Same shape as 2b/2c. `fetch-remote.ts` and `min-dimensions.ts` are copied verbatim from db-admin, and `check-image.ts` is a port, so "passes here" means "passes the importer". Pure functions decide — `linkExpiry`, `collectImages`, `scoreImage`, `chooseImage`, `reviewSummary` — and are unit-tested; `researchImages` takes `checkImage` injected; `images-step.ts` and `score-step.ts` persist.

**Tech Stack:** `image-size` 2 (as db-admin); node:http/https/dns (copied fetcher); Prisma 7; Vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-brand-enrich-design.md` — §5 (`image-check`), §6 steps 5 and 7, §7 Logo and cover, §9. Builds on 2b and 2c.

### Decisions (probed 2026-10-21 on Jumiso)

- **Logos are shown square.** The DB renders `logo_url` with `object-cover` in a square, rounded box (DB-mvp `search-result-item.tsx`), and the importer does not fit logos. A wide wordmark (jumiso.us JSON-LD logo, 372×112) would be cropped to its middle letters, so a logo wider or taller than 2:1 goes to **review** with that reason. Choice prefers the squarest passing logo, then the largest.
- **Sources found:** site JSON-LD `logo`, `<img>` logos, icons, `og:image` (jumiso.us: 1200×628); Instagram profile picture (1000×1000) and recent posts (2574×3218); TikTok `avatarLarger` (1080×1080, `x-expires` link). Instagram and TikTok CDN links expire within days, so per spec §7 they are **review** ("expires on …"); export re-checks (spec §12).
- **Covers** are filled to 16:11 by the importer, so choice prefers the image closest to 16:11, then the largest.

## Global Constraints

- All scaffold, 2a–2c constraints apply (`AGENTS.md`). No schema change: `FieldName` has `logo` and `cover`; `brands.review_count` exists.
- Minimums exactly as the importer: logo longest edge ≥ 256 px, cover ≥ 800 px (`MIN_IMAGE_DIMENSION`).
- Verdicts per spec §7: **proven** = passes the check and comes from the brand's site, Instagram or TikTok, and no rule below applies; **review** = a CDN link expiring within 7 days, or a logo wider/taller than 2:1; **rejected** = not reachable, not an image, or below the minimum. (Third-party sources do not occur in 2d; they arrive with campaigns.)
- Image checks run one at a time; at most 8 logo and 6 cover candidates per brand.
- The score step's required fields: website, Instagram, TikTok, logo, cover. A field needs review when it has no selection or its selected candidate isn't proven.
- Log lines in plain language; no tool names or status codes.

## File Structure

```
src/lib/images/fetch-remote.ts      copy of db-admin src/server/images/fetch-remote.ts
src/lib/images/min-dimensions.ts    copy of db-admin src/lib/images/min-dimensions.ts
src/lib/images/check-image.ts       port of db-admin check-image.ts (ImageCheckResult inline)
src/lib/images/expiry.ts            linkExpiry(url) — Instagram oe= / TikTok x-expires
src/lib/images/expiry.test.ts
src/lib/images/collect.ts           collectImages(input) → logo and cover candidate URLs with sources
src/lib/images/score.ts             scoreImage, chooseImage
src/lib/images/score.test.ts
src/lib/images/research.ts          researchImages(input, deps, log)
src/lib/images/research.test.ts
src/lib/research/review-summary.ts  reviewSummary(fields)
src/lib/research/review-summary.test.ts
src/lib/research/images-step.ts     runImagesStep(brandId, log)
src/lib/research/score-step.ts      runScoreStep(brandId, log)
Modify: src/lib/tiktok/profile.ts (+avatar), src/lib/research/tiktok-step.ts (evidence.avatarUrl),
        src/lib/inngest/functions/research-brand.ts, src/lib/brands/scoped.ts, brand page
```

---

### Task 1: Image check (port) and link expiry

**Files:** Create `src/lib/images/{fetch-remote,min-dimensions,check-image,expiry,expiry.test}.ts`; `image-size@^2.0.2` (already added).

**Interfaces:**
- Produces: `ImageSlot`, `MIN_IMAGE_DIMENSION`, `ImageCheckResult` (`{ url, slot, ok, status, width?, height?, bytes?, contentType?, format?, passesMin, minDimension, reason? }`), `checkImageUrl(url, slot): Promise<ImageCheckResult>`, `linkExpiry(url: string): Date | null`.

- [ ] **Step 1: Copy** `F:\projects\figmenta\db\db-admin\src\server\images\fetch-remote.ts` → `src/lib/images/fetch-remote.ts` and `…\db-admin\src\lib\images\min-dimensions.ts` → `src/lib/images/min-dimensions.ts`, unchanged except a first-line comment `// Copied from db-admin <path> (2026-10-21). Keep in step with the importer.`
- [ ] **Step 2: Port `check-image.ts`**: db-admin's file with imports `@/lib/images/fetch-remote`, `@/lib/images/min-dimensions`, and `ImageCheckResult` declared in the file (the interface above) instead of imported from `@/types/brand-import`.
- [ ] **Step 3: Failing test `expiry.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { linkExpiry } from "@/lib/images/expiry";

describe("linkExpiry", () => {
  it("reads Instagram's hex oe= and TikTok's x-expires=", () => {
    expect(linkExpiry("https://scontent.cdninstagram.com/v/x.jpg?_nc_ht=a&oe=6716A1B0")?.toISOString()).toBe(new Date(0x6716a1b0 * 1000).toISOString());
    expect(linkExpiry("https://p16-common-sign.tiktokcdn.com/a.jpeg?x-expires=1792500000&x-signature=z")?.toISOString()).toBe(new Date(1792500000 * 1000).toISOString());
  });
  it("is null for links that don't expire", () => {
    expect(linkExpiry("https://jumiso.us/cdn/shop/files/logo.png?v=1")).toBeNull();
    expect(linkExpiry("not a url")).toBeNull();
  });
});
```

- [ ] **Step 4: Implement `expiry.ts`**

```ts
/** When a signed CDN link stops working: Instagram's `oe` (hex seconds), TikTok's `x-expires` (seconds). */
export function linkExpiry(url: string): Date | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const oe = u.searchParams.get("oe");
  if (oe && /^[0-9a-f]+$/i.test(oe)) return new Date(parseInt(oe, 16) * 1000);
  const xe = u.searchParams.get("x-expires");
  if (xe && /^\d+$/.test(xe)) return new Date(Number(xe) * 1000);
  return null;
}
```

- [ ] **Step 5: Run** `pnpm vitest run src/lib/images` → PASS; `pnpm -s typecheck && pnpm -s lint`.
- [ ] **Step 6: Commit** `feat(images): importer's image check and CDN link expiry`

---

### Task 2: Scoring and choice

**Files:** Create `src/lib/images/score.ts`, `score.test.ts`

**Interfaces:**
- Consumes: `ImageCheckResult`, `ImageSlot` (Task 1).
- Produces: `ImageSource = { kind: "site" | "instagram" | "tiktok"; label: string }`; `ImageCandidate = { slot: "logo" | "cover"; url: string; source: ImageSource; check: ImageCheckResult; expiresAt: Date | null }`; `ImageVerdict = { score: "proven" | "review" | "rejected"; reason: string }`; `scoreImage(c, now: Date): ImageVerdict`; `chooseImage(scored): ImageCandidate | null`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { chooseImage, scoreImage, type ImageCandidate } from "@/lib/images/score";

const NOW = new Date("2026-10-21T12:00:00Z");
const cand = (over: Partial<ImageCandidate> & { w?: number; h?: number; ok?: boolean; reason?: string } = {}): ImageCandidate => {
  const { w = 1000, h = 1000, ok = true, reason, ...rest } = over;
  const slot = rest.slot ?? "logo";
  const min = slot === "logo" ? 256 : 800;
  return {
    slot,
    url: "https://jumiso.us/logo.png",
    source: { kind: "site", label: "jumiso.us" },
    expiresAt: null,
    check: { url: "x", slot, ok, status: ok ? 200 : 404, width: w, height: h, passesMin: ok && Math.max(w, h) >= min, minDimension: min, reason },
    ...rest,
  };
};

describe("scoreImage", () => {
  it("proves a big enough image from the brand's site", () => {
    expect(scoreImage(cand({ w: 600, h: 600 }), NOW)).toEqual({ score: "proven", reason: "600×600 from jumiso.us." });
  });
  it("rejects what the importer would reject", () => {
    expect(scoreImage(cand({ ok: false, reason: "Could not fetch image" }), NOW)).toEqual({ score: "rejected", reason: "Could not fetch image" });
    expect(scoreImage(cand({ w: 180, h: 180 }), NOW)).toEqual({ score: "rejected", reason: "180×180 — below the 256px minimum for a logo." });
    expect(scoreImage(cand({ slot: "cover", w: 600, h: 400 }), NOW).score).toBe("rejected");
  });
  it("sends a wide wordmark logo to review", () => {
    expect(scoreImage(cand({ w: 372, h: 112 }), NOW)).toEqual({ score: "review", reason: "372×112: too wide for the square logo frame, so it would be cropped." });
  });
  it("sends a link expiring within 7 days to review", () => {
    const v = scoreImage(cand({ source: { kind: "instagram", label: "@jumiso_global's profile picture" }, expiresAt: new Date("2026-10-24T00:00:00Z") }), NOW);
    expect(v).toEqual({ score: "review", reason: "1000×1000 from @jumiso_global's profile picture. The link expires on 24 Oct; export soon after review." });
  });
});

describe("chooseImage", () => {
  it("prefers proven, then the squarest logo, then the biggest", () => {
    const wide = cand({ url: "wide", w: 900, h: 300 });
    const square = cand({ url: "square", w: 400, h: 400 });
    const scored = [wide, square].map((c) => ({ candidate: c, verdict: scoreImage(c, NOW) }));
    expect(chooseImage(scored)?.url).toBe("square");
  });
  it("prefers the cover closest to 16:11", () => {
    const og = cand({ slot: "cover", url: "og", w: 1200, h: 628 });
    const portrait = cand({ slot: "cover", url: "post", w: 2574, h: 3218 });
    const scored = [portrait, og].map((c) => ({ candidate: c, verdict: scoreImage(c, NOW) }));
    expect(chooseImage(scored)?.url).toBe("og");
  });
  it("returns null when everything is rejected", () => {
    const tiny = cand({ w: 100, h: 100 });
    expect(chooseImage([{ candidate: tiny, verdict: scoreImage(tiny, NOW) }])).toBeNull();
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**

```ts
import type { ImageCheckResult } from "@/lib/images/check-image";

export type ImageSource = { kind: "site" | "instagram" | "tiktok"; label: string };
export type ImageCandidate = { slot: "logo" | "cover"; url: string; source: ImageSource; check: ImageCheckResult; expiresAt: Date | null };
export type ImageVerdict = { score: "proven" | "review" | "rejected"; reason: string };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** The DB shows logos square and cropped to fill; past this ratio a wordmark loses its ends. */
const MAX_LOGO_RATIO = 2;
/** The importer fills covers to this frame (db-admin FILL_FRAME_ASPECT.cover). */
const COVER_ASPECT = 16 / 11;

const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Spec §7, Logo and cover. */
export function scoreImage(c: ImageCandidate, now: Date): ImageVerdict {
  const { check } = c;
  if (!check.ok || !check.width || !check.height) return { score: "rejected", reason: check.reason ?? "Not an image." };
  const size = `${check.width}×${check.height}`;
  if (!check.passesMin) return { score: "rejected", reason: `${size} — below the ${check.minDimension}px minimum for a ${c.slot}.` };
  const ratio = Math.max(check.width, check.height) / Math.min(check.width, check.height);
  if (c.slot === "logo" && ratio > MAX_LOGO_RATIO) {
    return { score: "review", reason: `${size}: too ${check.width > check.height ? "wide" : "tall"} for the square logo frame, so it would be cropped.` };
  }
  const from = `${size} from ${c.source.label}.`;
  if (c.expiresAt && c.expiresAt.getTime() - now.getTime() < WEEK_MS) {
    return { score: "review", reason: `${from} The link expires on ${day(c.expiresAt)}; export soon after review.` };
  }
  return { score: "proven", reason: from };
}

/** How far an image is from the shape its slot is shown in (0 = exact). */
function misfit(c: ImageCandidate): number {
  const { width = 1, height = 1 } = c.check;
  return Math.abs(Math.log(width / height / (c.slot === "logo" ? 1 : COVER_ASPECT)));
}

/** Proven first, then review; within a level the best-fitting shape, then the most pixels. */
export function chooseImage(scored: { candidate: ImageCandidate; verdict: ImageVerdict }[]): ImageCandidate | null {
  const rank = (c: ImageCandidate) => [Math.round(misfit(c) * 10), -Math.min(c.check.width ?? 0, c.check.height ?? 0)];
  const better = (a: ImageCandidate, b: ImageCandidate) => {
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

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(images): score and choose logo and cover`

---

### Task 3: Collect candidates and orchestrate

**Files:** Create `src/lib/images/collect.ts`, `research.ts`, `research.test.ts`; modify `src/lib/tiktok/profile.ts` (+test), `src/lib/research/tiktok-step.ts`.

**Interfaces:**
- Consumes: Tasks 1–2; `PageFacts`.
- Produces:
  - `TtProfile.avatar: string | null` (from `user.avatarLarger`); TikTok evidence `avatarUrl`.
  - `ImagesInput = { pages: { url: string; facts: PageFacts }[]; instagram: { handle: string; picture: string | null; posts: string[] } | null; tiktok: { handle: string; avatar: string | null } | null }`
  - `collectImages(input): { slot: "logo" | "cover"; url: string; source: ImageSource }[]` — logos ≤ 8, covers ≤ 6, de-duplicated by URL.
  - `ImagesDeps = { checkImage(url: string, slot: "logo" | "cover"): Promise<ImageCheckResult> }`
  - `researchImages(input, deps, log?, now?): Promise<{ logo: Scored; cover: Scored }>` where `Scored = { scored: { candidate: ImageCandidate; verdict: ImageVerdict }[]; chosen: ImageCandidate | null }`.

- [ ] **Step 1: TikTok avatar.** In `profile.ts` add `avatar: string | null` to `TtProfile`, `avatarLarger?: string` to the `Detail` user type, and `avatar: user.avatarLarger || null` in `parseProfile`. Update `profile.test.ts`'s expected object with `avatar: null` and add `avatarLarger: "https://p16.tiktokcdn.com/a.jpeg"` → `avatar` to a second assertion. In the score/research test helpers add `avatar: null`. In `tiktok-step.ts` evidence add `avatarUrl: p?.avatar ?? null`.

- [ ] **Step 2: Failing test `research.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { collectImages, type ImagesInput } from "@/lib/images/collect";
import { researchImages } from "@/lib/images/research";
import type { ImageCheckResult } from "@/lib/images/check-image";
import type { PageFacts } from "@/lib/website/extract";

const facts = (over: Partial<PageFacts>): PageFacts => ({
  title: null, siteName: null, description: null, instagram: [], tiktok: [], regionalSites: [], lang: null,
  ogImage: null, icons: [], logoImages: [], jsonLdLogos: [], ...over,
});

const input: ImagesInput = {
  pages: [{ url: "https://jumiso.us/", facts: facts({ jsonLdLogos: ["https://jumiso.us/ld.png"], logoImages: ["https://jumiso.us/ld.png", "https://jumiso.us/img.png"], icons: ["https://jumiso.us/icon.png"], ogImage: "https://jumiso.us/og.png" }) }],
  instagram: { handle: "jumiso_global", picture: "https://scontent.cdninstagram.com/pic.jpg?oe=6716A1B0", posts: ["https://scontent.cdninstagram.com/post.jpg?oe=6716A1B0"] },
  tiktok: { handle: "jumiso_global", avatar: "https://p16.tiktokcdn.com/av.jpeg?x-expires=1792500000" },
};

describe("collectImages", () => {
  it("lists site logos first, then Instagram and TikTok pictures; covers from og:image then posts", () => {
    const all = collectImages(input);
    expect(all.filter((c) => c.slot === "logo").map((c) => c.url)).toEqual([
      "https://jumiso.us/ld.png",
      "https://jumiso.us/img.png",
      "https://scontent.cdninstagram.com/pic.jpg?oe=6716A1B0",
      "https://p16.tiktokcdn.com/av.jpeg?x-expires=1792500000",
      "https://jumiso.us/icon.png",
    ]);
    expect(all.filter((c) => c.slot === "cover").map((c) => c.source.kind)).toEqual(["site", "instagram"]);
    expect(all.find((c) => c.url.includes("pic.jpg"))?.source.label).toBe("@jumiso_global's Instagram profile picture");
  });
});

describe("researchImages", () => {
  it("checks every candidate and chooses per slot", async () => {
    const sizes: Record<string, [number, number]> = {
      "https://jumiso.us/ld.png": [372, 112],
      "https://jumiso.us/img.png": [199, 60],
      "https://jumiso.us/icon.png": [180, 180],
      "https://jumiso.us/og.png": [1200, 628],
    };
    const checkImage = vi.fn(async (url: string, slot: "logo" | "cover"): Promise<ImageCheckResult> => {
      const [w, h] = sizes[url] ?? [1000, 1000];
      const min = slot === "logo" ? 256 : 800;
      return { url, slot, ok: true, status: 200, width: w, height: h, passesMin: Math.max(w, h) >= min, minDimension: min };
    });
    const r = await researchImages(input, { checkImage }, undefined, new Date("2026-10-21T00:00:00Z"));
    expect(checkImage).toHaveBeenCalledTimes(7);
    expect(r.cover.chosen?.url).toBe("https://jumiso.us/og.png");
    // Every logo is review or rejected (wide wordmark, small, expiring CDN links): the squarest review wins.
    expect(r.logo.chosen?.source.kind).not.toBe("site");
  });
});
```

- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement `collect.ts`**

```ts
import type { PageFacts } from "@/lib/website/extract";
import type { ImageSource } from "@/lib/images/score";

export type ImagesInput = {
  pages: { url: string; facts: PageFacts }[];
  instagram: { handle: string; picture: string | null; posts: string[] } | null;
  tiktok: { handle: string; avatar: string | null } | null;
};
export type ImageLead = { slot: "logo" | "cover"; url: string; source: ImageSource };

const MAX_LOGOS = 8;
const MAX_COVERS = 6;
const MAX_POSTS = 3;
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/**
 * Where a brand's logo and cover can come from, best guesses first: the site's declared logo
 * (JSON-LD, then logo <img>s), the Instagram and TikTok profile pictures, then site icons (usually
 * too small). Covers: each site's og:image, then recent Instagram posts.
 */
export function collectImages(input: ImagesInput): ImageLead[] {
  const out: ImageLead[] = [];
  const seen = new Set<string>();
  const add = (slot: ImageLead["slot"], url: string | null, source: ImageSource, max: number) => {
    if (!url || seen.has(`${slot} ${url}`) || out.filter((o) => o.slot === slot).length >= max) return;
    seen.add(`${slot} ${url}`);
    out.push({ slot, url, source });
  };
  const site = (page: { url: string }) => ({ kind: "site", label: host(page.url) }) as const;

  for (const p of input.pages) for (const u of p.facts.jsonLdLogos) add("logo", u, site(p), MAX_LOGOS);
  for (const p of input.pages) for (const u of p.facts.logoImages) add("logo", u, site(p), MAX_LOGOS);
  if (input.instagram) add("logo", input.instagram.picture, { kind: "instagram", label: `@${input.instagram.handle}'s Instagram profile picture` }, MAX_LOGOS);
  if (input.tiktok) add("logo", input.tiktok.avatar, { kind: "tiktok", label: `@${input.tiktok.handle}'s TikTok profile picture` }, MAX_LOGOS);
  for (const p of input.pages) for (const u of p.facts.icons) add("logo", u, site(p), MAX_LOGOS);

  for (const p of input.pages) add("cover", p.facts.ogImage, site(p), MAX_COVERS);
  for (const u of input.instagram?.posts.slice(0, MAX_POSTS) ?? []) {
    add("cover", u, { kind: "instagram", label: `a recent @${input.instagram?.handle} post` }, MAX_COVERS);
  }
  return out;
}
```

- [ ] **Step 5: Implement `research.ts`**

```ts
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
  const result = { logo: { scored: [], chosen: null } as Scored, cover: { scored: [], chosen: null } as Scored };
  for (const slot of ["logo", "cover"] as const) {
    const mine = leads.filter((l) => l.slot === slot);
    await log(mine.length > 0 ? `Checking ${mine.length} ${slot} image${mine.length === 1 ? "" : "s"}…` : `No ${slot} image found on the brand's sites or profiles.`, mine.length > 0 ? "info" : "warn");
    // One at a time: politeness to each host (Global Constraints).
    for (const lead of mine) {
      const check = await deps.checkImage(lead.url, slot);
      const candidate: ImageCandidate = { ...lead, check, expiresAt: linkExpiry(lead.url) };
      const verdict = scoreImage(candidate, now);
      result[slot].scored.push({ candidate, verdict });
      if (verdict.score === "rejected") await log(`${WORD[slot]} from ${lead.source.label}: ${verdict.reason}`, "warn");
    }
    const chosen = chooseImage(result[slot].scored);
    result[slot].chosen = chosen;
    const verdict = result[slot].scored.find((s) => s.candidate === chosen)?.verdict;
    await log(
      chosen && verdict ? `${WORD[slot]}: ${verdict.reason}${verdict.score === "proven" ? "" : " Needs a look."}` : `No usable ${slot} image. Needs a look.`,
      verdict?.score === "proven" ? "good" : "warn",
    );
  }
  return result;
}
```

- [ ] **Step 6: Run** `pnpm vitest run src/lib/images src/lib/tiktok` → PASS; typecheck, lint.
- [ ] **Step 7: Commit** `feat(images): gather and check logo and cover candidates`

---

### Task 4: Score step summary

**Files:** Create `src/lib/research/review-summary.ts`, `review-summary.test.ts`

**Interfaces:** Produces `REQUIRED_FIELDS`, `reviewSummary(fields: Record<RequiredField, CandidateScore | null>): { count: number; message: string; level: "good" | "warn" }`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { reviewSummary } from "@/lib/research/review-summary";

describe("reviewSummary", () => {
  it("counts fields with no proven selection", () => {
    expect(reviewSummary({ website: "proven", instagram: "proven", tiktok: null, logo: "review", cover: "proven" })).toEqual({
      count: 2,
      message: "2 of 5 fields need a look: TikTok, logo.",
      level: "warn",
    });
  });
  it("says so when everything is proven", () => {
    expect(reviewSummary({ website: "proven", instagram: "proven", tiktok: "proven", logo: "proven", cover: "proven" })).toEqual({
      count: 0,
      message: "All 5 fields are proven.",
      level: "good",
    });
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { CandidateScore } from "@prisma/client";

export const REQUIRED_FIELDS = ["website", "instagram", "tiktok", "logo", "cover"] as const;
export type RequiredField = (typeof REQUIRED_FIELDS)[number];
const LABEL: Record<RequiredField, string> = { website: "website", instagram: "Instagram", tiktok: "TikTok", logo: "logo", cover: "cover" };

/** Spec §6 step 7: a field needs a person when nothing is chosen or the choice isn't proven. */
export function reviewSummary(fields: Record<RequiredField, CandidateScore | null>) {
  const open = REQUIRED_FIELDS.filter((f) => fields[f] !== "proven");
  const n = REQUIRED_FIELDS.length;
  return open.length === 0
    ? { count: 0, message: `All ${n} fields are proven.`, level: "good" as const }
    : { count: open.length, message: `${open.length} of ${n} field${open.length === 1 ? "" : "s"} need${open.length === 1 ? "s" : ""} a look: ${open.map((f) => LABEL[f]).join(", ")}.`, level: "warn" as const };
}
```

(The test's message for 2 fields reads "2 of 5 fields need a look" — the singular/plural forms above produce it.)

- [ ] **Step 3: Run** → PASS. **Step 4: Commit** `feat(score): count the fields that need review`

---

### Task 5: Job steps, reader and brand page

**Files:** Create `src/lib/research/images-step.ts`, `score-step.ts`; modify `research-brand.ts`, `scoped.ts`, brand page.

- [ ] **Step 1: `images-step.ts`** — loads `loadResearchPages(brandId)` pages, the Instagram selection's candidate (`value`, evidence `profilePictureUrl`, `recentMedia` items with `mediaType` IMAGE or CAROUSEL_ALBUM → `mediaUrl`) and the TikTok selection's candidate (`value`, evidence `avatarUrl`); calls `researchImages(input, { checkImage: checkImageUrl }, log)`; in one transaction replaces `logo` and `cover` candidates and selections. Candidate row: `value` = url, `source` = `source.label`, `score`/`reason` from the verdict, `evidence` = `{ kind, width, height, format, bytes, contentType, expiresAt }`. Selection `chosenBy: "auto"` for each chosen.

```ts
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkImageUrl } from "@/lib/images/check-image";
import { researchImages } from "@/lib/images/research";
import { loadResearchPages } from "@/lib/research/pages";
import type { ResearchLog } from "@/lib/research/log-types";

const json = (value: unknown) => value as Prisma.InputJsonValue;
type IgEvidence = { profilePictureUrl?: string | null; recentMedia?: { mediaType: string; mediaUrl: string | null }[] };
type TtEvidence = { avatarUrl?: string | null };

/** Runs inside the Inngest job after the social steps (AGENTS.md rule 2 exception). Re-running replaces logo and cover. */
export async function runImagesStep(brandId: string, log: ResearchLog): Promise<void> {
  const [{ pages }, selections] = await Promise.all([
    loadResearchPages(brandId),
    prisma.selection.findMany({ where: { brandId, field: { in: ["instagram", "tiktok"] } }, include: { candidate: true } }),
  ]);
  const ig = selections.find((s) => s.field === "instagram")?.candidate;
  const tt = selections.find((s) => s.field === "tiktok")?.candidate;
  const igE = (ig?.evidence ?? {}) as IgEvidence;
  const ttE = (tt?.evidence ?? {}) as TtEvidence;
  const input = {
    pages: pages.map((p) => ({ url: p.url, facts: p.facts })),
    instagram: ig
      ? {
          handle: ig.value,
          picture: igE.profilePictureUrl ?? null,
          posts: (igE.recentMedia ?? []).filter((m) => m.mediaType !== "VIDEO" && m.mediaUrl).map((m) => m.mediaUrl as string),
        }
      : null,
    tiktok: tt ? { handle: tt.value, avatar: ttE.avatarUrl ?? null } : null,
  };

  // The network work happens before the transaction, so no database connection waits on a download.
  const result = await researchImages(input, { checkImage: checkImageUrl }, log);

  await prisma.$transaction(async (tx) => {
    for (const field of ["logo", "cover"] as const) {
      await tx.selection.deleteMany({ where: { brandId, field } });
      await tx.candidate.deleteMany({ where: { brandId, field } });
      let chosenId: string | null = null;
      for (const { candidate: c, verdict } of result[field].scored) {
        const row = await tx.candidate.create({
          data: {
            brandId,
            field,
            value: c.url,
            source: c.source.label,
            score: verdict.score,
            reason: verdict.reason,
            evidence: json({
              kind: c.source.kind,
              width: c.check.width ?? null,
              height: c.check.height ?? null,
              format: c.check.format ?? null,
              bytes: c.check.bytes ?? null,
              contentType: c.check.contentType ?? null,
              expiresAt: c.expiresAt?.toISOString() ?? null,
            }),
          },
          select: { id: true },
        });
        if (c === result[field].chosen) chosenId = row.id;
      }
      if (chosenId) await tx.selection.create({ data: { brandId, field, candidateId: chosenId, chosenBy: "auto" } });
    }
  });
}
```

- [ ] **Step 2: `score-step.ts`**

```ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { REQUIRED_FIELDS, reviewSummary } from "@/lib/research/review-summary";
import type { ResearchLog } from "@/lib/research/log-types";

/** Spec §6 step 7: count what still needs a person. Status moves to needs_review in `finishResearch`. */
export async function runScoreStep(brandId: string, log: ResearchLog): Promise<void> {
  const selections = await prisma.selection.findMany({ where: { brandId, field: { in: [...REQUIRED_FIELDS] } }, include: { candidate: { select: { score: true } } } });
  const score = (f: (typeof REQUIRED_FIELDS)[number]) => selections.find((s) => s.field === f)?.candidate?.score ?? null;
  const summary = reviewSummary(Object.fromEntries(REQUIRED_FIELDS.map((f) => [f, score(f)])) as Parameters<typeof reviewSummary>[0]);
  await prisma.brand.update({ where: { id: brandId }, data: { reviewCount: summary.count } });
  await log(summary.message, summary.level);
}
```

- [ ] **Step 3: Wire** — `RUNNERS` gains `images: runImagesStep, score: runScoreStep`; `NOT_YET` loses `images` and `score`.
- [ ] **Step 4: Reader** — `FIELDS` adds `"logo", "cover"`; `BrandDetail` gains `logo: FieldSection; cover: FieldSection`.
- [ ] **Step 5: Brand page** — a "Logo and cover" section: for each field, the candidates as list rows with a thumbnail (`<img>` 48×48 `object-cover rounded-lg` for logo, 64×44 for cover; `loading="lazy"`, `referrerPolicy="no-referrer"`), title = source label, detail = reason, trailing = the score pill and "Chosen" pill on the selection. Remove the "Logo and cover are checked in the next build step." footnote.
- [ ] **Step 6: Verify** `pnpm -s typecheck && pnpm -s lint && pnpm -s test`.
- [ ] **Step 7: Commit** `feat(images): logo and cover in the research job; score step counts what needs review`

---

### Task 6: Live run

- [ ] **Step 1:** Re-run the Jumiso job through Inngest (send `brand/research.requested`) and read its log: expect the og:image (1200×628) as a proven cover, a logo in review (the wordmark is too wide; the profile pictures expire), and "N of 5 fields need a look".
- [ ] **Step 2:** If memory allows, `pnpm test-set` — website, Instagram and TikTok unchanged (images are not part of the test set).
