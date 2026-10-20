"use client";

import { Drawer } from "@base-ui/react/drawer";
import { spring } from "motion";
import { useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { usePortalLayer } from "./root";
import { usePhone } from "./use-media";

/**
 * THE SHEET: where you write beside something. Booking a visit, composing a text, editing a job's
 * details. The record it belongs to stays on screen (docs/DESIGN-LANGUAGE.md 8, 9).
 *
 * ONE COMPONENT, TWO SHAPES, because the device decides where there is room:
 *   phone     rises from the bottom, flush with the screen's bottom and sides. It rests at HALF
 *             height, and drags up to full or down to close.
 *   desktop   slides in from the right, flush with the window's edge and full height, a hairline
 *             between it and the page. Swipeable back out.
 *
 * PLAIN (owner, 2026-10-13, asked twice): solid surface, square corners, no shadow, NOT GLASS. A sheet
 * is the screen's edge pulled out, not a card hovering over it. Glass, with its rim light and inner
 * glow, read as a lifted, shadowed object however the shadow itself was set, so it went entirely.
 * The sheet is the one large surface that holds a form, which is content, and content is solid.
 *
 * THE PHYSICS ARE BASE UI'S DRAWER, deliberately not hand-made: it tracks the finger 1:1 from where
 * it was grabbed, projects a flick to the height it was heading for (so a hard flick from half
 * closes, or reaches full, without being dragged all the way), resists past the ends, and handles
 * the phone keyboard. What this file adds is the look, and the curve: the transition is OUR `sheet`
 * spring (motion.ts), compiled to a CSS curve, so a sheet settles exactly like everything else in
 * the language. A CSS transition can be caught mid-flight and turned round, which is the point.
 */

/** The `sheet` preset (0.4s, no bounce) as a CSS duration and curve: "750ms linear(...)". */
const SETTLE = spring(0.4, 0).toString();
const TRANSITION = `transform ${SETTLE}`;

/** Half the screen, then all of it (less a margin, so the page behind still shows at the top). */
const PHONE_HEIGHTS = [0.5, 1];

export function Sheet({
  trigger,
  open,
  onOpenChange,
  title,
  action,
  form = false,
  children,
}: {
  /** The button that opens it. Optional when the sheet is opened from code. */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** What the sheet is for. "Book a visit". */
  title: string;
  /** The one thing to do when finished, top right. "Book", "Send". Closing is always top left. */
  action?: { label: string; onSelect: () => void };
  /**
   * A form: on a phone it opens at full height. Half a screen hid half its fields (owner, 2026-10-13),
   * and the keyboard takes the other half the moment a field is tapped.
   */
  form?: boolean;
  children: ReactNode;
}) {
  const phone = usePhone();
  const layer = usePortalLayer();
  const opening = form ? PHONE_HEIGHTS[1] : PHONE_HEIGHTS[0];
  const [height, setHeight] = useState<Drawer.Root.SnapPoint | null>(opening);

  return (
    <Drawer.Root
      // A NEW ROOT when the shape changes. The server draws the desktop panel (it cannot know the
      // screen) and a phone switches to the bottom sheet on its first paint; one root living
      // through that switch saw its heights go from "none" to "half and full" and lost track of
      // which it was at, so it opened at full height. Each shape gets its own root from its first
      // render instead.
      key={phone ? "phone" : "desktop"}
      open={open}
      onOpenChange={(next) => {
        if (next) setHeight(opening);
        onOpenChange?.(next);
      }}
      swipeDirection={phone ? "down" : "right"}
      snapPoints={phone ? PHONE_HEIGHTS : undefined}
      snapPoint={phone ? height : undefined}
      onSnapPointChange={phone ? setHeight : undefined}
    >
      {trigger ? <Drawer.Trigger render={trigger} /> : null}
      <Drawer.Portal container={layer}>
        {/* A phone sheet dims the page; a desktop panel leaves it bright, because the point of a
            panel is that you can still read what it is beside. */}
        {phone ? (
          <Drawer.Backdrop
            className="fixed inset-0 z-50 bg-scrim opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-300 data-starting-style:opacity-0 data-ending-style:opacity-0 data-swiping:duration-0"
          />
        ) : null}
        <Drawer.Viewport
          className={cn(
            "pointer-events-none fixed inset-0 z-50 flex",
            phone ? "items-end justify-center" : "items-stretch justify-end",
          )}
        >
          <Drawer.Popup
            style={{ "--sheet-transition": TRANSITION } as CSSProperties}
            className={cn(
              "pointer-events-auto relative flex flex-col bg-surface outline-none",
              // While a finger holds it there is no transition at all: it is glued to the finger.
              "[transition:var(--sheet-transition)] data-swiping:[transition:none]",
              phone
                ? cn(
                    "h-[calc(100dvh-24px)] w-full touch-none pb-[env(safe-area-inset-bottom)]",
                    "[transform:translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))]",
                    "data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)]",
                  )
                : cn(
                    "h-full w-[420px] max-w-full border-l border-separator",
                    "[transform:translateX(var(--drawer-swipe-movement-x))]",
                    "data-starting-style:[transform:translateX(100%)] data-ending-style:[transform:translateX(100%)]",
                  ),
            )}
          >
            {/* The grabber: says "this moves", and is the easiest place to grab. Phone only. */}
            {phone ? <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-grabber" /> : null}
            <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 pt-2 pb-3 select-none">
              <Drawer.Close
                render={
                  <Button iconOnly icon="close" className="justify-self-start">
                    Close
                  </Button>
                }
              />
              <Drawer.Title className="truncate text-title-3 text-label">{title}</Drawer.Title>
              {action ? (
                <Button kind="filled" size="sm" className="justify-self-end" onClick={action.onSelect}>
                  {action.label}
                </Button>
              ) : (
                <span />
              )}
            </div>
            <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 touch-auto">
              {children}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
