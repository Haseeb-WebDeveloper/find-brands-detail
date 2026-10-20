"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";

/**
 * THE SIDE PANEL: one piece of work opened beside a record (a task, a note, an update to the
 * customer). It sits in the page's `aside` column (`DesignPage`), so the record stays readable while
 * you write into it.
 *
 *   header   what this is, in words, and the way out (×, or Escape).
 *   body     the work, at the language's own sizes: real fields, real menus, no small grey selects.
 *   footer   the quiet actions on the left (delete), the one thing this panel is for on the right.
 *
 * Nothing saves on a timer you cannot see: each panel says how it saves, and the ones that save as
 * you go say nothing at all because nothing can be lost.
 */
export function SidePanel({
  title,
  subtitle,
  onClose,
  secondaryActions,
  primaryAction,
  children,
  className,
}: {
  title: string;
  /** One quiet fact beside the title: "Edited 2h ago". */
  subtitle?: string;
  onClose: () => void;
  secondaryActions?: ReactNode;
  primaryAction?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // Escape closes it. Bound to the document, because focus is usually in a field inside the panel.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-(--ds-ground)">
      <header className="flex h-16 shrink-0 items-center gap-3 px-5">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h2 className="truncate text-title-3 text-label">{title}</h2>
          {subtitle ? <span className="shrink-0 text-footnote text-label-secondary">{subtitle}</span> : null}
        </div>
        <Button kind="gray" size="sm" iconOnly icon="close" onClick={onClose}>
          Close
        </Button>
      </header>
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6", className)}>{children}</div>
      {secondaryActions || primaryAction ? (
        <footer className="flex shrink-0 items-center gap-2 border-t border-separator px-5 py-3">
          {secondaryActions}
          <span className="flex-1" />
          {primaryAction}
        </footer>
      ) : null}
    </div>
  );
}

/** A multi-line field in the text field's well: a task's notes, an update to the customer. */
export function TextArea({
  label,
  hideLabel = false,
  className,
  ...area
}: { label: string; hideLabel?: boolean; className?: string } & Omit<React.ComponentProps<"textarea">, "className">) {
  return (
    <label className="flex flex-col gap-2">
      <span className={cn("text-subhead text-label-secondary", hideLabel && "sr-only")}>{label}</span>
      <textarea
        className={cn(
          "min-h-28 w-full resize-y rounded-field border border-transparent bg-fill px-3 py-2.5 text-body text-label",
          "placeholder:text-label-secondary transition-[border-color,background-color] duration-150 ease-out",
          "focus:border-tint focus:bg-surface focus-visible:outline-none disabled:opacity-60",
          className,
        )}
        {...area}
      />
    </label>
  );
}
