"use client";

import { Popover as Base } from "@base-ui/react/popover";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactElement, type ReactNode } from "react";
import { cn } from "./cn";
import { motionPresets } from "./motion";
import { usePortalLayer } from "./root";

/**
 * THE POPOVER: a little more about something, without leaving the screen. A visit's details from the
 * diary, who a lead came from. It grows out of what opened it, exactly as a menu does, and it is
 * the same panel surface, so the two read as one family.
 *
 * NOT for anything that writes beside a record: composing, booking and editing are a `Sheet`, which
 * keeps the record in view and has room for a form (docs/DESIGN-LANGUAGE.md 9).
 */
export function Popover({
  trigger,
  title,
  children,
  side = "bottom",
  align = "center",
  open: openProp,
  onOpenChange,
  fit = false,
}: {
  trigger: ReactElement;
  /** Controlled, for a popover that closes itself once its job is done (a date picked). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** What it is about, as a title. No paragraph under it. */
  title?: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  /**
   * As wide as what is in it, with a tighter edge: for a calendar, whose grid has its own width. A
   * calendar centred in the standard 320px box sat off-centre with a wide margin (owner, 2026-10-13).
   */
  fit?: boolean;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const layer = usePortalLayer();

  return (
    <Base.Root open={open} onOpenChange={setOpen}>
      <Base.Trigger render={trigger} />
      <AnimatePresence>
        {open ? (
          <Base.Portal keepMounted container={layer}>
            <Base.Positioner side={side} align={align} sideOffset={8} collisionPadding={12} className="z-50 outline-none">
              <Base.Popup
                data-panel
                className={cn("max-w-[calc(100vw-24px)] origin-(--transform-origin) rounded-panel outline-none", fit ? "w-auto p-2" : "w-80 p-4")}
                render={
                  <motion.div
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1, transition: motionPresets.pop }}
                    exit={{ opacity: 0, scale: 0.6, transition: motionPresets.move }}
                  />
                }
              >
                {title ? <Base.Title className="mb-3 text-headline text-label">{title}</Base.Title> : null}
                {children}
              </Base.Popup>
            </Base.Positioner>
          </Base.Portal>
        ) : null}
      </AnimatePresence>
    </Base.Root>
  );
}
