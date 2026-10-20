"use client";

import { useId, type ComponentProps } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./icon";

/**
 * THE TEXT FIELD. A rounded rectangle as tall as a medium button, filled rather than outlined: a
 * field is a well you type into, and on a white card and a grey canvas alike the alpha fill reads
 * the same.
 *
 * **States are a 1px border, never a ring** (owner, 2026-10-13). Focus: the border turns the accent
 * and the well turns white. Wrong: the border turns red. A glow round a field is heavier than the
 * words in it.
 *
 * - The label sits ABOVE, in words, and is never the placeholder: a placeholder disappears the moment
 *   somebody starts typing, taking the question with it.
 * - **No help text under it.** If a field needs explaining, its label is wrong. The only line that may
 *   appear under a field is what went wrong, in red, in plain words.
 * - 17px on a phone, which is also what stops iPhone zooming the page when the field is tapped.
 * - **A number field takes only a number** (owner, 2026-10-14: an amount box took "1500 asd"). With
 *   `inputMode="decimal"` it keeps digits and one decimal point, and a leading minus with
 *   `allowNegative`; with `"numeric"` digits only. Cleaned as it is typed, so nothing else can reach it.
 */
export function cleanNumber(value: string, options: { negative?: boolean; decimals?: boolean } = {}): string {
  const { negative = false, decimals = true } = options;
  let out = value.replace(negative ? /[^\d.-]/g : /[^\d.]/g, "");
  if (negative) out = (out.startsWith("-") ? "-" : "") + out.replace(/-/g, "");
  if (!decimals) return out.replace(/\./g, "");
  const dot = out.indexOf(".");
  return dot < 0 ? out : out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, "");
}

export function TextField({
  label,
  hideLabel = false,
  icon,
  error,
  className,
  allowNegative = false,
  ...input
}: {
  label: string;
  /** For a search box, whose icon and placeholder already say what it is. Still read aloud. */
  hideLabel?: boolean;
  icon?: IconName;
  error?: string;
  className?: string;
  /** A credit: a number field that may start with a minus. */
  allowNegative?: boolean;
} & Omit<ComponentProps<"input">, "className">) {
  const numeric = input.inputMode === "decimal" || input.inputMode === "numeric";
  const clean = (event: { currentTarget: HTMLInputElement }) => {
    const next = cleanNumber(event.currentTarget.value, { negative: allowNegative, decimals: input.inputMode === "decimal" });
    if (next !== event.currentTarget.value) event.currentTarget.value = next;
  };
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className={cn("text-subhead text-label-secondary", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-label-secondary">
            <Icon name={icon} />
          </span>
        ) : null}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-(--ds-control-md) w-full rounded-field border border-transparent bg-fill px-3 text-body text-label",
            "placeholder:text-label-secondary",
            "transition-[border-color,background-color] duration-150 ease-out",
            "focus:border-tint focus:bg-surface focus-visible:outline-none",
            "aria-invalid:border-system-red",
            icon && "pl-10",
          )}
          {...input}
          onChange={
            numeric
              ? (event) => {
                  clean(event);
                  input.onChange?.(event);
                }
              : input.onChange
          }
        />
      </div>
      {error ? (
        <p id={errorId} className="px-3 text-footnote text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
