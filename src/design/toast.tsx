"use client";

import { Toast } from "@base-ui/react/toast";
import { spring } from "motion";
import { useCallback, type CSSProperties, type ReactNode } from "react";
import { Button } from "./button";
import { usePortalLayer } from "./root";

/**
 * TOASTS: the past tense of an action, with the way back. "Quote sent", Undo.
 *
 * In this language almost nothing asks "are you sure?". It just happens, says so here, and offers
 * Undo for a few seconds (docs/DESIGN-LANGUAGE.md 9). So a toast is short: what happened, in two or
 * three words, and at most one action. Never a paragraph, never an error that needs reading (that
 * belongs beside the thing that failed).
 *
 * - **One at a time.** A second replaces the first; a stack of receipts is noise.
 * - **A panel capsule at the bottom**, above the phone's tab bar, rising on our `pop` spring and
 *   swipeable down and away. It stays while a pointer or a finger is on it.
 * - Screen readers hear it: Base UI announces it politely.
 */

/** The `pop` preset (motion.ts) as a CSS curve, for the rise and the swipe back. */
const POP = spring(0.32, 0.18).toString();

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider limit={1} timeout={4000}>
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
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            swipeDirection="down"
            data-panel
            style={{ "--toast-move": POP } as CSSProperties}
            className={[
              "pointer-events-auto absolute bottom-0 flex h-(--ds-control-lg) max-w-full items-center gap-2 rounded-full pr-1.5 pl-5",
              "[transform:translateY(var(--toast-swipe-movement-y))]",
              "[transition:transform_var(--toast-move),opacity_200ms_ease-out] data-swiping:[transition:none]",
              "data-starting-style:[transform:translateY(calc(100%+24px))_scale(0.9)] data-starting-style:opacity-0",
              "data-ending-style:opacity-0 data-ending-style:[transform:translateY(calc(var(--toast-swipe-movement-y)+100%+24px))]",
              "data-limited:opacity-0",
            ].join(" ")}
          >
            <Toast.Title className="truncate text-callout text-label" />
            {toast.actionProps ? (
              <Toast.Action render={<Button kind="plain" size="sm">{toast.actionProps.children}</Button>} />
            ) : null}
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

/**
 * Say something happened. `toast("Quote sent", { label: "Undo", onSelect: unsend })`.
 * The label is the way back, named for what it does.
 */
export function useToast() {
  const manager = Toast.useToastManager();
  return useCallback(
    (title: string, action?: { label: string; onSelect: () => void }) => {
      manager.add({
        title,
        actionProps: action ? { children: action.label, onClick: action.onSelect } : undefined,
      });
    },
    [manager],
  );
}
