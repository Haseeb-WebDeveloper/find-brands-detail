"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useCallback, useRef, type ComponentProps, type ReactNode, type Ref } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./icon";
import { motionPresets, PRESS_SCALE } from "./motion";
import { useGlass } from "./use-glass";

/**
 * THE BUTTON. Every control in the language that you press is this, or is built like it.
 *
 * **A button in the content is SOLID; only a floating button is glass.** That is Apple's rule and the
 * one this file first got wrong: glass buttons sitting on a white card read as puffy glowing blobs,
 * because glass needs something behind it to be glass about. So:
 *
 *   filled           the ONE main action on a screen: solid accent, white words
 *   gray             everything else in the content: a quiet grey fill
 *   plain            words in the accent with a thin border and no fill: Cancel, an action that must
 *                    not compete. NEVER BARE: no button in the office is only words (owner,
 *                    2026-10-17), because a word with nothing round it does not read as pressable.
 *   glass            floating over the page or a photo (a toolbar, the top of a screen)
 *   glassProminent   the main action when IT floats: the accent as glass
 *
 * - **A capsule.** An icon-only button is a circle.
 * - **No hover effect.** It answers on touch-down instead: it squashes and dims the instant a finger
 *   or click lands (`whileTap` fires on pointer-down), and settles back with a slight liquid wobble.
 * - **Medium weight, not semibold.** A row of buttons in semibold shouts; the fill already says
 *   "press me".
 * - **The tap area is 44px whatever the size.**
 */

type Kind = "filled" | "gray" | "plain" | "glass" | "glassProminent";
type Size = "sm" | "md" | "lg";

/* Heights come from the pointer (tokens.css): 32 / 36 / 44 with a mouse, 36 / 44 / 52 under a finger. */
/*
 * WITH AN ICON, A BUTTON TAKES 4PX LESS ON BOTH SIDES. An icon and a word together already make a
 * wide button, and the plain padding on top of that read as too much air (owner, 2026-10-13).
 * Measured to the INK, not the box: a medium "Call" sits 12.7px from icon to edge and 12px from word
 * to edge, so the two sides stay even. Trimming only the icon side was tried first and left the
 * word side 3px wider.
 */
const SIZE: Record<Size, { box: string; withIcon: string; icon: string; text: string }> = {
  sm: { box: "h-(--ds-control-sm) px-3 gap-2", withIcon: "px-3", icon: "size-(--ds-control-sm)", text: "text-subhead" },
  md: { box: "h-(--ds-control-md) px-4 gap-2", withIcon: "px-3", icon: "size-(--ds-control-md)", text: "text-callout" },
  lg: { box: "h-(--ds-control-lg) px-5 gap-2", withIcon: "px-4", icon: "size-(--ds-control-lg)", text: "text-body" },
};

const KIND: Record<Kind, string> = {
  // Light falls on it from above: two stops a few percent apart, plus a lit top edge. Enough to be a
  // button rather than a swatch; a gradient you can SEE is a 2012 button.
  filled:
    "bg-tint text-tint-contrast bg-linear-to-b from-[color-mix(in_oklab,var(--ds-tint)_88%,white)] to-tint shadow-(--ds-button-rim)",
  gray: "bg-fill text-label",
  plain: "border border-separator text-tint-text",
  glass: "text-label",
  glassProminent: "",
};

type Common = {
  kind?: Kind;
  size?: Size;
  /** Red, for the action that removes something. It changes the accent, not the shape. */
  destructive?: boolean;
  icon?: IconName;
  /** An icon-only button. The label is still required: it is what a screen reader says. */
  iconOnly?: boolean;
  children: ReactNode;
  className?: string;
  /** Passed through, so a menu or popover can anchor to the button that opens it. */
  ref?: Ref<HTMLElement>;
};

const MotionLink = motion.create(Link);

export function Button(
  props: Common &
    (
      | ({ href?: undefined } & Omit<ComponentProps<typeof motion.button>, "children" | "ref">)
      | ({ href: string } & Omit<ComponentProps<typeof MotionLink>, "children" | "ref" | "href">)
    ),
) {
  const {
    kind = "gray",
    size = "md",
    destructive = false,
    icon,
    iconOnly = false,
    children,
    className,
    ref: outer,
    ...rest
  } = props;
  const ref = useRef<HTMLElement>(null);
  const setRef = useCallback(
    (node: HTMLElement | null) => {
      ref.current = node;
      if (typeof outer === "function") outer(node);
      else if (outer) outer.current = node;
    },
    [outer],
  );
  const glass = kind === "glass" || kind === "glassProminent";
  useGlass(ref, "thin");

  const s = SIZE[size];
  const classes = cn(
    "relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium whitespace-nowrap",
    "cursor-pointer transition-opacity duration-100 active:opacity-70",
    "disabled:pointer-events-none disabled:opacity-40",
    s.text,
    iconOnly ? cn(s.icon, "p-0") : cn(s.box, icon && s.withIcon),
    KIND[kind],
    destructive && "[--ds-tint:var(--ds-danger-fill)] [--ds-tint-text:var(--ds-danger-text)]",
    destructive && (kind === "gray" || kind === "glass") && "text-tint-text",
    className,
  );

  const inner = (
    <>
      {/* The 44px tap area, for the sizes that look smaller than a thumb. */}
      <span aria-hidden className="absolute top-1/2 left-1/2 size-full min-h-11 min-w-11 -translate-1/2" />
      {/* 1.125em, a touch under the language's 1.25em: beside a word in a capsule the larger
          glyph out-weighed the label it introduces. */}
      {icon ? <Icon name={icon} className={iconOnly ? undefined : "size-[1.125em]"} /> : null}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </>
  );

  const motionProps = {
    "data-glass": glass ? "thin" : undefined,
    "data-glass-kind": kind === "glassProminent" ? "tinted" : undefined,
    whileTap: { scale: PRESS_SCALE, transition: motionPresets.press },
    transition: motionPresets.release,
    className: classes,
  };

  if (rest.href !== undefined) {
    return (
      <MotionLink
        ref={setRef}
        {...(rest as Omit<ComponentProps<typeof MotionLink>, "ref">)}
        {...motionProps}
      >
        {inner}
      </MotionLink>
    );
  }
  return (
    <motion.button
      ref={setRef}
      type="button"
      {...(rest as Omit<ComponentProps<typeof motion.button>, "ref">)}
      {...motionProps}
    >
      {inner}
    </motion.button>
  );
}
