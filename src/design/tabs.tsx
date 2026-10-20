"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "./cn";
import { motionPresets } from "./motion";

/**
 * TABS: the parts of one record (a job's tasks, its money, its files). A row of words, the current
 * one resting on a soft capsule that slides to the next, like the filter row on a list. Counts sit
 * beside a word only where the number is the reason to open it ("3/7", "£2,400").
 *
 * The row scrolls sideways when it does not fit (a phone), rather than wrapping onto a second line
 * that would make the tabs look like two groups.
 *
 * A tab list to a screen reader; arrow keys move between tabs.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  items: readonly { id: T; label: string; count?: string | number }[];
  label: string;
  className?: string;
}) {
  const group = useId();
  const index = items.findIndex((item) => item.id === value);

  return (
    <div
      role="tablist"
      aria-label={label}
      // Slides sideways on a phone, without a scrollbar: a bar under the tabs reads as part of them.
      className={cn("-mx-4 flex items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden", className)}
      onKeyDown={(event) => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = items[(index + step + items.length) % items.length];
        onChange(next.id);
        document.getElementById(`${group}-${next.id}`)?.focus();
      }}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            id={`${group}-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative isolate flex h-(--ds-control-sm) shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-callout whitespace-nowrap",
              "transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-tint",
              selected ? "font-medium text-label" : "text-label-secondary active:opacity-70",
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`${group}-marker`}
                transition={motionPresets.stretch}
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-fill"
              />
            ) : null}
            {item.label}
            {item.count !== undefined && item.count !== "" ? (
              <span className="text-footnote text-label-secondary tabular-nums">{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
