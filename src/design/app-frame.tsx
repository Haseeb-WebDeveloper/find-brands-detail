"use client";

import { LayoutGroup, motion, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Glass } from "./glass";
import { Icon, type IconName } from "./icon";
import { Menu } from "./menu";
import { Segmented } from "./segmented";
import { motionPresets } from "./motion";
import { DesignRoot, ScrollRootProvider, useScrollRoot } from "./root";
import { useMedia } from "./use-media";
import { ToastProvider } from "./toast";

/**
 * THE APP FRAME: what every screen of the office and admin sits inside (docs/DESIGN-LANGUAGE.md 8).
 *
 *   window    the back of everything: a quiet grey with ONE wash of colour across its top (the
 *             `window-mesh`, tokens.css). The only colour in the frame, seen through the sidebar.
 *   desktop   a frosted GLASS SIDEBAR attached to the window's left edge, full height (the owner's
 *             reference, 2026-10-13): the company at the top, a line that fades at both ends, thin
 *             icons on plain rows, the place you are in a glass capsule, and at the foot another
 *             fading line and who is signed in. Collapses to a slim rail of icons, remembered on the
 *             device.
 *   page      fills the rest of the window, square, flush against the sidebar. It scrolls; the
 *             window never does. (A floating rounded page panel was tried and taken out.)
 *   phone     a floating glass TAB BAR at the bottom: the first four places and "More". It shrinks
 *             to icons while you scroll down, and comes back the moment you scroll up.
 *
 * A WORK TOOL, NOT A TOY (owner, 2026-10-13). The first version floated the sidebar 8px off the
 * window with rounded corners and gave every place a coloured iOS-style tile, and it read as a
 * children's app. Business software is quiet: attached chrome, one colour for icons, nothing that
 * performs when you move between screens.
 *
 * The window never scrolls; the frame does (`DesignRoot frame`), so a sheet reaches the window's
 * edge.
 */

export type Place = {
  href: string;
  label: string;
  icon: IconName;
};

/** The assistant's block at the top of the sidebar: its row, a "+" for a new conversation, and the
 *  last few conversations under it (as in the office today). */
export type AssistantPlace = {
  href: string;
  label: string;
  newHref: string;
  recent: { href: string; title: string }[];
};

type Theme = "light" | "dark" | "system";
const RECENT_STORAGE = "ds-recent-open";
const THEME_STORAGE = "ds-theme";

/** The sidebar's two widths. The page's left edge follows it on the same spring. */
const WIDE = 256;
const RAIL = 60;
const STORAGE = "ds-sidebar-collapsed";

/** The `move` spring as a CSS transition (motion.ts), for the width and the page edge. */
const MOVE = "650ms linear(0, 0.0792, 0.2371, 0.4044, 0.5525, 0.6726, 0.7652, 0.8341, 0.8842, 0.9199, 0.9451, 0.9626, 0.9747, 0.9829, 0.9886, 0.9924, 0.9949, 0.9966, 0.9978, 0.9985, 0.999, 1)";

function isHere(pathname: string, href: string, root: string) {
  return href === root ? pathname === root : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppFrame({
  workspace,
  user,
  assistant,
  places,
  footer,
  root,
  mode,
  children,
}: {
  /** Whose app this is: the company's name. */
  workspace: string;
  /** Who is signed in, shown at the foot of the sidebar. */
  user: { name: string; email: string };
  assistant?: AssistantPlace;
  places: Place[];
  footer: Place[];
  /** The home place's href, which is "here" only on itself, not on everything under it. */
  root: string;
  /** Forces a theme (a preview). Left out, the person chooses in the account menu. */
  mode?: "light" | "dark";
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setThemeState] = useState<Theme>("system");
  const systemDark = useMedia("(prefers-color-scheme: dark)");
  const resolved = mode ?? (theme === "system" ? (systemDark ? "dark" : "light") : theme);

  // Per-device conveniences, so storage is allowed to fail: private windows, blocked storage.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE) === "1");
      const saved = window.localStorage.getItem(THEME_STORAGE);
      if (saved === "light" || saved === "dark" || saved === "system") setThemeState(saved);
    } catch {}
  }, []);
  const setTheme = (next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE, next);
    } catch {}
  };
  const toggle = () => {
    setCollapsed((was) => {
      try {
        window.localStorage.setItem(STORAGE, was ? "0" : "1");
      } catch {}
      return !was;
    });
  };

  const width = collapsed ? RAIL : WIDE;
  const panel = useRef<HTMLDivElement>(null);

  return (
    <DesignRoot
      frame
      mode={resolved}
      className="overflow-hidden bg-window"
      style={{ "--frame-sidebar": `${width}px` } as CSSProperties}
    >
      <ScrollRootProvider value={panel}>
        <ToastProvider>
          <div aria-hidden className="window-mesh pointer-events-none fixed inset-0" />
          <Sidebar
            workspace={workspace}
            user={user}
            assistant={assistant}
            theme={theme}
            onTheme={setTheme}
            places={places}
            footer={footer}
            root={root}
            collapsed={collapsed}
            onToggle={toggle}
          />
          <main
            ref={panel}
            className="fixed inset-0 z-10 overflow-y-auto overscroll-contain bg-canvas pb-32 md:left-(--frame-sidebar) md:pb-12"
            style={{ transition: `left ${MOVE}` }}
          >
            {children}
          </main>
          <TabBar places={places} more={footer} root={root} />
        </ToastProvider>
      </ScrollRootProvider>
    </DesignRoot>
  );
}

/* ------------------------------------------------------------------------------------ sidebar */

function Sidebar({
  workspace,
  user,
  assistant,
  theme,
  onTheme,
  places,
  footer,
  root,
  collapsed,
  onToggle,
}: {
  workspace: string;
  user: { name: string; email: string };
  assistant?: AssistantPlace;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  places: Place[];
  footer: Place[];
  root: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  return (
    <aside
      style={{ width: "var(--frame-sidebar)", transition: `width ${MOVE}` }}
      // ONE SCROLL FOR THE WHOLE SIDEBAR (owner, 2026-10-13). Settings and Support are the last rows of
      // the list, not a strip pinned to the foot: on a short screen everything scrolls together.
      className="sidebar-glass fixed inset-y-0 left-0 z-20 hidden flex-col overflow-x-hidden overflow-y-auto overscroll-contain border-r border-separator px-2 py-3 md:flex"
    >
      <div className={cn("flex shrink-0 items-center gap-1", collapsed && "flex-col")}>
        <Workspace workspace={workspace} email={user.email} collapsed={collapsed} theme={theme} onTheme={onTheme} />
        <Button kind="plain" iconOnly icon="sidebar" size="sm" className="shrink-0 text-label" onClick={onToggle}>
          {collapsed ? "Show sidebar" : "Hide sidebar"}
        </Button>
      </div>
      <Divider />
      <nav className="flex flex-col gap-1">
        {assistant ? <Assistant assistant={assistant} pathname={pathname} collapsed={collapsed} /> : null}
        {places.map((place) => (
          <Row key={place.href} place={place} here={isHere(pathname, place.href, root)} collapsed={collapsed} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1 pt-6">
        {footer.map((place) => (
          <Row key={place.href} place={place} here={isHere(pathname, place.href, root)} collapsed={collapsed} />
        ))}
      </div>
    </aside>
  );
}

/** A hairline that fades out at both ends, so it divides without boxing anything in. */
function Divider() {
  return <div aria-hidden className="mx-2 my-3 h-px shrink-0 bg-linear-to-r from-transparent via-separator to-transparent" />;
}

/** The company's mark: its first letters on a small square, until there is a logo to show. */
function Mark({ text }: { text: string }) {
  const letters = text
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[6px] bg-label text-caption text-surface">
      {letters}
    </span>
  );
}

/**
 * THE WORKSPACE, AS IN THE OFFICE: the company's mark and name at the top, opening one menu for
 * everything about the account rather than the work. Who you are signed in as, the theme, Sign out.
 * Nothing about the account is pinned to the foot of the sidebar; the foot is navigation.
 */
function Workspace({
  workspace,
  email,
  collapsed,
  theme,
  onTheme,
}: {
  workspace: string;
  email: string;
  collapsed: boolean;
  theme: Theme;
  onTheme: (theme: Theme) => void;
}) {
  return (
    <Menu
      align="start"
      trigger={
        <Button
          kind="plain"
          size="lg"
          aria-label={`${workspace}: account and theme`}
          className={cn("min-w-0 gap-3 text-label", collapsed ? "w-(--ds-control-lg) px-0" : "flex-1 justify-start px-2")}
        >
          <Mark text={workspace} />
          {collapsed ? null : (
            <>
              <span className="min-w-0 flex-1 truncate text-left text-headline">{workspace}</span>
              <Icon name="chevronExpand" className="size-4 text-label-secondary" />
            </>
          )}
        </Button>
      }
      header={
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-1 pt-1">
            <Mark text={workspace} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-headline text-label">{workspace}</span>
              <span className="truncate text-footnote text-label-secondary">{email}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-body text-label">Theme</span>
            <Segmented
              label="Theme"
              value={theme}
              onValueChange={onTheme}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "Auto" },
              ]}
            />
          </div>
        </div>
      }
      groups={[[{ label: "Sign out", icon: "signOut", onSelect: () => {} }]]}
    />
  );
}

/**
 * The assistant: where a person lands, so it heads the list. Its row carries a "+" that starts a new
 * conversation and an arrow that folds the recent ones away; each recent conversation is a row with a
 * history icon (not a chat bubble, which is the Inbox), in the same column as every other row's icon.
 */
function Assistant({ assistant, pathname, collapsed }: { assistant: AssistantPlace; pathname: string; collapsed: boolean }) {
  const here = pathname === assistant.href;
  // The recent conversations fold away, as in the office. Remembered on the device.
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(RECENT_STORAGE) !== "0");
    } catch {}
  }, []);
  const toggleOpen = () => {
    setOpen((was) => {
      try {
        window.localStorage.setItem(RECENT_STORAGE, was ? "0" : "1");
      } catch {}
      return !was;
    });
  };
  return (
    <div className="mb-2 flex flex-col gap-1">
      <div className="relative flex items-center">
        <div className="min-w-0 flex-1">
          <Row place={{ href: assistant.href, label: assistant.label, icon: "assistant" }} here={here} collapsed={collapsed} />
        </div>
        {collapsed ? null : (
          <div className="absolute right-1 flex items-center">
            <Button
              kind="plain"
              iconOnly
              icon={open ? "chevronDown" : "chevronRight"}
              size="sm"
              className="text-label-secondary"
              onClick={toggleOpen}
            >
              {open ? "Hide recent conversations" : "Show recent conversations"}
            </Button>
            <Button kind="plain" iconOnly icon="add" size="sm" href={assistant.newHref} className="text-label">
              New conversation
            </Button>
          </div>
        )}
      </div>
      {collapsed || !open
        ? null
        : assistant.recent.map((thread) => (
            <Link
              key={thread.href}
              href={thread.href}
              aria-current={pathname === thread.href ? "page" : undefined}
              className={cn(
                "flex h-(--ds-control-md) shrink-0 items-center gap-3 rounded-full px-3 text-callout text-label",
                "transition-opacity duration-100 active:opacity-70",
                pathname === thread.href && "pill",
              )}
            >
              <Icon name="conversation" weight="light" className="size-[18px]" />
              <span className="truncate">{thread.title}</span>
            </Link>
          ))}
    </div>
  );
}


function Row({ place, here, collapsed }: { place: Place; here: boolean; collapsed: boolean }) {
  return (
    <Link
      href={place.href}
      aria-current={here ? "page" : undefined}
      title={collapsed ? place.label : undefined}
      className={cn(
        // Full strength, every row: the place you are in is marked by the capsule, not by greying
        // out the others (owner, 2026-10-13: the muted sidebar read as dull).
        "flex h-(--ds-control-md) shrink-0 items-center gap-3 rounded-full text-body text-label",
        "transition-opacity duration-100 active:opacity-70",
        collapsed ? "justify-center" : "px-3",
        here && "pill",
      )}
    >
      <Icon name={place.icon} weight="light" className="size-[18px]" />
      <span className={cn("truncate", collapsed && "sr-only")}>{place.label}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------------------- phone tab bar */

function TabBar({ places, more, root }: { places: Place[]; more: Place[]; root: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const scroller = useScrollRoot();
  const { scrollY } = useScroll({ container: scroller ?? undefined });
  const [compact, setCompact] = useState(false);

  // Shrink while reading down the page, come back on the first scroll up, the way iOS's tab bar
  // gets out of the way. A dead zone of a few pixels so a resting thumb does not flicker it.
  useMotionValueEvent(scrollY, "change", (y) => {
    const delta = y - (scrollY.getPrevious() ?? y);
    if (y < 80) setCompact(false);
    else if (delta > 4) setCompact(true);
    else if (delta < -4) setCompact(false);
  });

  const shown = places.slice(0, 4);
  const rest = [...places.slice(4), ...more];

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden"
    >
      <LayoutGroup>
        <motion.div layout transition={motionPresets.move} className="pointer-events-auto">
          <Glass weight="regular" className="flex items-center rounded-full p-1">
            {shown.map((place) => {
              const here = isHere(pathname, place.href, root);
              return (
                <motion.div key={place.href} layout transition={motionPresets.move}>
                  <Link
                    href={place.href}
                    aria-current={here ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-full transition-opacity duration-100 active:opacity-70",
                      compact ? "size-11" : "h-13 w-[4.5rem]",
                      here ? "pill text-tint-text" : "text-label",
                    )}
                  >
                    <Icon name={place.icon} weight={here ? "semibold" : "medium"} className="size-6" />
                    <span className={cn("text-caption", compact && "sr-only")}>{place.label}</span>
                  </Link>
                </motion.div>
              );
            })}
            <Menu
              side="top"
              align="end"
              trigger={
                <Button kind="plain" iconOnly icon="more" className="size-11 text-label">
                  More
                </Button>
              }
              groups={[rest.map((place) => ({ label: place.label, icon: place.icon, onSelect: () => router.push(place.href) }))]}
            />
          </Glass>
        </motion.div>
      </LayoutGroup>
    </div>
  );
}
