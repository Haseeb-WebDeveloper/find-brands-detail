# Brand Enrich — UI/UX redesign (approved 2026-10-21)

Owner's brief: text and sizes too small; one scrollbar, on the page itself; layout for the best review
UX; everything that does not need AI must work without AI keys; export must ask which batch or
brands to export.

## 1. Foundation

- **Desktop type scale** (`src/design/tokens.css`, `min-width: 768px`): large title 28px, title 1
  24px, title 2 20px, title 3 18px, headline 16px, body 16px, callout 15px, subhead 14px, footnote
  13px, caption 12px (was 22/20/17/15/14/14/13/12/11/11). The phone scale is unchanged.
- **Controls** (fine pointer): sm 32px, md 40px, lg 44px, row 48px (was 28/32/40/40). Coarse pointer
  stays 32/36/44/44 → raised to match: 36/44/48/52.
- **Page scroll only**: the shell is normal document flow (`min-h-dvh`), the top bar is
  `sticky top-0`, and `AppPage` no longer creates a scroll box. The window's scrollbar scrolls the
  page; no section scrolls on its own. `PageHeader` reads the window when no scroll root is given.
- **Column**: `max-w-7xl` (1280px).

## 2. Screens

- **Home**: batch cards, larger; each shows approved and exported counts.
- **Batch**: the table is the page (brand, five field dots, campaigns, status, a "Review" link);
  filters All / Needs you / Approved; "Export this batch" opens `/export?batch=<id>`. Progress
  cards only while brands research. The Activity log is a collapsible section, closed when research
  has finished.
- **Brand**: two columns on `lg`: main (website, Instagram, TikTok, logo, cover, brand details,
  campaigns, pages read, activity) and a sticky right panel: a checklist of requirements with ✓ / ! /
  ✗, each a link to its section, the warnings, and Approve / Re-open. On smaller screens the panel
  sits at the top. Logo and cover candidates show as 112px tiles in a grid with their verdict, not
  as 40px list icons. Campaign cards one per row (two on `2xl`), image 160px wide.
- **Export**: brands grouped by batch, a checkbox per batch (its approved brands) and per brand;
  brands not yet approved are listed greyed with "Not approved yet". `?batch=` preselects that
  batch. "Check and download" as before; problems listed under each brand.

## 3. Without AI keys

- AI is used for: finding a website when none is given, finding campaigns, writing campaign
  descriptions. Everything else (checking a given site, Instagram via the Meta token, TikTok, logo,
  cover, review, approval, export) needs no AI key.
- `aiAvailable()` (`src/lib/ai/models.ts`): true when a Groq or Gemini key is set.
- No key: the website step logs "No AI key is set up, so no website was searched. Add one to the
  brand with `, website` or type it on the brand page." The campaigns step logs "No AI key is set
  up, so campaigns weren't searched. Add them by hand." Both finish instantly.
- The New batch dialog, when AI is off, says to add `Name, website` lines.
- The brand page's campaign section, when it is empty, leads with "Add a campaign".

## 4. Testing

Unit tests for the checklist builder, export grouping and the no-AI paths; typecheck, lint, build;
a research run with the AI keys removed from the environment.
