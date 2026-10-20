"use client";

import { Menu as Base } from "@base-ui/react/menu";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactElement, type ReactNode } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./icon";
import { motionPresets } from "./motion";
import { usePortalLayer } from "./root";

/**
 * THE MENU: a list of things to DO. Not a select: a select holds a value and marks the current one;
 * a menu marks nothing and every row acts (docs/DESIGN-LANGUAGE.md 9).
 *
 * - **It grows out of the button that opened it** and shrinks back into it. The scale starts from
 *   the trigger's side (`--transform-origin`, which Base UI measures), so the menu reads as the
 *   button opening rather than a box appearing nearby.
 * - **Interruptible.** Click the button again while it is opening and it folds back from wherever it
 *   is; nothing waits for an animation.
 * - **A panel** (tokens.css: nearly solid, a light blur, a hairline), floating over the page.
 * - Keyboard: arrows move, Enter acts, Escape closes and returns focus to the button. Base UI does
 *   all of that; this file is the look and the motion.
 *
 * The highlighted row (pointer or keyboard) gets a soft fill. That is navigation, not decoration:
 * without it the keyboard has nowhere visible to be.
 */

export type MenuAction = {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  /** Removes something. Red words, and it goes last, after a separator. */
  destructive?: boolean;
  /**
   * The current one of a set of choices (a stage, who a job is assigned to). It rests on the grey
   * fill, in medium weight, rather than carrying a tick: a tick at the row's end pushed the counts
   * out of line and was the one row shaped differently (owner, 2026-10-13).
   */
  checked?: boolean;
  /** A quiet fact at the row's end, such as how many jobs are in a stage. */
  detail?: string;
  /** Something drawn before the label instead of an icon, such as a stage's colour dot. */
  lead?: ReactNode;
  disabled?: boolean;
};

/** Each inner array is a group; groups are separated by a line. */
export function Menu({
  trigger,
  header,
  groups,
  side = "bottom",
  align = "start",
}: {
  /** The button that opens it: a `<Button>`. Its own press motion still runs. */
  trigger: ReactElement;
  /** Something to read or set before the actions: who you are, a theme switch. Not an action. */
  header?: ReactNode;
  groups: MenuAction[][];
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
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
                // Scrolls inside the room left on screen: a list of times is longer than a phone is tall.
                className="max-h-[min(var(--available-height),26rem)] min-w-60 origin-(--transform-origin) overflow-y-auto rounded-[10px] p-1.5 outline-none"
                render={
                  <motion.div
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1, transition: motionPresets.pop }}
                    exit={{ opacity: 0, scale: 0.6, transition: motionPresets.move }}
                  />
                }
              >
                {header ? <div className="px-2 pt-1 pb-1">{header}</div> : null}
                {groups.map((group, g) => (
                  <MenuGroup key={g} first={g === 0 && !header}>
                    {group.map((action, i) => (
                      <Base.Item
                        key={`${i}-${action.label}`}
                        disabled={action.disabled}
                        onClick={action.onSelect}
                        aria-current={action.checked ? "true" : undefined}
                        className={cn(
                          // PLAIN (owner, 2026-10-13): a soft grey fill under the row, small corners. The
                          // glass capsule here read as decoration in a control people use all day.
                          "flex h-(--ds-control-md) cursor-pointer items-center gap-3 rounded-tile px-2.5 text-body outline-none select-none",
                          "transition-colors duration-75 data-highlighted:bg-fill data-disabled:pointer-events-none data-disabled:opacity-40",
                          action.checked && "bg-fill font-medium",
                          action.destructive ? "text-danger-text" : "text-label",
                        )}
                      >
                        {action.lead ?? (action.icon ? <Icon name={action.icon} weight="regular" className="size-[18px]" /> : null)}
                        <span className="flex-1 truncate">{action.label}</span>
                        {action.detail ? (
                          <span className="text-footnote text-label-secondary tabular-nums">{action.detail}</span>
                        ) : null}
                      </Base.Item>
                    ))}
                  </MenuGroup>
                ))}
              </Base.Popup>
            </Base.Positioner>
          </Base.Portal>
        ) : null}
      </AnimatePresence>
    </Base.Root>
  );
}

function MenuGroup({ first, children }: { first: boolean; children: ReactNode }) {
  return (
    <>
      {/* Edge to edge: a group boundary runs the menu's full width, not a line floating in it. */}
      {first ? null : <Base.Separator className="-mx-1.5 my-1.5 h-px bg-separator" />}
      {/* A 1px gap between rows, so the hovered row and the chosen one never run into one block. */}
      <Base.Group className="flex flex-col gap-px">{children}</Base.Group>
    </>
  );
}
