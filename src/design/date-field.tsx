"use client";

import { useId, useState } from "react";
import { Button } from "./button";
import { Calendar, fromDay, toDay } from "./calendar";
import { cn } from "./cn";
import { Icon } from "./icon";
import { Popover } from "./popover";

/**
 * A DATE IN A FORM: the text field's well and label, the day written out in words ("14 Oct 2026"),
 * opening our calendar. Picking a day sets it and closes the calendar. Today and Clear underneath,
 * because most dates somebody sets are within a week of now, and a date you can set but not unset is
 * a trap.
 *
 * Holds "YYYY-MM-DD", or "" for none. The words are en-GB's order ("14 Oct 2026"), which reads the
 * same way to a British and an American roofer and is never ambiguous the way 10/11 is.
 */
export function DateField({
  label,
  value,
  onChange,
  placeholder = "Not set",
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (day: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const pick = (day: string) => {
    setOpen(false);
    onChange(day);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span id={id} className="text-subhead text-label-secondary">
        {label}
      </span>
      <Popover
        align="start"
        fit
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button
            type="button"
            aria-labelledby={id}
            disabled={disabled}
            className={cn(
              "flex h-(--ds-control-md) w-full items-center gap-2 rounded-field border border-transparent bg-fill px-3 text-left text-body",
              "transition-[border-color,background-color,opacity] duration-150 ease-out active:opacity-70",
              "focus-visible:border-tint focus-visible:outline-none data-popup-open:border-tint disabled:opacity-40",
              value ? "text-label" : "text-label-secondary",
            )}
          >
            <span className="min-w-0 flex-1 truncate tabular-nums">{value ? sayDay(value) : placeholder}</span>
            <Icon name="calendar" className="size-4 shrink-0 text-label-secondary" />
          </button>
        }
      >
        <DayPicker value={value} onPick={pick} />
      </Popover>
    </div>
  );
}

/** The calendar with Today and Clear under it: the body of every date popover. */
export function DayPicker({ value, onPick }: { value: string; onPick: (day: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <Calendar value={value} onPick={onPick} />
      {/* The rule runs the popover's full width; the words line up with the calendar's edges. */}
      <div className="-mx-2 flex items-center justify-between border-t border-separator px-0.5 pt-1">
        <Button kind="plain" size="sm" onClick={() => onPick(toDay(new Date()))}>
          Today
        </Button>
        {value ? (
          <Button kind="plain" size="sm" destructive onClick={() => onPick("")}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** "2026-10-14" as "14 Oct 2026". */
export function sayDay(day: string): string {
  const date = fromDay(day);
  return date ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : day;
}
