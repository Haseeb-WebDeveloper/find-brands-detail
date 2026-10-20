"use client";

import { motion, useScroll, useTransform } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { useNavMenu, useScrollRoot } from "./root";

/**
 * THE PAGE HEADER: one row, the page's title on the left and its few actions on the right.
 *
 * ONE ROW, PINNED (owner, 2026-10-13). The first version put an empty bar above a large title, with
 * the actions floating in a glass capsule at the top right, iOS style; on a desktop it read as a strip
 * of nothing over the title and two buttons adrift in a corner. A work tool's header is a toolbar: the
 * title where the eye starts, the actions level with it, and the row stays put while the page scrolls
 * under it, dissolving into its lower edge (the scroll edge, tokens.css) once something is underneath.
 *
 * - **No line under the title.** A title is enough (docs/DESIGN-LANGUAGE.md 10, rule 4).
 * - `back`: a child page (one job) gets a back control before its title. On a phone its title moves
 *   to its own line under the bar, the way iPhone sets a large title: a record's name is long, and
 *   beside a back button and two actions it was cut to one letter (owner's screen, 2026-10-13).
 * - **On a phone** a top-level page puts the menu button there instead: the app's one bar on a phone
 *   is this row, not a second strip above it holding only the button and an icon.
 * - `actions`: plain buttons, the page's one main action last and filled.
 * - Pages change instantly. A work tool does not animate between screens.
 */
export function PageHeader({
  title,
  back,
  actions,
}: {
  title: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  const scroller = useScrollRoot();
  const { scrollY } = useScroll({ container: scroller ?? undefined });
  // Nothing behind the row at rest; the edge fades in over the first 12px of scrolling.
  const edge = useTransform(scrollY, [0, 12], [0, 1]);
  const openNav = useNavMenu();

  return (
    <>
    <div className="sticky top-0 z-20 -mx-4 mb-2 flex h-16 items-center gap-3 px-4 md:-mx-8 md:px-8">
      <motion.div
        aria-hidden
        style={{ opacity: edge }}
        className="scroll-edge pointer-events-none absolute inset-x-0 top-0 -z-10 h-24"
      />
      {back ? (
        <Button iconOnly icon="back" size="sm" href={back.href} className="-ml-1">
          {back.label}
        </Button>
      ) : openNav ? (
        <Button kind="plain" iconOnly icon="menu" className="-mr-1.5 -ml-3 text-label md:hidden" onClick={openNav}>
          Menu
        </Button>
      ) : null}
      <h1 className={cn("min-w-0 flex-1 truncate text-large-title text-label", back && "hidden md:block")}>{title}</h1>
      {back ? <span className="flex-1 md:hidden" /> : null}
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
    {back ? <h1 className="mb-1 line-clamp-2 text-large-title text-label md:hidden">{title}</h1> : null}
    </>
  );
}
