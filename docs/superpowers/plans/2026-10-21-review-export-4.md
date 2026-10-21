# Brand Enrich — Step 4: Review and Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reviewer sees each batch as a table of brands with a coloured cell per field, fixes each brand on its page (pick another candidate or type a value that is checked at once, edit/approve/remove/reorder/add campaigns, fill in the brand text), approves it when nothing blocks the DB import, and downloads approved brands as a CSV that the DB importer accepts.

**Architecture:** The DB importer's validation is copied in (`src/lib/export/importer/`), and one pure function, `buildImportRow`, maps a brand's review state to an importer row. Approval blockers are that row's importer errors plus "nothing red", so an approved brand always exports. Reviewer edits go through scoped server actions; a typed value becomes a candidate (source "Typed by a reviewer") after the same check research uses, so the candidate list stays the single record of evidence. Export re-checks every image live, then returns either the CSV or a report of what blocked it.

**Tech Stack:** Next 16 server actions, Prisma 7, Zod 4, the design system in `src/design`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-brand-enrich-design.md` — §8 screens 4 (batch view), 5 (brand review), 6 (export); §10 export test; §12 expiring image links.

### Decisions

- **Required to approve** = the importer's hard errors are empty (name, description, tier ∈ luxury/premium/masstige, ≥ 1 aesthetic, ≥ 1 industry, ≥ 1 region/country/industry, website source, logo and cover URLs, ≥ 3 complete campaigns with descriptions ≤ 500 and image URLs) **and** no chosen value is rejected ("nothing red"). Instagram and TikTok are optional, as in the importer (no Instagram = the importer's activation warning, shown as a warning).
- **Only approved campaigns export**, in their order, at most 8; proposed ones must be approved or removed by the reviewer. A campaign's exported image is its selected image.
- **Brand text** (description, tier, aesthetic, industry, regions) is typed by the reviewer (AI drafts are the next spec). Lists are typed comma- or pipe-separated and stored pipe-separated, the importer's delimiter.
- **Any edit to an approved brand** puts it back to `needs_review`. Export marks brands `exported`; they can be exported again.
- **"Find more" campaigns** is not in this step (it needs a campaigns-only research run); "Add campaign" covers the gap.
- **Export images**: every logo, cover and campaign image URL is re-checked with the importer's check at export time; a failure blocks that brand with the reason (e.g. an expired Instagram link).

## Global Constraints

- All earlier constraints apply (`AGENTS.md`). No schema change: `selections.typed_value`, `brand_text`, `campaigns.status`, `BrandStatus.approved/exported` exist.
- Every server action starts with `const scope = await getTeamScope(); if (!scope || !scopeCan(scope, "batches:write"))` (architecture test). Every page calls `requireMember()`. Readers and writers in `scoped.ts`/`store.ts` take the scope first and start with `import "server-only"`.
- Copied importer code changes only imports and drops unused exports; a header comment names the db-admin source path and date.
- UI copy in plain words for a non-technical reviewer; no tool names or status codes.

## File Structure

```
src/lib/export/importer/platforms.ts      IG_HANDLE_RE, TT_HANDLE_RE (copy)
src/lib/export/importer/brand-create.ts   extract*Handle, sourceSchema, campaignSchema, CAMPAIGN_DESCRIPTION_MAX, TIER_OPTIONS (copy)
src/lib/export/importer/activation.ts     activationReasons (copy)
src/lib/export/importer/brand-import.ts   IMPORT_HEADERS, validateImportRow, splitMulti… (copy)
src/lib/export/row.ts                     ReviewState, buildImportRow(state) → RawImportRow
src/lib/export/csv.ts                     toCsv(headers, rows)
src/lib/review/blockers.ts                approvalBlockers(state) → { errors: string[]; warnings: string[] }
src/lib/review/scoped.ts                  getReviewState(scope, brandId)
src/lib/review/store.ts                   writes: chooseCandidate, addTypedCandidate, saveBrandText, campaign edits, setApproved
src/lib/review/check-typed.ts             checkTyped(field, value, brand) → { score, reason, evidence, value }
src/lib/review/actions.ts                 server actions
src/lib/export/actions.ts                 exportBrands(ids) server action
src/lib/export/scoped.ts                  listExportable(scope)
src/components/app/review/*.tsx           field picker, typed input, campaign editor, brand text form, approve bar
src/app/(app)/batches/[id]/page.tsx       table view with filters
src/app/(app)/brands/[id]/page.tsx        review controls
src/app/(app)/export/page.tsx             export screen
```

---

### Task 1: The importer, copied, and the export row

**Files:** Create `src/lib/export/importer/{platforms,brand-create,activation,brand-import}.ts`, `src/lib/export/row.ts`, `src/lib/export/csv.ts`, `src/lib/export/row.test.ts`, `src/lib/export/csv.test.ts`.

**Interfaces:**
- From the copies: `IMPORT_HEADERS: string[]`, `validateImportRow(raw: RawImportRow): ImportRowValidation`, `RawImportRow`, `CellError`, `TIER_OPTIONS`, `CAMPAIGN_DESCRIPTION_MAX`, `MAX_CAMPAIGN_SLOTS`, `splitMulti`.
- `ReviewState = { name: string; website: string | null; instagram: string | null; tiktok: string | null; logo: string | null; cover: string | null; text: { description: string; tier: string; aesthetic: string; industry: string; regions: string }; campaigns: { title: string; description: string; imageUrl: string | null; status: "proposed" | "approved" | "removed" }[]; rejected: ("website" | "instagram" | "tiktok" | "logo" | "cover")[] }`
- `buildImportRow(state: ReviewState): RawImportRow`
- `toCsv(headers: string[], rows: RawImportRow[]): string`

- [ ] **Step 1: Copy.**
  - `platforms.ts`: only `IG_HANDLE_RE` and `TT_HANDLE_RE` from db-admin `src/constants/platforms.ts`.
  - `brand-create.ts`: db-admin `src/lib/schemas/brand-create.ts` lines 1–175 (handle extractors, `sourceSchema`, `campaignSchema`, `CAMPAIGN_DESCRIPTION_MAX`, `TIER_OPTIONS`); drop `profileSchema` and everything after `TIER_OPTIONS`; import the regexes from `./platforms`.
  - `activation.ts`: db-admin `src/lib/brands/activation.ts` lines 1–75 (`ActivationInput`, the rules, `activationReasons`); drop the `@/lib/backend/client` and `@/types/brands` imports and the functions after `activationReasons`.
  - `brand-import.ts`: db-admin `src/lib/schemas/brand-import.ts` whole, imports pointed at `./brand-create`, `./activation`, `@/lib/images/min-dimensions`; `BrandCreatePayload` declared locally (the interface from db-admin `src/types/backend.ts` with `ProfilePayload = { regions: string[]; countries: string[]; industries: string[]; sources: { platform: string; value: string }[] }` and `CampaignPayload = { title: string; description: string; image_url?: string }`).
  - Each file starts `// Copied from db-admin <path> (2026-10-21). Keep in step with the importer.` and has CRLF normalised to LF.

- [ ] **Step 2: Failing tests** — `row.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildImportRow, type ReviewState } from "@/lib/export/row";
import { validateImportRow, IMPORT_HEADERS } from "@/lib/export/importer/brand-import";

const camp = (n: number, status: "proposed" | "approved" | "removed" = "approved") => ({
  title: `Campaign ${n}`,
  description: `What campaign ${n} shows.`,
  imageUrl: `https://numbuzin.com/c${n}.jpg`,
  status,
});

export const READY: ReviewState = {
  name: "numbuzin",
  website: "https://us.numbuzin.com/",
  instagram: "numbuzin_global",
  tiktok: "numbuzin_global",
  logo: "https://numbuzin.com/logo.png",
  cover: "https://numbuzin.com/og.jpg",
  text: { description: "Korean skincare by number.", tier: "Masstige", aesthetic: "clean, clinical", industry: "skincare", regions: "Asia|North America" },
  campaigns: [camp(1), camp(2, "removed"), camp(3), camp(4), camp(5, "proposed")],
  rejected: [],
};

describe("buildImportRow", () => {
  it("fills the importer's columns from the review state", () => {
    const row = buildImportRow(READY);
    expect(row.name).toBe("numbuzin");
    expect(row.tier).toBe("masstige");
    expect(row.brand_aesthetic).toBe("clean|clinical");
    expect(row.profile_regions).toBe("Asia|North America");
    expect(row.source_website).toBe("https://us.numbuzin.com/");
    expect(row.source_instagram).toBe("numbuzin_global");
    expect(row.logo_url).toBe("https://numbuzin.com/logo.png");
  });

  it("exports only approved campaigns, in order, into consecutive slots", () => {
    const row = buildImportRow(READY);
    expect([row.campaign_1_title, row.campaign_2_title, row.campaign_3_title, row.campaign_4_title]).toEqual(["Campaign 1", "Campaign 3", "Campaign 4", undefined]);
    expect(row.campaign_2_image_url).toBe("https://numbuzin.com/c3.jpg");
  });

  it("produces a row the copied importer accepts (spec §10 export test)", () => {
    const v = validateImportRow(buildImportRow(READY));
    expect(v.ok).toBe(true);
    expect(Object.keys(buildImportRow(READY)).every((k) => IMPORT_HEADERS.includes(k))).toBe(true);
  });

  it("leaves gaps the importer reports", () => {
    const v = validateImportRow(buildImportRow({ ...READY, logo: null, text: { ...READY.text, tier: "" } }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.map((e) => e.column)).toEqual(expect.arrayContaining(["logo_url", "tier"]));
  });
});
```

`csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/export/csv";

describe("toCsv", () => {
  it("writes a header and quotes cells that need it", () => {
    const csv = toCsv(["name", "description"], [{ name: "Dear, Klairs", description: 'Says "hi"\nthen more' }, { name: "Jumiso" }]);
    expect(csv).toBe('name,description\r\n"Dear, Klairs","Says ""hi""\nthen more"\r\nJumiso,\r\n');
  });
});
```

- [ ] **Step 3: Implement `row.ts`**

```ts
import type { RawImportRow } from "@/lib/export/importer/brand-import";
import { MAX_CAMPAIGN_SLOTS, MULTI_VALUE_DELIMITER, campaignColumns } from "@/lib/export/importer/brand-import";

export type ReviewField = "website" | "instagram" | "tiktok" | "logo" | "cover";
export type ReviewState = {
  name: string;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  logo: string | null;
  cover: string | null;
  text: { description: string; tier: string; aesthetic: string; industry: string; regions: string };
  campaigns: { title: string; description: string; imageUrl: string | null; status: "proposed" | "approved" | "removed" }[];
  /** Fields whose chosen value was checked and failed: never exported (spec §8 "nothing is red"). */
  rejected: ReviewField[];
};

/** "clean, clinical" or "clean|clinical" → "clean|clinical", the importer's list form. */
export function toList(value: string): string {
  return value
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(MULTI_VALUE_DELIMITER);
}

/** One importer row for a brand: only approved campaigns, in their order, in consecutive slots. */
export function buildImportRow(state: ReviewState): RawImportRow {
  const row: RawImportRow = {
    name: state.name,
    description: state.text.description.trim(),
    tier: state.text.tier.trim().toLowerCase(),
    brand_aesthetic: toList(state.text.aesthetic),
    brand_industry: toList(state.text.industry),
    profile_regions: toList(state.text.regions),
    source_website: state.website ?? "",
    source_instagram: state.instagram ?? "",
    source_tiktok: state.tiktok ?? "",
    logo_url: state.logo ?? "",
    cover_image_url: state.cover ?? "",
  };
  const approved = state.campaigns.filter((c) => c.status === "approved").slice(0, MAX_CAMPAIGN_SLOTS);
  approved.forEach((c, i) => {
    const cols = campaignColumns(i + 1);
    row[cols.title] = c.title;
    row[cols.description] = c.description;
    row[cols.imageUrl] = c.imageUrl ?? "";
  });
  return row;
}
```

- [ ] **Step 4: Implement `csv.ts`**

```ts
import type { RawImportRow } from "@/lib/export/importer/brand-import";

const cell = (value: string | undefined) => {
  const v = value ?? "";
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

/** RFC 4180 CSV with CRLF rows, the shape the importer's CSV parser reads. */
export function toCsv(headers: string[], rows: RawImportRow[]): string {
  return [headers, ...rows.map((r) => headers.map((h) => r[h]))].map((cells) => cells.map(cell).join(",")).join("\r\n") + "\r\n";
}
```

(`headers` row passes through `cell` too; header names never need quoting.)

- [ ] **Step 5:** Run `pnpm vitest run src/lib/export` → PASS; typecheck, lint. **Commit** `feat(export): copy the DB importer's validation; build and write import rows`

---

### Task 2: Review state and approval blockers

**Files:** Create `src/lib/review/blockers.ts`, `blockers.test.ts`, `src/lib/review/scoped.ts`.

**Interfaces:**
- `approvalBlockers(state: ReviewState): { errors: string[]; warnings: string[] }` — plain-language lines.
- `getReviewState(scope: TeamScope, brandId: string): Promise<ReviewState | null>`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { approvalBlockers } from "@/lib/review/blockers";
import { READY } from "@/lib/export/row.test";

describe("approvalBlockers", () => {
  it("is empty for a brand the importer accepts", () => {
    expect(approvalBlockers(READY)).toEqual({ errors: [], warnings: [] });
  });
  it("says what blocks approval in plain words", () => {
    const r = approvalBlockers({ ...READY, logo: null, campaigns: READY.campaigns.slice(0, 1), rejected: ["cover"], text: { ...READY.text, tier: "cheap" } });
    expect(r.errors).toEqual(
      expect.arrayContaining([
        "Logo: Logo URL is required",
        "Tier: Tier must be one of: luxury, premium, masstige",
        "Campaigns: At least 3 complete campaigns are required (found 1)",
        "Cover: the chosen image failed its check. Choose another.",
      ]),
    );
  });
  it("warns, without blocking, when there is no Instagram account", () => {
    expect(approvalBlockers({ ...READY, instagram: null }).warnings).toEqual(["Instagram: No Instagram source — this brand cannot be activated until one is added"]);
  });
  it("asks for a decision on campaigns still proposed", () => {
    expect(approvalBlockers(READY).errors).toEqual([]);
  });
});
```

(Proposed campaigns are not exported and do not block once three are approved; the reviewer may leave extras proposed.)

- [ ] **Step 2: Implement `blockers.ts`**

```ts
import { validateImportRow } from "@/lib/export/importer/brand-import";
import { buildImportRow, type ReviewField, type ReviewState } from "@/lib/export/row";

/** Importer column → the name the reviewer sees on the brand page. */
const SECTION: [RegExp, string][] = [
  [/^name$/, "Name"],
  [/^description$/, "Description"],
  [/^tier$/, "Tier"],
  [/^brand_aesthetic$/, "Aesthetic"],
  [/^brand_industry$/, "Industry"],
  [/^profile_/, "Regions"],
  [/^source_website$/, "Website"],
  [/^source_instagram$/, "Instagram"],
  [/^source_tiktok$/, "TikTok"],
  [/^logo_url$/, "Logo"],
  [/^cover_image_url$/, "Cover"],
  [/^campaign_1_title$/, "Campaigns"],
  [/^campaign_(\d+)_/, "Campaign $1"],
];
const LABEL: Record<ReviewField, string> = { website: "Website", instagram: "Instagram", tiktok: "TikTok", logo: "Logo", cover: "Cover" };

function section(column: string): string {
  for (const [re, name] of SECTION) if (re.test(column)) return column.replace(re, name).replace(/_.*$/, "");
  return column;
}

/** Spec §8: approve only when the DB importer would take the brand and nothing chosen is red. */
export function approvalBlockers(state: ReviewState): { errors: string[]; warnings: string[] } {
  const v = validateImportRow(buildImportRow(state));
  const errors = v.ok ? [] : v.errors.map((e) => `${section(e.column)}: ${e.message}`);
  for (const f of state.rejected) errors.push(`${LABEL[f]}: the chosen ${f === "logo" || f === "cover" ? "image" : "value"} failed its check. Choose another.`);
  return { errors, warnings: v.warnings.map((w) => `${section(w.column)}: ${w.message}`) };
}
```

(`campaign_1_title` maps to "Campaigns" because the importer reports the shortfall there; `section` for `campaign_2_description` gives "Campaign 2".) Move `READY` into `src/lib/export/fixtures.ts` (exported) if importing from a test file trips Vitest; both tests import it from there.

- [ ] **Step 3: Implement `review/scoped.ts`**

```ts
import "server-only";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import type { ReviewField, ReviewState } from "@/lib/export/row";

const FIELDS: ReviewField[] = ["website", "instagram", "tiktok", "logo", "cover"];

/** The brand as the export sees it: chosen values (typed ones included), the reviewer's text, campaigns in order. */
export async function getReviewState(_scope: TeamScope, brandId: string): Promise<ReviewState | null> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      selections: { include: { candidate: true } },
      text: true,
      campaigns: { orderBy: { position: "asc" }, include: { images: { where: { selected: true } } } },
    },
  });
  if (!brand) return null;
  const chosen = (f: ReviewField) => brand.selections.find((s) => s.field === f);
  const value = (f: ReviewField) => chosen(f)?.typedValue ?? chosen(f)?.candidate?.value ?? null;
  return {
    name: brand.name,
    website: value("website"),
    instagram: value("instagram"),
    tiktok: value("tiktok"),
    logo: value("logo"),
    cover: value("cover"),
    text: {
      description: brand.text?.description ?? "",
      tier: brand.text?.tier ?? "",
      aesthetic: brand.text?.aesthetic ?? "",
      industry: brand.text?.industry ?? "",
      regions: brand.text?.regions ?? "",
    },
    campaigns: brand.campaigns.map((c) => ({ title: c.title, description: c.description, imageUrl: c.images[0]?.url ?? null, status: c.status })),
    rejected: FIELDS.filter((f) => chosen(f)?.candidate?.score === "rejected"),
  };
}
```

Check the Brand model's relation name for `BrandText` (`text` above); use the actual name from `prisma/schema.prisma`.

- [ ] **Step 4:** Run → PASS; typecheck. **Commit** `feat(review): approval blockers from the importer's own rules`

---

### Task 3: Choosing and typing field values

**Files:** Create `src/lib/review/check-typed.ts`, `check-typed.test.ts`, `src/lib/review/store.ts`, `src/lib/review/actions.ts`, `src/components/app/review/field-controls.tsx`; modify the brand page.

**Interfaces:**
- `TypedCheck = { value: string; score: "proven" | "review" | "rejected"; reason: string; evidence: Record<string, unknown> }`
- `checkTyped(field: ReviewField, raw: string, deps: TypedDeps, now?: Date): Promise<TypedCheck>` with `TypedDeps = { fetchPage, judgeSite: (page, brand) => SiteVerdict, brand: string, lookupBusiness, lookupProfile, checkImage(url, slot) }`
- Store: `chooseCandidate(scope, brandId, field, candidateId)`, `addTypedCandidate(scope, brandId, field, check)`; both set the selection `chosenBy: "reviewer"` and call `reopen(brandId)` (approved → needs_review).
- Actions: `chooseValue(brandId, field, candidateId)`, `typeValue(brandId, field, value)` → `{ ok: true; reason: string; score } | { ok: false; error }`.

- [ ] **Step 1: Failing test** (`check-typed.test.ts`, fakes for every dep):

```ts
import { describe, expect, it, vi } from "vitest";
import { checkTyped } from "@/lib/review/check-typed";

const deps = {
  brand: "numbuzin",
  fetchPage: vi.fn(async (url: string) => ({ requestedUrl: url, ok: true, status: 200, finalUrl: url, html: "<title>numbuzin</title>", error: null, elapsedMs: 1 })),
  judgeSite: vi.fn(() => ({ score: "proven" as const, kind: "ok", reason: "Loads and names the brand.", siteUrl: "https://numbuzin.com/" })),
  lookupBusiness: vi.fn(async () => ({ ok: true as const, profile: { username: "numbuzin_global", name: "numbuzin", biography: null, website: null, followers: 232000, mediaCount: 1, profilePictureUrl: null, recentMedia: [] } })),
  lookupProfile: vi.fn(async () => ({ ok: false as const, reason: "blocked" as const, message: "TikTok didn't show the profile, so it couldn't be checked." })),
  checkImage: vi.fn(async (url: string, slot: "logo" | "cover" | "campaign") => ({ url, slot, ok: true, status: 200, width: 1000, height: 1000, passesMin: true, minDimension: 256 })),
};

describe("checkTyped", () => {
  it("checks a website like research does", async () => {
    expect(await checkTyped("website", "numbuzin.com", deps)).toMatchObject({ value: "https://numbuzin.com/", score: "proven", reason: "Typed by a reviewer. Loads and names the brand." });
  });
  it("normalises and checks an Instagram handle or URL", async () => {
    const r = await checkTyped("instagram", "https://www.instagram.com/numbuzin_global/", deps);
    expect(r).toMatchObject({ value: "numbuzin_global", score: "proven" });
    expect(r.reason).toContain("232,000 followers");
  });
  it("keeps a TikTok handle TikTok won't show as needing a look", async () => {
    expect(await checkTyped("tiktok", "@numbuzin_global", deps)).toMatchObject({ value: "numbuzin_global", score: "review" });
  });
  it("checks an image URL at the importer's minimum", async () => {
    expect(await checkTyped("logo", "https://numbuzin.com/logo.png", deps)).toMatchObject({ score: "proven", reason: "Typed by a reviewer. 1000×1000." });
    deps.checkImage.mockResolvedValueOnce({ url: "x", slot: "cover", ok: true, status: 200, width: 400, height: 300, passesMin: false, minDimension: 800 });
    expect((await checkTyped("cover", "https://x.com/small.jpg", deps)).score).toBe("rejected");
  });
  it("rejects what isn't a URL or a handle", async () => {
    expect((await checkTyped("logo", "not a url", deps)).score).toBe("rejected");
  });
});
```

- [ ] **Step 2: Implement `check-typed.ts`**

```ts
import type { FetchedPage, SiteVerdict } from "@/lib/website/judge";
import type { Discovery } from "@/lib/instagram/discovery";
import type { TtLookup } from "@/lib/tiktok/profile";
import type { ImageCheckResult } from "@/lib/images/check-image";
import { extractInstagramHandle, extractTikTokHandle } from "@/lib/export/importer/brand-create";
import { IG_HANDLE_RE, TT_HANDLE_RE } from "@/lib/export/importer/platforms";
import { linkExpiry } from "@/lib/images/expiry";
import { scoreImage } from "@/lib/images/score";
import type { ReviewField } from "@/lib/export/row";

export type TypedCheck = { value: string; score: "proven" | "review" | "rejected"; reason: string; evidence: Record<string, unknown> };
export type TypedDeps = {
  brand: string;
  fetchPage(url: string): Promise<FetchedPage>;
  judgeSite(page: FetchedPage, brand: string): SiteVerdict;
  lookupBusiness(username: string): Promise<Discovery>;
  lookupProfile(username: string): Promise<TtLookup>;
  checkImage(url: string, slot: "logo" | "cover" | "campaign"): Promise<ImageCheckResult>;
};

const BY = "Typed by a reviewer.";
const bad = (value: string, reason: string): TypedCheck => ({ value, score: "rejected", reason: `${BY} ${reason}`, evidence: {} });

function asUrl(raw: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return /^https?:$/.test(u.protocol) && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

/** A reviewer's typed value, checked the way research checks it (spec §8: "checked immediately"). */
export async function checkTyped(field: ReviewField | "campaign", raw: string, deps: TypedDeps, now = new Date()): Promise<TypedCheck> {
  const input = raw.trim();
  if (field === "website") {
    const url = asUrl(input);
    if (!url) return bad(input, "That isn't a web address.");
    const page = await deps.fetchPage(url);
    const v = deps.judgeSite(page, deps.brand);
    return { value: `${new URL(v.siteUrl ?? url).origin}/`, score: v.score, reason: `${BY} ${v.reason}`, evidence: { kind: v.kind } };
  }
  if (field === "instagram") {
    const handle = extractInstagramHandle(input).toLowerCase();
    if (!IG_HANDLE_RE.test(handle)) return bad(input, "That isn't an Instagram handle.");
    const d = await deps.lookupBusiness(handle);
    if (!d.ok) return { value: handle, score: d.reason === "not_business" ? "rejected" : "review", reason: `${BY} ${d.message}`, evidence: {} };
    return {
      value: handle,
      score: "proven",
      reason: `${BY} Business account, ${d.profile.followers.toLocaleString("en-US")} followers.`,
      evidence: { followers: d.profile.followers, name: d.profile.name, website: d.profile.website, profilePictureUrl: d.profile.profilePictureUrl, recentMedia: d.profile.recentMedia },
    };
  }
  if (field === "tiktok") {
    const handle = extractTikTokHandle(input).toLowerCase();
    if (!TT_HANDLE_RE.test(handle)) return bad(input, "That isn't a TikTok handle.");
    const t = await deps.lookupProfile(handle);
    if (!t.ok) return { value: handle, score: t.reason === "not_found" ? "rejected" : "review", reason: `${BY} ${t.message}`, evidence: {} };
    return {
      value: handle,
      score: "proven",
      reason: `${BY} ${t.profile.followers.toLocaleString("en-US")} followers.`,
      evidence: { followers: t.profile.followers, name: t.profile.name, verified: t.profile.verified, avatarUrl: t.profile.avatar },
    };
  }
  const url = asUrl(input);
  if (!url || !/^https?:\/\//i.test(input)) return bad(input, "That isn't an image address.");
  const check = await deps.checkImage(url, field);
  const v = scoreImage({ slot: field, url, source: { kind: "site", label: "the reviewer" }, check, expiresAt: linkExpiry(url) }, now);
  const reason = v.score === "proven" ? `${BY} ${check.width}×${check.height}.` : `${BY} ${v.reason}`;
  return { value: url, score: v.score, reason, evidence: { width: check.width ?? null, height: check.height ?? null, kind: "typed" } };
}
```

(A logo typed by the reviewer still goes to review when wider than 2:1 or expiring: the reviewer sees why.)

- [ ] **Step 3: `review/store.ts`** — `import "server-only"`; every function `(scope: TeamScope, brandId, …)`:

```ts
/** Any edit re-opens an approved brand: approval is for the state the reviewer saw. */
async function reopen(tx: Prisma.TransactionClient, brandId: string) {
  await tx.brand.updateMany({ where: { id: brandId, status: { in: ["approved", "exported"] } }, data: { status: "needs_review" } });
}

export async function chooseCandidate(_scope: TeamScope, brandId: string, field: ReviewField, candidateId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const c = await tx.candidate.findFirst({ where: { id: candidateId, brandId, field }, select: { id: true } });
    if (!c) return false;
    await tx.selection.upsert({
      where: { brandId_field: { brandId, field } },
      create: { brandId, field, candidateId, chosenBy: "reviewer" },
      update: { candidateId, typedValue: null, chosenBy: "reviewer" },
    });
    await reopen(tx, brandId);
    return true;
  });
}

export async function addTypedCandidate(_scope: TeamScope, brandId: string, field: ReviewField, check: TypedCheck): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const c = await tx.candidate.create({
      data: { brandId, field, value: check.value, source: "Typed by a reviewer", score: check.score, reason: check.reason, evidence: check.evidence as Prisma.InputJsonValue },
      select: { id: true },
    });
    await tx.selection.upsert({
      where: { brandId_field: { brandId, field } },
      create: { brandId, field, candidateId: c.id, chosenBy: "reviewer" },
      update: { candidateId: c.id, typedValue: null, chosenBy: "reviewer" },
    });
    await reopen(tx, brandId);
  });
}
```

Plus `refreshReviewCount(brandId)` reusing `runScoreStep`'s summary logic: extract the count into `src/lib/research/review-summary.ts` `countFor(selections)` and call it after each field write so the batch table's "needs you" stays right. Research steps replace candidates by field; a re-run discards typed candidates — acceptable (research again is a deliberate reset).

- [ ] **Step 4: `review/actions.ts`** (`"use server"`): `chooseValue`, `typeValue` — permission first line, UUID and field validated (`["website","instagram","tiktok","logo","cover"]`), `typeValue` builds `TypedDeps` from the real modules (`fetchPage`, `judgeSite`, `lookupBusiness`, `lookupProfile`, `checkImageUrl`) with the brand's name, stores, `revalidatePath` brand and batch, returns `{ ok: true, score, reason }`.

- [ ] **Step 5: UI** — `field-controls.tsx` (client):
  - `UseThisButton({ brandId, field, candidateId })`: plain small button "Use this" on every non-chosen, non-rejected candidate row (`trailing` beside the pill).
  - `TypeValue({ brandId, field, placeholder })`: a `TextField` + "Check" button under each field's list; while pending "Checking…"; on result a toast with the reason ("Checked: proven. Typed by a reviewer. Loads and names the brand.") and `router.refresh()`.
  - Placeholders: website "Website address", Instagram "Instagram handle or link", TikTok "TikTok handle or link", logo/cover "Image address (right-click the image → Copy image address)".
  - The brand page adds both to the Website, Instagram, TikTok, Logo and Cover sections; rows already show "Chosen".

- [ ] **Step 6:** typecheck, lint, test (architecture test checks the action). **Commit** `feat(review): pick another candidate or type a value, checked at once`

---

### Task 4: Campaign editing

**Files:** Modify `src/lib/review/store.ts`, `actions.ts`; create `src/components/app/review/campaign-editor.tsx`; replace `CampaignCards` use on the brand page with the editor (keep `campaign-cards.tsx` for display pieces or fold it in).

**Interfaces (actions):** `saveCampaign(campaignId, { title, description })`, `setCampaignStatus(campaignId, "approved" | "removed" | "proposed")`, `moveCampaign(campaignId, -1 | 1)`, `selectCampaignImage(campaignId, imageId)`, `addCampaignImage(campaignId, url)` (checked with the campaign slot through `checkTyped("campaign", …)`; stored as `campaign_images` `sourceKind` "brand" when the URL's domain is the brand's or brand-named, else "third_party"; selected), `addCampaign(brandId, { title, description, imageUrl })` (position = last + 1, status approved, image checked as above). All return `{ ok, error? }`, validate title non-empty and description ≤ 500 (`CAMPAIGN_DESCRIPTION_MAX`), reopen the brand, revalidate.

Store helpers find the campaign with its `brandId` first (`tx.campaign.findUnique({ where: { id }, select: { brandId: true, position: true } })`) and return false when missing. `moveCampaign` swaps `position` with the neighbour in one transaction (positions unique per brand by convention, no constraint: swap via a temporary 0).

- [ ] **Step 1: Store + action tests** — the store is Prisma-bound (no DB in unit tests), so test the pure parts: a `validateCampaignInput({ title, description })` in `src/lib/review/campaign-input.ts` returning `string | null` (error text), with tests:

```ts
import { describe, expect, it } from "vitest";
import { validateCampaignInput } from "@/lib/review/campaign-input";

describe("validateCampaignInput", () => {
  it("needs a title and a description within 500 characters", () => {
    expect(validateCampaignInput({ title: " ", description: "x" })).toBe("Give the campaign a title.");
    expect(validateCampaignInput({ title: "A", description: "" })).toBe("Write a description.");
    expect(validateCampaignInput({ title: "A", description: "x".repeat(501) })).toBe("The description is 501 characters; the DB takes at most 500.");
    expect(validateCampaignInput({ title: "A", description: "Fine." })).toBeNull();
  });
});
```

```ts
import { CAMPAIGN_DESCRIPTION_MAX } from "@/lib/export/importer/brand-create";

export function validateCampaignInput({ title, description }: { title: string; description: string }): string | null {
  if (!title.trim()) return "Give the campaign a title.";
  if (!description.trim()) return "Write a description.";
  if (description.trim().length > CAMPAIGN_DESCRIPTION_MAX) return `The description is ${description.trim().length} characters; the DB takes at most ${CAMPAIGN_DESCRIPTION_MAX}.`;
  return null;
}
```

- [ ] **Step 2: Editor UI** (`campaign-editor.tsx`, client) — per campaign card (same layout as `CampaignCards`): status pill (Proposed / Approved / Removed); buttons "Approve", "Remove" (or "Restore"), "↑" "↓"; "Edit" toggles inline title `TextField` and description `<textarea>` with a live "n / 500" counter (orange over 450, red over 500, Save disabled over 500); image thumbnails clickable to select ("Use this image"); "Add image address" field. Removed campaigns render dimmed at the end. Below the grid: "Add a campaign" opens a `Dialog` with title, description (counter) and image address. Summary line above: "3 approved · 2 proposed — the DB needs 3 to 8 approved."
- [ ] **Step 3:** typecheck, lint, test. **Commit** `feat(review): edit, approve, remove, reorder and add campaigns`

---

### Task 5: Brand text and approval

**Files:** Modify `store.ts`, `actions.ts`; create `src/components/app/review/brand-text-form.tsx`, `approve-bar.tsx`; brand page.

**Interfaces:** actions `saveBrandText(brandId, { description, tier, aesthetic, industry, regions })` (tier must be one of `TIER_OPTIONS` or empty; lists normalised with `toList`; upsert `brand_text`; reopen), `approveBrand(brandId)` (re-reads `getReviewState`, refuses with the first blocker when `approvalBlockers(...).errors` is non-empty, else status `approved`), `reopenBrand(brandId)` (back to `needs_review`).

- [ ] **Step 1:** Brand text form (client): Description textarea (the DB's brand description), Tier as a `Segmented` (Luxury / Premium / Masstige), Aesthetic, Industry, Regions as `TextField`s with hint "Separate with commas"; Save button; toast "Saved."
- [ ] **Step 2:** Approve bar at the top of the brand page (server-rendered data, client buttons): when blockers exist, a list "Before approving:" with each error (and warnings in orange) and a disabled "Approve brand"; when none, "Approve brand" (filled). Approved: green "Approved" pill and "Re-open". The page header's status pill shows Approved / Exported.
- [ ] **Step 3:** typecheck, lint, test. **Commit** `feat(review): brand text and approval gated by the importer's rules`

---

### Task 6: Batch table (screen 4)

**Files:** Modify `src/lib/batches/scoped.ts` (`getBatch` returns per-brand field scores and campaign counts), `src/app/(app)/batches/[id]/page.tsx`; create `src/components/app/review/batch-table.tsx` (client: `DataTable` + `Segmented` filter).

- [ ] **Step 1:** `BrandRow` gains `fields: Record<ReviewField, "proven" | "review" | "rejected" | null>` (from each field's selection's candidate score) and `campaigns: { approved: number; total: number }`.
- [ ] **Step 2:** Table columns: Brand (link) · Website · Instagram · TikTok · Logo · Cover (a coloured dot per cell: green proven, amber review, red rejected or missing; title attribute in words) · Campaigns ("3/5 approved", amber under 3) · Status (pill: Researching… / Needs you (n) / Approved / Exported / Stopped). Filter `Segmented`: All · Needs you · Approved, with counts. While any brand researches, the progress cards stay above the table (existing `BrandCard`s only for queued/researching brands).
- [ ] **Step 3:** typecheck, lint, test. **Commit** `feat(review): batch table with a cell per field and filters`

---

### Task 7: Export (screen 6)

**Files:** Create `src/lib/export/scoped.ts`, `src/lib/export/actions.ts`, `src/app/(app)/export/page.tsx`, `src/components/app/review/export-panel.tsx`; add "Export" to the top bar next to Team.

**Interfaces:** `listExportable(scope)` → `{ id, name, batchId, status: "approved" | "exported" }[]`; action `exportBrands(ids: string[]) → { ok: true; csv: string; filename: string; count: number } | { ok: false; error: string; report: { name: string; problems: string[] }[] }`.

- [ ] **Step 1: Action** — permission first; for each id: `getReviewState` → `approvalBlockers` (errors become problems); then re-check every image URL in the row (`logo_url`, `cover_image_url`, `campaign_N_image_url`) with `checkImageUrl(url, slot)` one at a time; a failed check or `passesMin: false` is a problem ("Logo: the image no longer loads (Could not fetch image). Pick another."). Any problem → `{ ok: false, report }` and nothing is marked. All clear → `toCsv(IMPORT_HEADERS, rows)`, mark the brands `exported`, filename `brand-enrich-YYYY-MM-DD.csv`.
- [ ] **Step 2: Page** — `requireMember`; table of approved and exported brands with checkboxes (`DataTable` selection), batch link, status; "Check and download" (filled). While pending: "Checking N brands and their images…". On success the client builds a `Blob` (`text/csv;charset=utf-8`, with a UTF-8 BOM so Excel reads Korean names) and downloads it; toast "Downloaded N brands." On failure: a report card listing each brand's problems, with links to the brand pages.
- [ ] **Step 3:** typecheck, lint, test, `pnpm build`. **Commit** `feat(export): check approved brands and their images, download the import CSV`

---

### Task 8: Verify

- [ ] Unit tests, typecheck, lint, build pass.
- [ ] With the dev server: on numbuzin, type a tier, aesthetic, industry, regions and a description; approve two campaigns and add a third; approve the brand; export it; open the CSV and run it through db-admin's dry run (Tools → Bulk Import, upload, validate) when available. Record what happened in the final report.
