"use client";

import { Toast } from "@base-ui/react/toast";
import { spring } from "motion";
import { useCallback, type CSSProperties, type ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Icon, type IconName } from "./icon";
import { usePortalLayer } from "./root";

/**
 * TOASTS: what just happened, in one short line, with at most one action. "Deleted Week 43", Undo.
 *
 * In this language almost nothing asks "are you sure?". It just happens, says so here, and offers
 * Undo for a few seconds (docs/DESIGN-LANGUAGE.md 9).
 *
 * - **A tone, shown by its icon.** Done (green tick), a refusal or failure (red warning), or under
 *   way (blue info: "Research started again"). The colour sits in the icon's small disc, not across
 *   the panel, so the words stay the thing to read (owner, 2026-10-23: the plain grey capsule gave no
 *   sign whether something had worked).
 * - **An error stays longer** (7s, not 4s): it has to be read, and it may run to two lines.
 * - **One at a time.** A second replaces the first; a stack of receipts is noise.
 * - **A panel card at the bottom**, above the phone's tab bar, rising on our `pop` spring and
 *   swipeable down and away, with a close button. It stays while a pointer or a finger is on it.
 * - Screen readers hear it: Base UI announces it politely.
 */

export type ToastTone = "success" | "error" | "info";

const TONE: Record<ToastTone, { icon: IconName; disc: string }> = {
  success: { icon: "check", disc: "bg-system-green/15 text-system-green" },
  error: { icon: "warning", disc: "bg-system-red/15 text-system-red" },
  info: { icon: "info", disc: "bg-system-blue/15 text-system-blue" },
};

const TIMEOUT: Record<ToastTone, number> = { success: 4000, error: 7000, info: 4000 };

const toneOf = (type: string | undefined): ToastTone => (type === "error" || type === "info" ? type : "success");

/** The `pop` preset (motion.ts) as a CSS curve, for the rise and the swipe back. */
const POP = spring(0.32, 0.18).toString();

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider limit={1} timeout={TIMEOUT.success}>
      {children}
      <Toasts />
    </Toast.Provider>
  );
}

function Toasts() {
  const layer = usePortalLayer();
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal container={layer}>
      <Toast.Viewport className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6 md:pl-[calc(var(--frame-sidebar,0px)+16px)]">
        {toasts.map((toast) => {
          const tone = TONE[toneOf(toast.type)];
          return (
            <Toast.Root
              key={toast.id}
              toast={toast}
              swipeDirection="down"
              data-panel
              style={{ "--toast-move": POP } as CSSProperties}
              className={[
                "pointer-events-auto absolute bottom-0 flex w-max max-w-[min(28rem,100%)] items-center gap-3 rounded-card py-2.5 pr-2 pl-3 shadow-(--ds-shadow-lg)",
                "[transform:translateY(var(--toast-swipe-movement-y))]",
                "[transition:transform_var(--toast-move),opacity_200ms_ease-out] data-swiping:[transition:none]",
                "data-starting-style:[transform:translateY(calc(100%+24px))_scale(0.9)] data-starting-style:opacity-0",
                "data-ending-style:opacity-0 data-ending-style:[transform:translateY(calc(var(--toast-swipe-movement-y)+100%+24px))]",
                "data-limited:opacity-0",
              ].join(" ")}
            >
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", tone.disc)}>
                <Icon name={tone.icon} weight="semibold" className="size-4.5" />
              </span>
              <Toast.Title className="line-clamp-3 min-w-0 flex-1 text-callout text-label" />
              {toast.actionProps ? (
                <Toast.Action render={<Button kind="plain" size="sm">{toast.actionProps.children}</Button>} />
              ) : null}
              <Toast.Close
                aria-label="Close"
                className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-label-secondary transition-colors hover:bg-fill hover:text-label"
              >
                <Icon name="close" className="size-4" />
              </Toast.Close>
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

/**
 * Say something happened. `toast("Deleted Week 43")`, `toast(result.error, { tone: "error" })`,
 * `toast("Quote sent", { action: { label: "Undo", onSelect: unsend } })`. The tone is "success"
 * unless said; the action's label is the way back, named for what it does.
 */
export function useToast() {
  const manager = Toast.useToastManager();
  return useCallback(
    (title: string, { tone = "success", action }: { tone?: ToastTone; action?: { label: string; onSelect: () => void } } = {}) => {
      manager.add({
        title,
        type: tone,
        timeout: TIMEOUT[tone],
        actionProps: action ? { children: action.label, onClick: action.onSelect } : undefined,
      });
    },
    [manager],
  );
}
