"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  APP_NAV,
  APP_NAV_FOOTER,
  isAppNavActive,
  type AppNavLeaf,
} from "@/components/app/nav";
import { cn } from "@/design/cn";
import { Icon, type IconName } from "@/design/icon";

/**
 * The office sidebar's places.
 *
 * **WHAT CROSSES FROM THE SERVER IS STILL ONLY STRINGS.** The layout decides who may see what, on
 * the server, and sends the hrefs this person holds. This file imports `nav.ts` on its own side and
 * resolves them back to labels; the decision stays server-side, only its outcome travels.
 *
 * DRAWN IN THE NEW DESIGN LANGUAGE (2026-10-13, docs/DESIGN-LANGUAGE.md 8): every row at full strength
 * with a thin line icon, the place you are in a glass capsule (`pill`), a count as a small capsule in
 * the accent. Rows are the language's control height, 32px with a mouse and 44px under a finger.
 */

/** How many unread things sit behind a nav entry, keyed by href. */
export type NavBadges = Record<string, number>;

/**
 * THE ICON FOR EACH PLACE, from our own set (`src/design/icon.tsx`), keyed by href. Keyed by href
 * rather than by `leaf.icon` because the old names doubled up: two places were both a chat
 * bubble. `leaf.icon` stays in `nav.ts` for the screens that still read it.
 */
const ICONS: Record<string, IconName> = {
  "/office": "today",
  "/office/leads": "inbox",
  "/office/customers": "customers",
  "/office/appointments": "calendar",
  "/office/inspections": "inspection",
  "/office/estimates": "quote",
  "/office/jobs": "job",
  "/office/money": "money",
  "/office/marketing/social": "social",
  "/office/settings": "settings",
  "/office/support": "support",
};

function iconFor(leaf: AppNavLeaf): IconName {
  return ICONS[leaf.href] ?? "home";
}

function Count({ count, dot }: { count: number; dot?: boolean }) {
  if (count <= 0) return null;
  if (dot) {
    // The rail: with the label gone, a bare digit on an icon has nothing to say what it counts.
    return <span aria-label={`${count} unread`} className="absolute top-1 right-1 size-2 rounded-full bg-tint" />;
  }
  return (
    /*
      A NUMBER, NOT A DOT, and in the accent rather than a red. Red is an alarm and this is a reply
      to something the contractor asked for. `aria-label` because "2" beside "Support" is read out as
      a bare digit otherwise.
    */
    <span
      aria-label={`${count} unread`}
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-tint px-1.5 text-caption tabular-nums text-tint-contrast"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function Row({
  leaf,
  href,
  active,
  count,
  collapsed,
  onNavigate,
}: {
  leaf: AppNavLeaf;
  /**
   * WHERE THIS ROW ACTUALLY GOES, when that is not `leaf.href`. See `NavFooter`. The ACTIVE state is
   * still decided on `leaf.href`: the row owns a whole subtree and stays marked anywhere inside it.
   */
  href?: string;
  active: boolean;
  count: number;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href ?? leaf.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? leaf.label : undefined}
      className={cn(
        // Full strength, every row: the place you are in is marked by the capsule, never by greying
        // out the others.
        "relative flex h-(--ds-control-md) shrink-0 items-center gap-3 rounded-full text-body text-label",
        "transition-opacity duration-100 active:opacity-70",
        collapsed ? "justify-center" : "px-3",
        active && "pill",
      )}
    >
      <Icon name={iconFor(leaf)} weight="light" className="size-[18px]" />
      {collapsed ? (
        <>
          <span className="sr-only">{leaf.label}</span>
          <Count count={count} dot />
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{leaf.label}</span>
          <Count count={count} />
        </>
      )}
    </Link>
  );
}

/** The work: every place this person may open, in `nav.ts`'s order. The same rows on the rail. */
export function NavTree({
  allowedHrefs,
  badges,
  collapsed,
  onNavigate,
}: {
  allowedHrefs: string[];
  badges?: NavBadges;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const shown = APP_NAV.filter((leaf) => allowedHrefs.includes(leaf.href));

  return (
    <nav className="flex flex-col gap-1">
      {shown.map((leaf) => (
        <Row
          key={leaf.href}
          leaf={leaf}
          active={isAppNavActive(pathname, leaf.href)}
          count={badges?.[leaf.href] ?? 0}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

/** Settings and Support: the last rows of the list, not a strip pinned to the foot. */
export function NavFooter({
  allowedHrefs,
  hrefOverrides,
  badges,
  collapsed,
  onNavigate,
}: {
  allowedHrefs: string[];
  /**
   * WHERE A ROW GOES WHEN THE ANSWER DEPENDS ON WHO IS ASKING, keyed by the href in `nav.ts`.
   *
   * Settings is the one that needs it. `/office/settings` is a server redirect to the first section
   * this person may open, so pointing the row at it made every click a round trip that rendered
   * nothing. `loadNav` in `app/office/layout.tsx` picks the section from the scope it already holds,
   * so the row carries the real destination. `/office/settings` still redirects, for bookmarks.
   */
  hrefOverrides?: Record<string, string>;
  badges?: NavBadges;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const shown = APP_NAV_FOOTER.filter((leaf) => allowedHrefs.includes(leaf.href));

  return (
    <nav className="flex flex-col gap-1">
      {shown.map((leaf) => (
        <Row
          key={leaf.href}
          leaf={leaf}
          href={hrefOverrides?.[leaf.href]}
          active={isAppNavActive(pathname, leaf.href)}
          count={badges?.[leaf.href] ?? 0}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
