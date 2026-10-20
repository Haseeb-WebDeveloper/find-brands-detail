"use client";

import { Icon } from "@/design/icon";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Light and dark, for the two dashboards and NOWHERE ELSE.
 *
 * The tokens have been waiting in `globals.css` since the app surface was built: there is a
 * `.dark [data-surface="app"]` block with Notion's dark greys in it, complete down to `--app-hover`,
 * and nothing had ever switched it on. `next-themes` was already a dependency for the same reason.
 * So this is the switch, not a new palette.
 *
 * **SCOPED TO THE DASHBOARDS ON PURPOSE.** A contractor's public website is a designed thing with
 * photography on it, and the marketing tokens have never been drawn in dark or looked at in dark.
 * Shipping a toggle that also flipped `bobsroofing.com` would be shipping a second design nobody
 * reviewed. Hence the provider is mounted by the two shells rather than by the root layout.
 *
 * `attribute="class"` rather than an attribute, and that is forced rather than preferred:
 * `data-theme` is ALREADY the brand preset (`[data-theme="slate"]` and friends, set by
 * `SiteLayout`), and `@custom-variant dark (&:is(.dark *))` at the top of `globals.css` means every
 * `dark:` utility in `components/ui` is looking for the class and nothing else.
 */

/**
 * Its own key rather than the `theme` default.
 *
 * The public site may one day want a preference of its own, and two features sharing one localStorage
 * key is how choosing dark in a tool silently redecorates somebody's shopfront.
 */
const STORAGE_KEY = "dashboard-theme";

/** What somebody can pick. `system` is the default and follows whatever the computer is set to. */
const MODES = [
  { value: "light", label: "Light", icon: "light" },
  { value: "dark", label: "Dark", icon: "dark" },
  { value: "system", label: "System", icon: "system" },
] as const;

/**
 * Wraps a dashboard shell. Mounted by `AppShell` and `AdminShell`, and by nothing else.
 *
 * **THE CLEANUP IS THE LOAD-BEARING PART, and without it this component is a bug.** `next-themes`
 * writes `class="dark"` onto `<html>`, which is shared with every other route in the app. Unmounting
 * the provider does not take the class off, so a client-side navigation out of `/office` and onto
 * the marketing site - a link in a banner, the browser back button - would leave the whole public
 * page rendering against the generic `.dark` palette. On a fresh page load there is no provider and
 * no class, which is exactly why the bug would only ever appear for somebody clicking around.
 *
 * Same shape and same reason as `AppSurfaceTokens` next door, which cleans up `data-surface` so a
 * contractor's website gets its paper and its serif back.
 */
export function DashboardTheme({ children }: { children: ReactNode }) {
  useEffect(() => {
    return () => {
      const root = document.documentElement;
      root.classList.remove("dark");
      // `next-themes` also sets this, and a stale `color-scheme: dark` turns form controls, the
      // scrollbar and the space beyond the page dark on a page that is otherwise light.
      root.style.colorScheme = "";
    };
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Kills the transition on every element for the instant the class changes. Without it each
      // colour animates independently and the switch reads as a smear rather than a change.
      disableTransitionOnChange
      storageKey={STORAGE_KEY}
    >
      {children}
    </ThemeProvider>
  );
}

/**
 * The control, at the foot of the sidebar above Sign out.
 *
 * THREE STATES SHOWN AT ONCE, not a button that cycles. A cycle is smaller and it makes the current
 * state unreadable: the icon has to show either where you are or where you are going, and whichever
 * it shows, half the people reading it assume the other. Three targets also means System is
 * reachable in one click after somebody has tried dark and wants out of it, which is the whole
 * reason System exists.
 *
 * `collapsed` is the cockpit's icon rail, where sixty-four pixels will not hold three of anything.
 * There it does cycle, with the title attribute carrying what a label cannot.
 */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();

  /**
   * **RENDERED BLANK UNTIL MOUNTED, AND THIS IS NOT SUPERSTITION.** The chosen theme lives in
   * `localStorage`, which the server cannot read, so the server renders "no mode selected" and the
   * client would render "dark selected". React calls that a hydration mismatch and, in development,
   * throws the whole subtree away and re-renders it.
   *
   * So the first client render deliberately matches the server's, and the selection appears a tick
   * later. What is on screen in between is the control with nothing highlighted - not a wrong
   * highlight that moves, which is the version people notice.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Deferred to a microtask rather than set straight away, which is the same move `AdminShell`
    // makes when it restores the collapsed sidebar. A synchronous `setState` inside an effect makes
    // React render twice before it paints, and the repo lints against it.
    void Promise.resolve().then(() => setMounted(true));
  }, []);

  const current = mounted ? (theme ?? "system") : null;

  const cycle = useCallback(() => {
    const at = MODES.findIndex((m) => m.value === (theme ?? "system"));
    setTheme(MODES[(at + 1) % MODES.length].value);
  }, [theme, setTheme]);

  if (collapsed) {
    const active = MODES.find((m) => m.value === current) ?? MODES[2];
    return (
      <button
        type="button"
        onClick={cycle}
        // Not `aria-label`: the label has to say what it does AND what it is on, because the icon
        // alone cannot, and a rail this narrow has nowhere to write it.
        aria-label={`Theme: ${active.label}. Change it.`}
        title={`Theme: ${active.label}`}
        className="flex h-7 w-full cursor-pointer items-center justify-center rounded-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60"
      >
        <Icon name={active.icon} className="size-4 shrink-0 opacity-70" />
      </button>
    );
  }

  return (
    /**
     * `w-fit` and a track, and both are corrections to the first version.
     *
     * With `flex-1` the three buttons shared the sidebar's full 240px, which put the sun three
     * inches from the monitor and made the selected one a wide slab. Nothing said they were one
     * control, or one CHOICE - they read as three unrelated icons that had drifted to the bottom of
     * the panel. Fixed squares in a tinted track is the segmented-control shape people already know.
     *
     * `mx-1` rather than the `px-2` on Sign out below, so that a 24px button holding a 14px icon
     * puts that icon on the SAME vertical line as the 16px icons in the nav above. Matching the
     * padding would have missed by four pixels, which is enough to see.
     *
     * **NO TINTED TRACK BEHIND THEM, WHICH IS THE SECOND CORRECTION AND THE LESS OBVIOUS ONE.** A
     * track needs the selected chip to sit against it, and the two tokens that would draw them swap
     * places between the themes: `--sidebar-accent` is DARKER than `--sidebar` on paper and LIGHTER
     * than it on ink. One pair of colours therefore cannot mean "raised" in both, and the dark
     * version came out as a moon you had to hunt for. So the selected one is marked the way an
     * active nav item three inches above it is marked, with the same two tokens - which reads
     * correctly in both themes because it is a relative shift rather than a fixed pair, and makes
     * the control look like part of the panel instead of a widget dropped into it.
     *
     * `role="group"` rather than a radiogroup: three buttons that each do something the moment they
     * are pressed, not three inputs waiting on a submit.
     */
    <div role="group" aria-label="Theme" className="mx-1 flex w-fit items-center gap-px">
      {MODES.map(({ value, label, icon }) => {
        const on = current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-label={label}
            // `aria-pressed` is what tells a screen reader which of the three is on. Nothing about
            // the tint below is available to one.
            aria-pressed={on}
            title={label}
            className={cn(
              "flex size-6 cursor-pointer items-center justify-center rounded-sm transition-colors",
              on
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground opacity-60 hover:bg-sidebar-accent/60 hover:opacity-100",
            )}
          >
            <Icon name={icon} className="size-3.5 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
