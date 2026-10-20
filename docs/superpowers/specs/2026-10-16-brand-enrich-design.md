# Brand Enrich — Design

**Date:** 2026-10-16
**Status:** Approved 2026-10-16; revised 2026-10-20 (Supabase Auth magic link, Prisma, broadcast Realtime, contractor-sites conventions)

## 1. Purpose

Digital Beauty onboards about 25 brands a week. Collecting every field of the db-admin
Bulk Import CSV by hand takes too long, and a manual audit of 15 brands showed that the
hand-collected data is often wrong: 3 bad websites (hijacked, parked, offline), more than
half of the social handles wrong or belonging to impostors, images too small or on links
that expire within days, and campaign descriptions over the 500-character limit.

Brand Enrich takes a list of brand names, researches every field, checks each value
against evidence, shows the results live for a person to review, and exports a CSV in
the exact db-admin Bulk Import template that is guaranteed to pass the importer's
validation.

**Success criteria**

- On the test set (§10), website and Instagram are correct for every brand that has one,
  and no rejected trap (§10) is ever auto-accepted.
- Every field shown to the reviewer carries its evidence in plain words.
- Every exported CSV passes the db-admin importer's validation and image checks.
- A reviewer only touches cells marked for review.

## 2. Scope

**In scope (this spec):** website, Instagram, TikTok, logo, cover image, campaigns
(title, description, image), live review screen, CSV export.

**Out of scope (next spec):** AI drafts of description, industry, aesthetic, tier and
regions. Until then the reviewer types these on the brand review page; the export
requires them because the importer does.

**Not built:** individual user accounts, Google Sheets sync, pushing directly into
db-admin, image hosting (image URLs are kept as found).

## 3. Decisions

| Topic | Decision |
|---|---|
| Input | Paste brand names, one per line, optionally `Name, website` |
| Users | Supabase Auth, **magic link (email) only**, **invite-only**. Roles `owner` (can invite and remove) and `member`. The first owner is created by a one-off bootstrap command (revised 2026-10-20) |
| Campaign definition | Anything with a distinct visual campaign: ambassadors, collaborations, seasonal campaigns, hero product launches with campaign imagery, pop-ups. Skip sales, retail expansion and promotions without imagery |
| Campaign recency | No age limit; most recent first |
| Campaign images | Brand-owned sources first (brand site, press pages, brand Instagram); any other source as a fallback, labelled third-party |
| AI | Gemini with Google Search grounding for research; Groq or Gemini free tier for simple extraction. No Claude |
| Instagram data | Meta Graph API Business Discovery through the existing Meta app ("Roofing"), plus the free crawler-page check for the verified badge |
| TikTok data | Free link-preview check; Playwright on a GitHub Actions runner for badge and bio link |
| Hosting | Vercel (app), Supabase (database, Realtime), Inngest (jobs), GitHub Actions (browser runner) |
| Images | URLs kept as found; checked at research time and again at export |
| Live progress | Supabase Realtime **broadcast** on private channels; payloads carry ids only; the page re-renders from the server (revised 2026-10-20) |
| Database access | **Prisma 7** with `@prisma/adapter-pg` (setup copied from DB-mvp). The browser reads no tables (revised 2026-10-20) |
| UI and conventions | Copied from `F:\projects\personal\contractor-sites` (§13) |

## 4. Architecture

- **Next.js app on Vercel:** screens (login, team, new batch, batch view, brand review,
  export), server actions and API routes. Next 16 with `cacheComponents` and the React
  Compiler.
- **Supabase:** Auth (magic link), Postgres, Realtime broadcast.
- **Prisma 7:** every read and write happens in server code. Prisma connects as the
  table owner and bypasses RLS, so authorization is enforced in application code: every
  page, server action and reader resolves the signed-in member's scope first (§13).
- **Database lockdown:** the browser's Supabase key can read and write no table.
  Every table has RLS enabled with no policies for `anon`/`authenticated`, and privileges
  are revoked explicitly per table. A verification script proves it (§10).
- **Inngest:** one job per brand made of named steps; each step retries on its own.
- **GitHub Actions browser runner:** Playwright jobs (TikTok profiles, JavaScript-only
  sites), dispatched from Inngest, results posted back to an authenticated API route.
  The runner can move to a machine on a residential connection by changing `runs-on`.

Stack: TypeScript, Next.js 16 App Router, React 19, Tailwind 4, shadcn on Base UI,
Zod 4, Prisma 7, Inngest, Vitest, pnpm.

## 5. Components

Each module has one job and is tested on its own.

| Module | Job | Source |
|---|---|---|
| `site-probe` | Is a URL live, parked, hijacked (redirects off-domain) or bot-blocked | leadforge `src/lib/sitecheck/probe.ts`, `classify.ts` |
| `site-crawl` | Crawl a brand's sites: social links, logo, `og:image`, JSON-LD, about text, regional site links | leadforge `scraper/src/enrich.ts`, `extract.ts` |
| `archive` | Wayback Machine snapshots when a site is down or hijacked | new |
| `ig-lookup` | Business Discovery: name, followers, media count, bio website, profile picture, recent posts | new |
| `ig-badge` | Verified badge from Instagram's crawler-facing profile page | new |
| `tiktok-lookup` | Link-preview check (existence, name, followers); runner job for badge and bio link | new + leadforge `src/lib/runner/github.ts` |
| `link-page` | Follow Linktree-style bio links and test whether they reach the brand's domain | new |
| `image-check` | Download, confirm image, read dimensions, enforce minimums, read Instagram CDN `oe=` expiry | port of db-admin `src/server/images/check-image.ts` |
| `ai` | Gemini with search grounding and free-tier extraction; output validated with Zod | contractor-sites `src/lib/agent/stream.ts` |
| `campaigns` | Gemini finds campaigns and source pages; crawler pulls images from source pages; Instagram posts add candidates | new |
| `scoring` | Apply §7 rules to candidates; choose a selection per field | new |
| `export` | Build the CSV in the db-admin template and validate with the importer's rules | copy of db-admin `src/lib/schemas/brand-import.ts` |

**Rule for every module:** values are stored as candidates with evidence (source,
checks performed, result, timestamp). Nothing is shown or exported without a source.

## 6. Data model and flow

**Tables** (Prisma models; snake_case table and column names via `@@map`/`@map`)

- `users` — id (= `auth.users.id`), email, role (`owner` | `member`), created_at.
  Created on first sign-in for an invited email.
- `invitations` — id, email, role, invited_by, expires_at, accepted_at, revoked_at,
  created_at. A pending invitation is what lets a new email create an account; it is
  claimed (user row created, invitation accepted) on that email's first sign-in.
- `batches` — id, created_by, created_at, status.
- `brands` — id, batch_id, name, website_hint, status
  (`queued` → `researching` → `needs_review` → `approved` → `exported`), current_step,
  review_count.
- `candidates` — id, brand_id, field (`website`, `instagram`, `tiktok`, `logo`, `cover`),
  value, source, evidence (JSON), score (`proven` | `review` | `rejected`), reason,
  created_at.
- `selections` — brand_id, field, candidate_id or typed value, chosen_by
  (`auto` | `reviewer`).
- `campaigns` — id, brand_id, position (1–8), title, description, source_urls,
  status (`proposed` | `approved` | `removed`).
- `campaign_images` — id, campaign_id, url, source_kind (`brand` | `third_party`),
  width, height, score, reason, selected.
- `brand_text` — brand_id, description, tier, aesthetic, industry, regions
  (reviewer-entered until the next spec).

**Per-brand job (Inngest steps)**

1. `website` — search, `site-probe`, find regional sites (global, US, Korean).
2. `crawl` — `site-crawl` on chosen sites; `archive` as fallback.
3. `instagram` — handles from the site plus name variants → `ig-lookup`, `ig-badge`,
   `link-page`.
4. `tiktok` — handles from the site plus name variants → link-preview check → runner
   job where needed.
5. `images` — logo and cover candidates from all sources → `image-check`.
6. `campaigns` — Gemini research → source-page images and Instagram posts →
   `image-check`.
7. `score` — apply rules, set selections, set status `needs_review` and review_count.

Steps 3–6 run in parallel after step 2. Concurrency limits per external host (§9).

**Export:** the reviewer selects approved brands and downloads a CSV built from
selections, campaigns and brand_text. Before download, the export runs the importer's
validation and re-checks every image URL live; any failure blocks the export with a
report. Exported brands get status `exported`.

## 7. Scoring rules

**Website**
- Proven: loads; not parked or for sale; does not redirect to another domain; title or
  content names the brand.
- Review: loads but the brand name is not found, or several plausible domains.
- Rejected: dead, parked, hijacked — reason shown.
- Several proven official sites (added 2026-10-21): prefer the global site (English or generic
  domain), then US, then Korean, then any other country; all stay listed as candidates. Region is
  read from the page language first, then the domain.

**Instagram**
- Proven: Business Discovery succeeds, **and** (linked from the brand's site **or** the
  bio link, following link pages, reaches the brand's domain), **and** it is the global
  account when several exist (name contains "Global" or the global site links it).
- The verified badge is shown as evidence and is not required.
- Review: exists but not linked to the brand, or several close candidates.
- Rejected: not a business account; or follower count tiny relative to other candidates.

**TikTok**
- Proven: linked from the brand's site, or bio link reaches the brand's domain.
- Review: found by name only.
- Rejected: does not exist, or clear impostor (tiny account on the brand's name).

**Logo and cover**
- Proven: passes `image-check` (logo ≥ 256 px, cover ≥ 800 px) and comes from the
  brand's site or Instagram.
- Review: third-party source, or an Instagram CDN link expiring within 7 days.
- Rejected: below minimum, or not an image.

**Campaigns**
- Every campaign is reviewed.
- Images: scored brand-owned or third-party; rejected below 800 px or not an image.
- Descriptions over 500 characters are rejected and re-requested shorter before review.

## 8. Screens

1. **Login** — email field; sends a magic link. A new email can create an account only
   when it has a pending invitation; the response is the same either way, so addresses
   can't be probed. Callback routes exchange the link for a session.
2. **Team** (owners) — invite by email, revoke, remove member, change role. The
   invitee signs in at `/login` with the invited email; the pending invitation lets the
   account be created and is claimed on that first sign-in. Invitations expire after
   7 days. The owner shares the login link; the app sends no invite email.
3. **New batch** — paste box; Research button; live per-brand progress.
4. **Batch view** — one row per brand, coloured cell per field (green proven, amber
   review, red missing), "needs you" count, filters.
5. **Brand review** — per field: chosen value, preview (images shown with the importer's
   Fill Frame crop), evidence in plain words, other candidates with their evidence,
   typed override (checked immediately). Campaign cards with title, description and
   character count, image picks, source links; approve, edit, remove, reorder, "find
   more". Text fields for description, tier, aesthetic, industry, regions. **Approve
   brand** is enabled only when every required field has a value and nothing is red.
6. **Export** — select approved brands → validation and live image re-check →
   Download CSV, or a report of what blocked it.

**Live updates:** after each research step commits, the server broadcasts
`{ brandId, step }` (ids only, never data) on the private channels `batch:<batchId>`
and `brand:<brandId>`, using the service-role key server-side only. Signed-in browsers
subscribe with their own Supabase session (`realtime.setAuth()`); a policy on
`realtime.messages` admits only members of `public.users`. On a message the page calls
`router.refresh()` (debounced), so every value shown still comes from server code.

## 9. Errors and limits

- Each Inngest step retries. On final failure the field is marked "couldn't check" with
  the error in plain words and goes to review; a "Retry this step" button re-runs it.
- Bot checks or blocks are recorded as "blocked", followed by back-off; no value is
  guessed.
- Runner jobs have a timeout; a timed-out job marks the step failed and retryable.
- Meta: long-lived token stored as a server secret; an in-app banner warns before
  expiry; refresh follows contractor-sites `exchangeForLongLived`.
- Concurrency: Business Discovery well below Meta's hourly limit; Instagram crawler
  page, TikTok and each website domain one request at a time with pauses; Gemini calls
  back off on rate limits. AI cost is logged per brand.

## 10. Testing

- **Unit tests (Vitest):** scoring rules, link extraction, parked and hijack detection,
  link-page following, `image-check`, CSV export.
- **Test set:** the 15 brands audited on 2026-10-16 with their correct websites and
  handles, plus known traps: `pyunkangyul.us` (hijacked), `jumiso.com` (parked),
  `roundaround.co.kr` (offline), `@tirtir_official` on TikTok (impostor),
  `@haruharu_wonder` on Instagram (impostor), `@dr.g_official_global` (does not exist).
  One command runs the pipeline on the set and reports accuracy per field.
- **Export test:** generated CSV passes the copied importer validation.
- **Lockdown check:** `pnpm verify:lockdown` uses the publishable key against the real
  project and proves every table returns nothing and accepts no writes, and that a
  private channel refuses a non-member.
- **Guard tests:** source-reading tests (contractor-sites style) prove every server
  action and page under the app resolves the member scope first.

## 11. Build order

Each step is usable before the next begins.

1. **Scaffold** — repo, design system, Supabase Auth (magic link, invites, team page),
   Prisma schema and lockdown, Inngest, live batch progress.
2. **Facts** — website, crawl, Instagram, TikTok (with runner), logo and cover,
   scoring; measured on the test set.
3. **Campaigns** — Gemini research, source-page images, Instagram posts, scoring.
4. **Review and export** — batch view, brand review, CSV export.
5. **Next spec** — AI drafts for description, industry, aesthetic, tier, regions.

## 12. Credentials and risks

- **Meta app:** "Roofing" (development mode); lookups run as the Instagram business
  account `@hommy.online`. A dedicated Instagram business account for this tool is
  recommended to separate it from the roofing business.
- **Gemini and Groq keys:** existing keys.
- **Scraping:** reading public Instagram and TikTok pages is against their terms. Low
  volume and slow pacing keep the risk low; blocks degrade to review, never to guesses.
- **Expiring image links:** Instagram CDN links expire in about four days; export
  re-checks every link and import should follow export promptly.
- **Supabase keys:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (browser, auth and Realtime only), `SUPABASE_SERVICE_ROLE_KEY` (server only,
  broadcasts only), `DATABASE_URL` (Transaction pooler, port 6543, `pgbouncer=true`),
  `DIRECT_URL` (port 5432, migrations only).
- **Default privileges:** `ALTER DEFAULT PRIVILEGES` has silently not applied on the
  product database before, so lockdown is per-table revokes plus the verification
  script, never default privileges alone.

## 13. Conventions (from contractor-sites)

Copied from `F:\projects\personal\contractor-sites`, adapted to one team instead of many
companies:

- **Next.js 16:** `cacheComponents: true`, `reactCompiler: true`, named `cacheLife`
  profiles. Dashboard reads are deliberately uncached (live data); per-request dedupe
  with React `cache()`; every route has a `loading.tsx` drawn from shared skeletons;
  layouts pass promises to the shell, which unwraps them under Suspense.
- **Auth files:** `lib/auth/config.ts` (env names), `supabase-browser.ts` (auth and
  Realtime only), `supabase-server.ts` (auth only), `supabase-proxy.ts`
  (`refreshSession`), `session.ts` (`currentSession = cache(...)` using `getClaims()`),
  `actions.ts` (magic link, sign-out), `invite.ts` (pure token helpers, tested),
  callback routes `auth/callback` and `auth/confirm`. `src/proxy.ts` refreshes the
  session and redirects signed-out visitors; it is not the authorization boundary.
- **Scope:** branded `TeamScope` (`userId`, `email`, `role`) from
  `getTeamScope = cache(...)`; `requireMember()` redirects to `/login`;
  `scopeCan(scope, permission)` over a `resource:verb` permission union. Every page,
  action and reader takes or resolves the scope first.
- **Data layer per feature:** `lib/<feature>/scoped.ts` (server-only readers taking
  `scope` first), `store.ts` (server-only writes), `actions.ts` (thin `"use server"`,
  re-check permission on the first line, return `{ ok: true } | { ok: false; error }`,
  never throw, revalidate after writes). Pure rule files get `*.test.ts` siblings.
- **UI:** the `src/design` system (tokens, `DesignRoot`, Button, PageHeader,
  DesignPage, DataTable, Empty, TextField, Sheet, Dialog, Menu, Pill, ListGroup,
  `useToast`, `<Icon>` over lucide) and shadcn on Base UI with contractor-sites'
  `components.json`; tokens only, no literal colours; `next/link` only; forms are client
  components with `useState` + `useTransition` calling a server action.
- **Inngest:** events declared with Zod schemas carrying ids only; functions in
  `lib/inngest/functions/*.ts` registered in `functions/index.ts`.
- **Docs:** `AGENTS.md` holds the rules; reasoning lives in docblocks beside the code.
