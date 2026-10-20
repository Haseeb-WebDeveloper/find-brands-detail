"use client";

import { Dialog as Base } from "@base-ui/react/dialog";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { motionPresets } from "./motion";
import { usePortalLayer } from "./root";
import { cn } from "./cn";

/**
 * THE DIALOG: a question that must be answered before anything else. In this language that is almost
 * only "this cannot be undone, are you sure?". Everything that can be undone just happens and offers
 * Undo; everything that writes beside a record is a `Sheet` (docs/DESIGN-LANGUAGE.md 9).
 *
 * - **A title that is the question, and two buttons that are the answers.** "Delete this job?",
 *   "Delete" and "Keep it". Never "Are you sure?" with "OK" and "Cancel". A line under the title only
 *   when the consequence is not obvious from it.
 * - **A panel over a dimmed page.** The dim is what makes it block: the page is still there but
 *   is not the thing to look at.
 * - **It arrives from slightly larger and settles**, like iOS, rather than growing from a point: it
 *   did not come from anywhere on the page, it came from the decision.
 * - The safe answer is on the left and takes focus first, so Enter never deletes by accident; a
 *   click outside or Escape is the safe answer too (owner, 2026-10-17: it would not close).
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  detail,
  confirm,
  cancel = "Cancel",
  destructive = false,
  onConfirm,
  children,
  busy = false,
  closeOnConfirm = true,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The question itself. "Delete this job?" */
  title: string;
  /** Only when the title does not already say what happens. */
  detail?: string;
  /**
   * The answer that acts, named for what it does. "Delete", "Send quote". Left out for a dialog that
   * only shows something (how to reach somebody), which then has the one button that closes it.
   */
  confirm?: string;
  /** The answer that does nothing. "Keep it" reads better than "Cancel" where it fits. */
  cancel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  /**
   * What must be filled in before answering, between the question and the buttons: the typed name on
   * a signature. Left aligned, unlike the title, because it is a form and not a sentence.
   */
  children?: ReactNode;
  /** The confirm answer is working, or cannot be given yet: it waits, disabled. */
  busy?: boolean;
  /** False when confirming can fail and must say why here: the caller closes it once it has worked. */
  closeOnConfirm?: boolean;
  /** For a popup carrying several steps of instructions (connecting a mailbox): more room per line. */
  wide?: boolean;
}) {
  const layer = usePortalLayer();

  return (
    <Base.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <Base.Portal keepMounted container={layer}>
            <Base.Backdrop
              className="fixed inset-0 z-50 bg-scrim"
              render={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: motionPresets.fade }}
                  exit={{ opacity: 0, transition: motionPresets.fade }}
                />
              }
            />
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
              <Base.Popup
                data-panel
                /* Never taller than the screen: the middle scrolls and the question and the answers stay put
                   (owner, 2026-10-17: Connect Gmail ran off the bottom). A form reads from the left;
                   a one-line question stays centred. */
                className={cn("pointer-events-auto flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-5 rounded-sheet p-5 outline-none", children ? cn(wide ? "max-w-lg" : "max-w-md", "text-left") : "max-w-sm text-center")}
                render={
                  <motion.div
                    initial={{ opacity: 0, scale: 1.12 }}
                    animate={{ opacity: 1, scale: 1, transition: motionPresets.pop }}
                    exit={{ opacity: 0, scale: 0.94, transition: motionPresets.move }}
                  />
                }
              >
                <div className="flex shrink-0 flex-col gap-1">
                  <Base.Title className="text-title-2 text-label">{title}</Base.Title>
                  {detail ? (
                    <Base.Description className={cn("text-body text-label", !children && "text-balance")}>{detail}</Base.Description>
                  ) : null}
                </div>
                {children ? <div className="-mx-5 flex min-h-0 flex-col gap-3 overflow-y-auto px-5">{children}</div> : null}
                {confirm === undefined ? (
                  <Base.Close render={<Button className="w-full">{cancel}</Button>} />
                ) : (
                <div className="grid shrink-0 grid-cols-2 gap-3">
                  <Base.Close render={<Button className="w-full">{cancel}</Button>} />
                  <Button
                    kind="filled"
                    destructive={destructive}
                    className="w-full"
                    disabled={busy}
                    onClick={() => {
                      onConfirm?.();
                      if (closeOnConfirm) onOpenChange(false);
                    }}
                  >
                    {confirm}
                  </Button>
                </div>
                )}
              </Base.Popup>
            </div>
          </Base.Portal>
        ) : null}
      </AnimatePresence>
    </Base.Root>
  );
}
