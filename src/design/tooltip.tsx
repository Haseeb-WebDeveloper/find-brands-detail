"use client";

import { Tooltip as Base } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";
import { usePortalLayer } from "./root";

/**
 * THE TOOLTIP: a short explanation that appears on hover or keyboard focus, for something whose
 * meaning is not obvious from its label (an icon-only button, a "Sample" tag, an unfamiliar term).
 * Added 2026-10-17; the owner wants them used wherever a word or a mark needs one.
 *
 * - **Never the only place something important is said.** A phone has no hover, so anything a
 *   person must know to use the screen is written on it; a tooltip only adds.
 * - **One sentence**, in the panel surface menus and popovers use, above the thing by default.
 * - It waits a moment before appearing, so moving the pointer across a screen does not flash them.
 *
 * `children` is the element it explains, which must be able to take focus (a button, a link, or
 * something with `tabIndex`).
 */
export function Tooltip({ content, side = "top", children }: { content: ReactNode; side?: "top" | "bottom" | "left" | "right"; children: ReactElement }) {
  const layer = usePortalLayer();
  return (
    <Base.Root>
      <Base.Trigger delay={300} render={children} />
      <Base.Portal container={layer}>
        <Base.Positioner side={side} sideOffset={6} collisionPadding={12} className="z-50">
          <Base.Popup data-panel className="max-w-64 rounded-field px-2.5 py-1.5 text-subhead text-label outline-none">
            {content}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
