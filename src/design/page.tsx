"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { motionPresets } from "./motion";
import { cn } from "./cn";
import { ScrollRootProvider } from "./root";
import { usePhone } from "./use-media";

/**
 * A layer pinned to the bottom of the page's visible area, for things that float over it while it
 * scrolls: the bar of bulk actions. It spans the page column only, so a bar centred in it is centred on
 * the page rather than on the window (which would put it half under the sidebar).
 */
const FloatLayer = createContext<HTMLElement | null>(null);

export function useFloatLayer() {
  return useContext(FloatLayer);
}

/**
 * A PAGE BUILT IN THE NEW DESIGN LANGUAGE, INSIDE THE OFFICE.
 *
 * The office frame (AppShell) still holds pages that have not been rebuilt, in a page column set to
 * the old surface's type (`legacy-surface`). A rebuilt page steps out of that in three ways:
 *
 *   full bleed   `data-page="full-bleed"`, so the frame drops its own top bar and padding on desktop
 *                and the page draws its own header row.
 *   own scroll   the page is its own scrolling box and tells `PageHeader` so (`ScrollRootProvider`),
 *                because the frame stops scrolling a full-bleed page.
 *   own type     the new language's font, size and tracking, and its own ground (`--ds-ground`, tokens.css).
 *
 * Plus the float layer above, and `aside`: a column beside the page for the work somebody opened
 * from it (a task, a payment, a note). Beside, not over: the record stays readable while you write
 * into it (owner, earlier: "it was supposed to be like a side panel"). It has its own scroll and runs
 * the page's full height; on a phone, where there is no room beside, it covers the page instead.
 * Delete the first and third reasons when the last page has moved over and the frame is all new.
 */
export function DesignPage({
  className,
  aside,
  children,
}: {
  className?: string;
  /** The open side panel, or nothing. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const phone = usePhone();
  return (
    <ScrollRootProvider value={scroller}>
      <FloatLayer value={layer}>
        <div data-page="full-bleed" data-design-page className="design-surface flex h-full min-h-0">
          <div className="relative h-full min-w-0 flex-1">
            <div ref={scroller} className={cn("h-full overflow-y-auto overscroll-contain bg-(--ds-ground) pb-12", className)}>
              {children}
            </div>
            <div
              ref={setLayer}
              className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(24px,env(safe-area-inset-bottom))]"
            />
          </div>
          {/* It slides in from the edge it belongs to and goes back the same way, on the sheet's
              spring; the page beside it narrows with it rather than jumping. */}
          <AnimatePresence initial={false}>
            {aside ? (
              <motion.aside
                key="aside"
                // A phone: it covers the page, so it slides over from the right. Wider: it takes a
                // column, so it opens to its width and the page narrows beside it.
                initial={phone ? { x: "100%" } : { width: 0, opacity: 0 }}
                animate={phone ? { x: 0, transition: motionPresets.sheet } : { width: "auto", opacity: 1, transition: motionPresets.sheet }}
                exit={phone ? { x: "100%", transition: motionPresets.move } : { width: 0, opacity: 0, transition: motionPresets.move }}
                className="fixed inset-0 z-40 flex min-h-0 flex-col overflow-hidden bg-(--ds-ground) md:static md:z-auto md:shrink-0 md:border-l md:border-separator"
              >
                <div className="flex min-h-0 w-screen flex-1 flex-col overflow-y-auto md:w-[31.25rem]">{aside}</div>
              </motion.aside>
            ) : null}
          </AnimatePresence>
        </div>
      </FloatLayer>
    </ScrollRootProvider>
  );
}
