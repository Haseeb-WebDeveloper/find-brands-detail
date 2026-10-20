"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * A RECORD'S DETAILS: label on the left, value on the right, in named groups ("Job", "Customer").
 * The values are the controls: a stage is a menu, a date is the calendar, a phone number is text you
 * click to change. Nothing looks like a form until you touch it, so eleven details read as facts
 * about the job rather than eleven empty boxes.
 *
 * A value nobody has filled in reads what to do in secondary text ("Add phone"), never "Empty"; a
 * value this person cannot change is plain text, and an empty one of those is a dash.
 */
export function DetailGroup({ title, large = false, children }: { title: string; large?: boolean; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      {/* `large`: a full-strength heading a size up, for a page that is only groups (Settings), piloted
          there before it reaches the record pages (owner, 2026-10-17). */}
      <h2 className={large ? "px-1 pb-2 text-headline text-label" : "px-1 pb-1.5 text-footnote font-medium text-label-secondary"}>{title}</h2>
      {/* A raised card on the page, like every list on a record page (owner, 2026-10-14). */}
      <div className="flex flex-col rounded-card bg-surface px-2 py-1.5">{children}</div>
    </section>
  );
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-3">
      <span className="w-28 shrink-0 truncate px-1 text-callout text-label-secondary">{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

/** The well every value sits in: transparent at rest, a soft fill under a press or while editing. */
export const DETAIL_VALUE =
  "flex h-8 w-full min-w-0 items-center rounded-field px-2 text-left text-callout text-label transition-colors duration-100";

/**
 * TEXT YOU CLICK TO CHANGE. Text at rest; one press makes it a field with the value selected; Enter
 * or leaving saves, Escape puts it back. `onSave` is called only when the words actually changed.
 */
export function InlineText({
  value,
  placeholder,
  onSave,
  disabled,
  display,
  className,
  ...input
}: {
  value: string;
  /** What an empty value reads, as an invitation ("Add phone"). */
  placeholder: string;
  onSave: (next: string) => void;
  disabled?: boolean;
  /** How the value reads at rest, when that differs from the text you edit (a price, formatted). */
  display?: ReactNode;
  className?: string;
} & Pick<ComponentProps<"input">, "inputMode" | "type" | "autoComplete" | "aria-label" | "list">) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (disabled) {
    return <span className={cn(DETAIL_VALUE, "truncate", className)}>{display ?? (value || "–")}</span>;
  }

  if (editing) {
    const finish = (save: boolean) => {
      setEditing(false);
      if (save && draft.trim() !== value.trim()) onSave(draft.trim());
    };
    return (
      <input
        autoFocus
        value={draft}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(input.inputMode === "decimal" ? keepPrice(event.currentTarget.value) : event.currentTarget.value)}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") finish(true);
          if (event.key === "Escape") finish(false);
        }}
        className={cn(DETAIL_VALUE, "border border-tint bg-surface outline-none", className)}
        {...input}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={cn(DETAIL_VALUE, "cursor-text active:bg-fill", !value && "text-label-secondary", className)}
    >
      <span className="truncate">{value ? (display ?? value) : placeholder}</span>
    </button>
  );
}

/** A price as typed into a detail: digits, a point, commas, spaces and a dash for a range ("8,200 - 8,600"). No letters. */
function keepPrice(value: string): string {
  return value.replace(/[^0-9.,\s\-–]/g, "");
}
