"use client";

import { cn } from "./cn";
import { Icon } from "./icon";

/**
 * THE CHECKBOX: picking rows to act on together. Not a setting (that is a `Switch`).
 *
 * An 18px rounded square: a hairline ring when empty, the accent filled with a white tick when on, a
 * dash when some but not all of a set are on (the header of a table). The tap area is 32px however
 * small the box looks.
 */
export function Checkbox({
  checked,
  indeterminate = false,
  onCheckedChange,
  label,
  disabled = false,
  className,
}: {
  checked: boolean;
  /** Some of a set, for a header box. Pressing it selects all. */
  indeterminate?: boolean;
  onCheckedChange: (next: boolean) => void;
  /** What it picks. Read by screen readers. */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        // A checkbox inside a row that is itself a link must not open the row.
        event.stopPropagation();
        onCheckedChange(indeterminate ? true : !checked);
      }}
      className={cn(
        "relative grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-[5px]",
        "transition-[background-color,box-shadow] duration-100 disabled:pointer-events-none disabled:opacity-40",
        on ? "bg-tint text-tint-contrast" : "shadow-[inset_0_0_0_1.5px_var(--ds-label-tertiary)]",
        className,
      )}
    >
      <span aria-hidden className="absolute -inset-[7px]" />
      {indeterminate ? (
        <span aria-hidden className="h-0.5 w-2.5 rounded-full bg-current" />
      ) : checked ? (
        <Icon name="check" weight="bold" className="size-3" />
      ) : null}
    </button>
  );
}
