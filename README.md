# Brand Enrich

Researches brands for the db-admin Bulk Import CSV, with live human review.
Design: `docs/superpowers/specs/2026-10-16-brand-enrich-design.md`. Rules: `AGENTS.md`.

## Setup

1. **Supabase project:** copy the values listed in `.env.example` into `.env.local`.
2. **Supabase → Authentication → URL Configuration:** Site URL `http://localhost:3000`; add
   `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/confirm` to Redirect URLs.
3. **Supabase → Realtime → Settings:** turn off "Allow public access" so only private channels work.
4. `pnpm install`
5. `pnpm db:migrate:deploy` (schema, then lockdown), then `pnpm verify:lockdown`.
6. `pnpm bootstrap you@company.com` — the first owner's invitation.
7. `pnpm dev`, and `pnpm inngest:dev` in a second terminal.
8. Sign in at `http://localhost:3000/login` with the bootstrap email.

## Deploy

- **Vercel:** import the repo; add every variable from `.env.example`. `postinstall` runs
  `prisma generate`. Run `pnpm db:migrate:deploy` against production before deploying schema changes.
- **Inngest:** set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in Vercel; sync
  `https://<domain>/api/inngest`.
- **Supabase Auth:** add the production `/auth/callback` and `/auth/confirm` URLs.

## Commands

`pnpm test` · `pnpm typecheck` · `pnpm lint` · `pnpm build` · `pnpm db:migrate` ·
`pnpm db:migrate:deploy` · `pnpm verify:lockdown` · `pnpm bootstrap <email>` · `pnpm inngest:dev`
