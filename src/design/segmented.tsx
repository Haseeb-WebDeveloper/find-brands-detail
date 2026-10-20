"use client";

import { motion, useMotionValue, useTransform, useVelocity, animate } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./icon";
import { motionPresets } from "./motion";

/**
 * THE SEGMENTED CONTROL: two to five choices of one value, side by side.
 *
 * The marker is a solid chip lifted off the track, NOT glass: it sits inside the control, and glass
 * belongs to the floating layer. It glides to the chosen option on a spring and stretches in the
 * direction it is travelling, thinning as it goes, then settles round: the faster the move, the more
 * it stretches. That comes from the marker's real speed (`useVelocity`), so a short hop barely
 * deforms and a jump across five options visibly pulls.
 *
 * `floating`: the control sits over content (a toolbar above a list), so its TRACK is glass and the
 * list blurs beneath it. Without it, words scrolling under the bar show straight through.
 *
 * THE MARKER CHANGES WITH THE TRACK, because what matters is the difference between them. On the
 * grey track a white chip stands out. On light glass a white chip is white on white and the chosen
 * option disappears (owner, 2026-10-13), so on glass the marker is a grey fill instead, like the
 * selected tab in an iOS 26 floating bar.
 *
 * It is a radio group to a screen reader, and the arrow keys move the choice.
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  floating = false,
  className,
}: {
  value: T;
  onValueChange: (next: T) => void;
  /** `count`: how many are behind the option, set quieter after its name, without brackets. */
  options: readonly { value: T; label: string; icon?: IconName; count?: number }[];
  label: string;
  floating?: boolean;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<T, HTMLButtonElement>());
  const x = useMotionValue(0);
  const width = useMotionValue(0);
  const first = useRef(true);

  const speed = useVelocity(x);
  const scaleX = useTransform(speed, [-2400, 0, 2400], [1.22, 1, 1.22]);
  const scaleY = useTransform(speed, [-2400, 0, 2400], [0.86, 1, 0.86]);

  useLayoutEffect(() => {
    const node = items.current.get(value);
    if (!node) return;
    const nextX = node.offsetLeft;
    const nextW = node.offsetWidth;
    if (first.current) {
      x.set(nextX);
      width.set(nextW);
      first.current = false;
      return;
    }
    animate(x, nextX, motionPresets.stretch);
    animate(width, nextW, motionPresets.stretch);
  }, [value, x, width]);

  const index = options.findIndex((o) => o.value === value);

  return (
    <div
      ref={track}
      role="radiogroup"
      aria-label={label}
      data-glass={floating ? "regular" : undefined}
      className={cn(
        // `w-fit`: it is as wide as its options, also inside a column that stretches its children.
        "relative inline-flex h-(--ds-control-md) w-fit items-center rounded-full p-0.5",
        !floating && "bg-fill",
        className,
      )}
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = options[(index + step + options.length) % options.length];
        onValueChange(next.value);
        items.current.get(next.value)?.focus();
      }}
    >
      <motion.span
        aria-hidden
        className={cn(
          "absolute top-0.5 left-0 h-[calc(var(--ds-control-md)-4px)] rounded-full",
          floating ? "bg-fill-strong" : "bg-chip shadow-(--ds-chip-lift)",
          // A value none of the options holds (a filter set elsewhere): nothing is marked.
          index < 0 && "opacity-0",
        )}
        style={{ x, width, scaleX, scaleY }}
      />
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(node) => {
              if (node) items.current.set(o.value, node);
              else items.current.delete(o.value);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(o.value)}
            className={cn(
              // `whitespace-nowrap`: a choice never breaks onto two lines; a row too wide for a phone scrolls.
              "relative z-10 inline-flex h-[calc(var(--ds-control-md)-4px)] cursor-pointer items-center justify-center gap-2 rounded-full px-3 whitespace-nowrap",
              // 13px regular, the chosen one medium: the first version set every option in 12px
              // medium, which read as bold and small, worst in dark (owner, 2026-10-13).
              "text-callout transition-colors duration-150",
              selected ? "font-medium text-label" : "text-label-secondary",
            )}
          >
            {o.icon ? <Icon name={o.icon} /> : null}
            {o.label}
            {o.count !== undefined ? <span className="text-label-secondary tabular-nums">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
