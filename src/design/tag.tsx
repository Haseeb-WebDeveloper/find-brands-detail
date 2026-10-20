"use client";

import type { ReactNode } from "react";
import { Tooltip } from "./tooltip";

/**
 * A SMALL GREY TAG WHOSE EXPLANATION IS A HOVER AWAY (2026-10-17): "Comes with your Page", "Not
 * guaranteed". The words stay off the page until somebody wants them, which is how a screen keeps to
 * headings and rows (owner: cut every line that is not needed). Focusable, so a keyboard reaches the
 * tooltip too. Never the only place something must-know is said: a phone has no hover.
 */
export function Tag({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <Tooltip content={tip}>
      <span tabIndex={0} className="cursor-default rounded-full bg-fill px-2 py-0.5 text-footnote text-label">
        {children}
      </span>
    </Tooltip>
  );
}
