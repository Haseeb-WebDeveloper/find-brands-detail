"use client";

import Link from "next/link";
import { Suspense, use, type ReactNode } from "react";
import { DashboardTheme } from "@/components/app/theme";
import { WorkspaceMenu } from "@/components/app/workspace-menu";
import { MetaTokenBanner } from "@/components/app/meta-token-banner";
import { Button } from "@/design/button";
import { DesignRoot } from "@/design/root";
import { ToastProvider } from "@/design/toast";
import type { MemberRole } from "@/lib/auth/roles";

/**
 * The app's chrome. A handful of pages, so no sidebar: one bar with the product's name (home) and
 * the account menu, over the window's wash of colour (contractor-sites' office `window-mesh`), which
 * runs behind the whole page. Pages are `AppPage`s: transparent, so the wash shows through.
 *
 * A PROMISE, NOT THE DATA: the layout hands `nav` over unawaited, so the frame draws before anybody
 * has asked the database who is signed in. `null` means nobody is; `ShellGate` in the layout is
 * already sending that person to /login.
 */
export type ShellNav = {
  email: string | null;
  role: MemberRole;
  canSeeTeam: boolean;
  /** Spec §9: the Meta token's state, for the expiry banner. */
  metaToken: { configured: boolean; daysLeft: number | null; warn: boolean };
};

/** The page column's width, shared by the bar and `AppPage` so their edges line up. */
export const COLUMN = "mx-auto w-full max-w-7xl px-4 sm:px-8";

function Account({ nav }: { nav: Promise<ShellNav | null> }) {
  const data = use(nav);
  if (!data) return <span className="size-(--ds-control-lg)" />;
  return (
    <div className="flex items-center gap-1">
      <Button kind="plain" size="sm" href="/usage" className="text-label">
        Usage
      </Button>
      {data.canSeeTeam ? (
        <Button kind="plain" size="sm" href="/team" className="text-label">
          Team
        </Button>
      ) : null}
      <WorkspaceMenu email={data.email} role={data.role} collapsed />
    </div>
  );
}

/** Above the page for everyone while the Meta token is missing, expired or in its last week. */
function TokenBanner({ nav }: { nav: Promise<ShellNav | null> }) {
  const data = use(nav);
  return data?.metaToken.warn ? <MetaTokenBanner configured={data.metaToken.configured} daysLeft={data.metaToken.daysLeft} /> : null;
}

export function AppShell({ nav, children }: { nav: Promise<ShellNav | null>; children: ReactNode }) {
  return (
    /**
     * THE PAGE SCROLLS, IN THE WINDOW (owner, 2026-10-21: "the scrollbar should show on the page
     * itself"). Nothing sticks: the bar and the page header scroll away with the page (owner, same day).
     */
    <DashboardTheme>
      <DesignRoot data-surface="app" className="flex min-h-dvh flex-col bg-(--ds-ground) text-foreground">
        <div aria-hidden className="window-mesh pointer-events-none fixed inset-0" />
        <ToastProvider>
          <div className="relative z-10 flex flex-1 flex-col">
            <Suspense fallback={null}>
              <TokenBanner nav={nav} />
            </Suspense>
            <header className={`${COLUMN} flex h-16 shrink-0 items-center gap-3`}>
              <Link href="/" aria-label="Digital Beauty — batches" className="flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- a fixed SVG, no resizing to do. */}
                <img src="/logo/digital-beauty-black.svg" alt="Digital Beauty" className="h-10 w-auto dark:hidden" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/digital-beauty-white.svg" alt="" className="hidden h-10 w-auto dark:block" />
              </Link>
              <div className="ml-auto">
                <Suspense fallback={<span className="size-(--ds-control-lg)" />}>
                  <Account nav={nav} />
                </Suspense>
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </ToastProvider>
      </DesignRoot>
    </DashboardTheme>
  );
}
