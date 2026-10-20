import type { Transition } from "motion/react";

/**
 * THE ONLY MOTIONS THAT EXIST (docs/DESIGN-LANGUAGE.md 7). A component picks one by name; nobody
 * types a duration.
 *
 * Springs, because a spring starts from wherever the thing actually is and carries its speed into
 * the next target: a menu tapped while closing turns round from where it is, instead of finishing
 * and reopening. `visualDuration` is how long the move LOOKS (Apple's "response"); the tail of the
 * settle runs past it. `bounce` is overshoot: 0 is none.
 *
 * Bounce is earned. It appears where a finger let go of something (`release`, a flicked sheet,
 * a dragged knob), never on something that merely appeared.
 */
export const motionPresets = {
  /** Touch-down. Fast and flat: the control has to be under the finger before the finger notices. */
  press: { type: "spring", visualDuration: 0.12, bounce: 0 },
  /** Let-go. The slight wobble is the liquid. */
  release: { type: "spring", visualDuration: 0.35, bounce: 0.25 },
  /** Menus, popovers, a button growing into what it opens. */
  pop: { type: "spring", visualDuration: 0.32, bounce: 0.18 },
  /** Sheets, side panels, dialogs. No bounce unless a flick carried speed into it. */
  sheet: { type: "spring", visualDuration: 0.4, bounce: 0 },
  /** A sheet after a flick: the throw's speed comes with it. */
  sheetFlick: { type: "spring", visualDuration: 0.4, bounce: 0.15 },
  /** Rows reordering, lists growing, a marker gliding to the selected tab. */
  move: { type: "spring", visualDuration: 0.35, bounce: 0 },
  /** Glass being dragged: a switch knob, a segmented control's droplet. */
  stretch: { type: "spring", visualDuration: 0.3, bounce: 0.2 },
  /** Text swapping in place, and what everything becomes under reduced motion. */
  fade: { type: "tween", duration: 0.15, ease: "easeOut" },
} as const satisfies Record<string, Transition>;

export type MotionPreset = keyof typeof motionPresets;

/** How far a pressed control shrinks. One number, so every press in the product feels the same. */
export const PRESS_SCALE = 0.96;
