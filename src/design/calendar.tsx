"use client";

import { DayPicker } from "react-day-picker";
import { Icon } from "./icon";

/**
 * THE CALENDAR: a month of days to pick one from. Never the browser's own date widget, which draws
 * in the browser's look, in the browser's language and field order, and on Windows as a grey box from
 * another decade (owner's screen, 2026-10-13).
 *
 * The grid and its keyboard handling are react-day-picker's (a date grid is fiddly: month lengths,
 * week starts, arrow keys, focus); this file is only the look, in our tokens. Round days at the
 * language's row size, today in the accent, the chosen day filled with it, the neighbouring months'
 * days present but quiet.
 *
 * Works in LOCAL DAYS. `toDay` and `fromDay` convert to the "YYYY-MM-DD" a form holds, so a picked day
 * is never moved by a timezone on its way into a string.
 */
export function Calendar({
  value,
  onPick,
}: {
  /** "YYYY-MM-DD", or empty for none. */
  value: string;
  onPick: (day: string) => void;
}) {
  const selected = fromDay(value);
  return (
    <DayPicker
      mode="single"
      selected={selected}
      defaultMonth={selected}
      onSelect={(date) => {
        if (date) onPick(toDay(date));
      }}
      showOutsideDays
      autoFocus
      components={{
        Chevron: ({ orientation }) => <Icon name={orientation === "left" ? "chevronLeft" : "chevronRight"} weight="medium" className="size-4" />,
      }}
      classNames={{
        root: "relative w-fit select-none",
        months: "flex",
        month: "flex flex-col gap-1",
        month_caption: "flex h-9 items-center pl-3",
        caption_label: "text-headline text-label",
        nav: "absolute top-0 right-0 flex h-9 items-center",
        button_previous: "flex size-9 cursor-pointer items-center justify-center rounded-full text-tint-text transition-opacity active:opacity-60 disabled:opacity-30",
        button_next: "flex size-9 cursor-pointer items-center justify-center rounded-full text-tint-text transition-opacity active:opacity-60 disabled:opacity-30",
        month_grid: "border-collapse",
        weekdays: "flex",
        weekday: "flex size-9 items-center justify-center text-footnote font-medium text-label-secondary",
        week: "flex",
        day: "size-9 p-0 text-center",
        day_button:
          "flex size-9 cursor-pointer items-center justify-center rounded-full text-callout text-label tabular-nums outline-none transition-colors duration-100 focus-visible:bg-fill active:bg-fill",
        // The chosen day is filled; today is the accent in words, unless it is also the chosen one.
        selected: "[&>button]:bg-tint [&>button]:font-medium [&>button]:text-tint-contrast",
        today: "[&:not([data-selected=true])>button]:text-tint-text [&>button]:font-medium",
        outside: "[&:not([data-selected=true])>button]:text-label-tertiary",
        disabled: "[&>button]:pointer-events-none [&>button]:opacity-30",
        hidden: "invisible",
      }}
    />
  );
}

/** A local calendar day as "YYYY-MM-DD". */
export function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" (or a longer ISO string starting with one) as that local day. */
export function fromDay(day: string | null | undefined): Date | undefined {
  const match = day?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
