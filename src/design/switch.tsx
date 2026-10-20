"use client";

import { motion, useMotionValue, animate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";
import { motionPresets } from "./motion";
import { useCoarsePointer } from "./use-media";

/**
 * THE SWITCH. iPhone's 52 x 32 under a finger, 40 x 24 with a mouse, and the one control whose
 * knob turns to glass.
 *
 * Touch it and the knob swells into a clear glass lozenge you can see the track through; drag it and
 * it follows the finger 1:1, resisting past either end; let go and it lands on the side it was
 * thrown toward, judged by where it was HEADING (position plus a projection of its speed), not only
 * where it was let go. A plain tap just flips it.
 *
 * It commits on change: there is no Save button anywhere in this language.
 */

const INSET = 2;
/** Track width, track height, knob, and how wide the knob swells while held. */
const GEOMETRY = {
  touch: { w: 52, h: 32, knob: 28, held: 36 },
  mouse: { w: 40, h: 24, knob: 20, held: 26 },
} as const;

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** What it switches. Read by screen readers; the visible label is the row it sits in. */
  label: string;
  disabled?: boolean;
}) {
  const g = GEOMETRY[useCoarsePointer() ? "touch" : "mouse"];
  const travel = g.w - g.knob - INSET * 2;
  const [held, setHeld] = useState(false);
  const x = useMotionValue(checked ? travel : 0);
  const dragged = useRef(false);

  // Held, the knob is wider, so the far end of its travel moves in by the difference.
  const end = held ? travel - (g.held - g.knob) : travel;

  useEffect(() => {
    animate(x, checked ? end : 0, motionPresets.stretch);
  }, [checked, end, x]);

  // Let go anywhere, not only over the knob: a finger usually leaves it while dragging.
  useEffect(() => {
    if (!held) return;
    const up = () => setHeld(false);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [held]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (dragged.current) return;
        onCheckedChange(!checked);
      }}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full",
        "transition-[background-color] duration-300 ease-out",
        "disabled:pointer-events-none disabled:opacity-40",
        checked ? "bg-tint" : "bg-fill-strong",
      )}
      style={{ width: g.w, height: g.h }}
    >
      {/* the 44px tap area */}
      <span aria-hidden className="absolute -inset-2" />
      <motion.span
        aria-hidden
        data-glass={held ? "thin" : undefined}
        data-glass-kind={held ? "clear" : undefined}
        className={cn(
          "absolute top-0.5 left-0.5 block rounded-full",
          !held && "bg-knob shadow-(--ds-knob-shadow)",
        )}
        style={{ x, height: g.knob }}
        animate={{ width: held ? g.held : g.knob, scaleY: held ? 1.1 : 1 }}
        transition={motionPresets.stretch}
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: end }}
        dragElastic={0.12}
        dragMomentum={false}
        onPointerDown={() => {
          dragged.current = false;
          setHeld(true);
        }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={(_, info) => {
          setHeld(false);
          // Where the throw was heading, not where it was let go: Apple's momentum projection, at
          // the snappier deceleration (0.99) because the travel is only 20px.
          const projected = x.get() + ((info.velocity.x / 1000) * 0.99) / (1 - 0.99);
          const next = projected > travel / 2;
          if (next !== checked) onCheckedChange(next);
          else animate(x, checked ? travel : 0, motionPresets.stretch);
          // The click that follows a drag must not flip it back.
          setTimeout(() => {
            dragged.current = false;
          }, 0);
        }}
      />
    </button>
  );
}
