"use client";

import { useId, type ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";
import { Menu, type MenuAction } from "./menu";

/**
 * A FIELD THAT HOLDS ONE OF A SET (a stage, who a job goes to): the text field's well and label, with
 * the current choice in it, opening a menu of the others. The current one rests in the menu's lit
 * capsule (`checked`), so the menu opens showing where you are.
 *
 * It always holds a value. A choice that can be "nothing" says so in words ("No one"), so the well
 * is never blank and never needs a placeholder.
 */
export function PickerField({
  label,
  value,
  lead,
  groups,
  disabled,
  className,
}: {
  label: string;
  /** The current choice, in words. */
  value: string;
  /** Drawn before it, such as a stage's colour dot. */
  lead?: ReactNode;
  groups: MenuAction[][];
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span id={id} className="text-subhead text-label-secondary">
        {label}
      </span>
      <Menu
        groups={groups}
        trigger={
          <button
            type="button"
            aria-labelledby={id}
            disabled={disabled}
            className={cn(
              "flex h-(--ds-control-md) w-full items-center gap-2 rounded-field border border-transparent bg-fill px-3 text-left text-body text-label",
              "transition-[border-color,background-color,opacity] duration-150 ease-out active:opacity-70",
              "focus-visible:border-tint focus-visible:outline-none data-popup-open:border-tint disabled:opacity-40",
            )}
          >
            {lead}
            <span className="min-w-0 flex-1 truncate">{value}</span>
            <Icon name="chevronExpand" className="size-4 shrink-0 text-label-secondary" />
          </button>
        }
      />
    </div>
  );
}
