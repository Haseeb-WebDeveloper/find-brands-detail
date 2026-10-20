# Brand Enrich

Researches brands for the db-admin Bulk Import CSV, with live human review.
Design: `docs/superpowers/specs/2026-10-16-brand-enrich-design.md`. Rules: `AGENTS.md`.

## Setup

1. **Supabase project:** copy the values listed in `.env.example` into `.env.local`.
2. **Supabase → Authentication → URL Configuration:** Site URL `http://localhost:3005`; add
   `http://localhost:3005/**` to Redirect URLs (the magic link returns to `/auth/callback`).
   Port 3005 because 3000/3001 are often taken by other local apps; `pnpm dev` pins it.
3. **Realtime (optional hardening):** if your dashboard shows Realtime → Settings → "Allow public
   access", turn it off. Not required: the app only uses private channels, and
   `pnpm verify:realtime` proves a signed-out browser is refused by policy.
4. `pnpm install`
5. `pnpm db:migrate:deploy` (schema, then lockdown), then `pnpm verify:lockdown`.
6. `pnpm bootstrap you@company.com` — the first owner's invitation.
7. Make sure `.env.local` has `INNGEST_DEV=1`, then `pnpm dev` and `pnpm inngest:dev` in a
   second terminal (Inngest's local dashboard: `http://localhost:8288`).
8. Sign in at `http://localhost:3005/login` with the bootstrap email.
9. **Instagram (Meta token, every 60 days):** in Graph API Explorer pick the app "Roofing", add the
   permissions instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement
   and business_management, Generate Access Token (tick the Page and its Instagram account), paste
   it into `.env.local` as `META_TEST_USER_TOKEN=`, then `pnpm meta:token`. The app shows a banner
   in the token's last week. Restart `pnpm dev` afterwards.

## Deploy

- **Vercel:** import the repo; add every variable from `.env.example`. `postinstall` runs
  `prisma generate`. Run `pnpm db:migrate:deploy` against production before deploying schema changes.
- **Inngest:** set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in Vercel; sync
  `https://<domain>/api/inngest`.
- **Supabase Auth:** add the production `/auth/callback` and `/auth/confirm` URLs.

## Commands

`pnpm test` · `pnpm typecheck` · `pnpm lint` · `pnpm build` · schema changes: AGENTS.md rule 6 ·
`pnpm db:migrate:deploy` · `pnpm verify:lockdown` · `pnpm verify:realtime` · `pnpm bootstrap <email>` · `pnpm inngest:dev` ·
`pnpm meta:token` · `pnpm test-set` (live accuracy run)
