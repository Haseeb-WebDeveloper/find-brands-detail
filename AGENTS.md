# AGENTS.md — Brand Enrich

Read `docs/superpowers/specs/2026-10-16-brand-enrich-design.md` first. Conventions come from
`F:\projects\personal\contractor-sites`; when in doubt, copy how it does it there. Next.js 16:
read `node_modules/next/dist/docs/` before writing Next code.

1. One fact has one home. Reasoning goes in a docblock beside the code, not in long docs.
2. Prisma bypasses RLS. Every page calls `requireMember()`; every server action resolves
   `getTeamScope()` and checks `scopeCan` on its first line; every reader and store function takes
   a `TeamScope` first (except functions called only by Inngest jobs). `src/architecture.test.ts`
   enforces the first two.
3. The browser reads no table. The browser Supabase client is for auth and Realtime only.
4. Realtime payloads carry ids only; the page calls `router.refresh()` and re-reads on the server.
5. Every new table: repeat the lockdown block from the `lockdown` migration in the same migration,
   then run `pnpm verify:lockdown`. Never rely on `ALTER DEFAULT PRIVILEGES`.
6. Schema changes: `pnpm db:migrate --name <x>` for Prisma-generated SQL. Hand-written SQL that
   touches Supabase's `auth`/`realtime` schemas: `pnpm db:migrate --create-only --name <x>`, edit,
   then `pnpm db:migrate:deploy` — `migrate dev`'s shadow database has no Supabase schemas.
7. Feature folders: `lib/<feature>/{scoped,store,actions}.ts`; pure rules get `*.test.ts`.
8. Server actions return `{ ok: true } | { ok: false; error }` and never throw. Keep each action's
   signature on one line (the guard test reads the line after it).
9. UI: `src/design` components and tokens only; no literal colours; `next/link` only; add missing
   primitives with `pnpm dlx shadcn@latest add <name>` — then check the new file imports
   `cn` from `@/lib/utils` (the CLI has written `from "cn"` and installed a stray `cn` package).
10. Dashboard reads are uncached on purpose. Every route has a `loading.tsx` from
    `components/app/shell/page-skeletons.tsx`; inside a page that already drew its header, use
    `RowsLoading` as the Suspense fallback, not a whole-page skeleton.
11. No `@tailored/site-template` imports (contractor-sites' private package).
