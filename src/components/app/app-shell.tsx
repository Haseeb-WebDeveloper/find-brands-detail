"use client";

import { Suspense, use, useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { allNavLeaves, isAppNavActive } from "@/components/app/nav";
import { NavFooter, NavTree, type NavBadges } from "@/components/app/nav-tree";
import { DashboardTheme } from "@/components/app/theme";
import { WorkspaceMenu } from "@/components/app/workspace-menu";
import { MetaTokenBanner } from "@/components/app/meta-token-banner";
import { Button } from "@/design/button";
import { cn } from "@/design/cn";
import { Icon } from "@/design/icon";
import { DesignRoot, NavMenuProvider } from "@/design/root";
import { Sheet } from "@/design/sheet";
import { ToastProvider } from "@/design/toast";
import type { MemberRole } from "@/lib/auth/roles";

/**
 * The app's chrome, copied from contractor-sites' office shell (`components/app/app-shell.tsx`) and
 * trimmed to one team: no assistant, no company mark, no tenant brand colour. Same frame: a glass
 * sidebar over the window wash, a top bar, one scroll region.
 *
 * HOW THE NAV CROSSES THE SERVER/CLIENT LINE. The layout decides on the server which hrefs this person
 * may see and sends only those STRINGS; the shell, on the client, resolves them back to labels and
 * icons from `nav.ts`. The permission decision stays server-side; nothing un-serialisable travels.
 */

export type { NavBadges };

/** Everything about the sidebar that depends on who is asking. Strings only — see above. */
export type ShellNav = {
  allowedHrefs: string[];
  badges: NavBadges;
  email: string | null;
  role: MemberRole;
  /** Spec §9: the Meta token's state, for the expiry banner. */
  metaToken: { configured: boolean; daysLeft: number | null; warn: boolean };
};

function SidebarInner({
  data,
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  data: ShellNav;
  /** The icon rail. Only the desktop sidebar passes it. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col px-2 py-3">
      <div className={cn("flex shrink-0 items-center gap-1", collapsed && "flex-col")}>
        <WorkspaceMenu email={data.email} role={data.role} collapsed={collapsed} />
        {onToggleCollapsed ? (
          <Button kind="plain" iconOnly icon="sidebar" size="sm" className="shrink-0 text-label" onClick={onToggleCollapsed}>
            {collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
          </Button>
        ) : null}
      </div>

      {/* A hairline that fades out at both ends, so it divides without boxing anything in. */}
      <div aria-hidden className="mx-2 my-3 h-px shrink-0 bg-linear-to-r from-transparent via-separator to-transparent" />

      <NavTree allowedHrefs={data.allowedHrefs} badges={data.badges} collapsed={collapsed} onNavigate={onNavigate} />

      <div className="mt-auto pt-6">
        <NavFooter allowedHrefs={data.allowedHrefs} badges={data.badges} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

/** `use()` here, so the wait happens inside the shell's own Suspense, not in the layout. */
function SidebarSlot({
  nav,
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  nav: Promise<ShellNav | null>;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const data = use(nav);
  if (!data) return <SidebarSkeleton collapsed={collapsed} />;
  return <SidebarInner data={data} collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} onNavigate={onNavigate} />;
}

/** The rail before its rows exist: the same panel, so nothing flashes on a cold load. */
function SidebarSkeleton({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex h-full flex-col gap-1 px-2 py-3" aria-hidden>
      <div className={cn("mb-4 h-(--ds-control-lg) animate-pulse rounded-full bg-fill", collapsed && "mx-auto w-(--ds-control-lg)")} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn("h-(--ds-control-md) animate-pulse rounded-full bg-fill", collapsed && "mx-auto w-(--ds-control-md)")}
          style={{ opacity: 1 - i * 0.2 }}
        />
      ))}
    </div>
  );
}

/** The page's own name in the top bar. */
function TopBarLabel({ nav }: { nav: Promise<ShellNav | null> }) {
  const data = use(nav);
  const pathname = usePathname() ?? "";
  const here = allNavLeaves()
    .filter((leaf) => (data?.allowedHrefs ?? []).includes(leaf.href))
    .find((leaf) => isAppNavActive(pathname, leaf.href));
  if (!here) return null;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-app-md text-foreground">
      <Icon name={here.icon} className="size-4 shrink-0 opacity-60" />
      <span className="truncate font-medium">{here.label}</span>
    </span>
  );
}

function TopBar({ nav, children }: { nav: Promise<ShellNav | null>; children?: ReactNode }) {
  return (
    <header
      className={cn(
        "z-30 flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background px-3",
        // A page in the design language draws its own header row (`PageHeader`), so this bar steps aside.
        "[&:has(~main_[data-design-page])]:hidden",
      )}
    >
      {children}
      <Suspense fallback={null}>
        <TopBarLabel nav={nav} />
      </Suspense>
    </header>
  );
}

/** Above the page for everyone while the Meta token is missing, expired or in its last week. */
function TokenBanner({ nav }: { nav: Promise<ShellNav | null> }) {
  const data = use(nav);
  return data?.metaToken.warn ? <MetaTokenBanner configured={data.metaToken.configured} daysLeft={data.metaToken.daysLeft} /> : null;
}

/** Remembered across sessions. */
const RAIL_KEY = "brand-enrich-sidebar-collapsed";

/**
 * A PROMISE, NOT THE DATA: the layout hands `nav` over unawaited, so the frame draws before anybody
 * has asked the database who is signed in. `null` means nobody is; `ShellGate` in the layout is
 * already sending that person to /login.
 */
export function AppShell({ nav, children }: { nav: Promise<ShellNav | null>; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restored after mount, deferred to a microtask so the server's HTML and the first render agree.
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem(RAIL_KEY) === "1") {
      void Promise.resolve().then(() => setCollapsed(true));
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(RAIL_KEY, next ? "1" : "0");
      } catch {
        /* private mode — the rail still collapses for this session. */
      }
      return next;
    });
  }, []);

  return (
    /**
     * THE DOCUMENT DOES NOT SCROLL. The app is a fixed-height frame and the page column is the scroll
     * region. `min-h-0` on every flex child that contains one, or the inner overflow never engages.
     */
    <DashboardTheme>
      <DesignRoot data-surface="app" className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        {/* The window's one wash of colour, behind everything: it shows through the sidebar's glass. */}
        <div aria-hidden className="window-mesh pointer-events-none fixed inset-0" />
        <ToastProvider>
          <div className="relative z-10 flex min-h-0 flex-1">
            <aside
              className={cn(
                "sidebar-glass hidden shrink-0 overflow-x-hidden overflow-y-auto overscroll-contain border-r border-separator transition-[width] duration-300 ease-out md:block",
                collapsed ? "w-[60px]" : "w-64",
              )}
            >
              <Suspense fallback={<SidebarSkeleton collapsed={collapsed} />}>
                <SidebarSlot nav={nav} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
              </Suspense>
            </aside>

            <div className="legacy-surface flex min-h-0 min-w-0 flex-1 flex-col bg-background">
              <TopBar nav={nav}>
                <div className="md:hidden">
                  <Sheet
                    title="Navigation"
                    open={open}
                    onOpenChange={setOpen}
                    trigger={
                      <Button kind="plain" iconOnly icon="menu" size="sm">
                        Open navigation
                      </Button>
                    }
                  >
                    <Suspense fallback={<SidebarSkeleton />}>
                      <SidebarSlot nav={nav} onNavigate={() => setOpen(false)} />
                    </Suspense>
                  </Sheet>
                </div>
              </TopBar>

              <Suspense fallback={null}>
                <TokenBanner nav={nav} />
              </Suspense>

              <main className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 md:py-8">
                  <NavMenuProvider value={() => setOpen(true)}>{children}</NavMenuProvider>
                </div>
              </main>
            </div>
          </div>
        </ToastProvider>
      </DesignRoot>
    </DashboardTheme>
  );
}
