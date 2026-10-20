"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/design/cn";
import { Icon } from "@/design/icon";

/**
 * The text field of the signed-out screens: email, password, the business details.
 *
 * Built the way `TextField` (src/design) is, a filled well with a 1px border for focus and for an
 * error and never a ring, but sized for a form that is the whole screen (owner, 2026-10-14):
 *
 *   - as tall as the large button under it, not the office's dense 32px;
 *   - the label one step up from the office's, so it is read rather than squinted at;
 *   - the error at reading size, lined up with the field's edge (not indented), with a warning mark
 *     so it is seen before it is read.
 *
 * `reveal` adds the eye that shows a password. `labelEnd` is the slot on the label's line, for
 * "Forgot password?": next to the field it is about.
 *
 * The forms using it set `noValidate` and check on submit themselves, so the browser's own grey
 * bubble never appears; our message under the field is the only one.
 */
export function AuthField({
  label,
  labelEnd,
  lead,
  below,
  error,
  reveal = false,
  type = "text",
  ...input
}: {
  label: string;
  labelEnd?: ReactNode;
  /** Drawn inside the box before the text: a platform's logo, so the box says what it is for. */
  lead?: ReactNode;
  /** A line under the field, only where it prevents a real mistake: the address being made from a
   *  business name, which is permanent. Not help text. Hidden while there is an error. */
  below?: ReactNode;
  error?: string;
  reveal?: boolean;
} & Omit<ComponentProps<"input">, "className">) {
  const id = useId();
  const errorId = `${id}-error`;
  const [shown, setShown] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-callout text-(--auth-muted)">
          {label}
        </label>
        {labelEnd}
      </div>
      <div className="relative">
        {lead ? (
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 grid size-5 -translate-y-1/2 place-items-center">
            {lead}
          </span>
        ) : null}
        <input
          id={id}
          type={reveal && shown ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-(--ds-control-lg) w-full rounded-field border border-transparent bg-fill px-3 text-body text-label",
            "placeholder:text-label-secondary",
            "transition-[border-color,background-color] duration-150 ease-out",
            "focus:border-tint focus:bg-surface focus-visible:outline-none",
            "aria-invalid:border-system-red",
            reveal && "pr-12",
            lead && "pl-10",
          )}
          {...input}
        />
        {reveal ? (
          // A real button, so it is reachable by keyboard and read aloud as what it does. It does not
          // submit, and pressing it keeps what was typed.
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            disabled={input.disabled}
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            className="absolute top-1/2 right-1 grid size-(--ds-control-md) -translate-y-1/2 cursor-pointer place-items-center rounded-full text-(--auth-muted) transition-colors hover:bg-fill hover:text-label disabled:pointer-events-none"
          >
            <Icon name={shown ? "eyeOff" : "eye"} />
          </button>
        ) : null}
      </div>
      {below && !error ? <p className="text-callout text-(--auth-muted)">{below}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-callout text-danger-text">
          <Icon name="warning" className="mt-[0.15em] size-[1.1em] shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The checks the browser would have made, in our words. Pure, so the sign-in and sign-up forms
 * answer an empty or half-typed address identically.
 */
export function emailProblem(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Enter your email address.";
  // Deliberately loose: something@something.something. The server and the email itself are the
  // real check; this only catches the half-typed address before a round trip.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v)) {
    return "Enter a full email address, like name@company.com.";
  }
  return undefined;
}
