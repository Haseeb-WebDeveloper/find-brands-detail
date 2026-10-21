import type { ReactNode } from "react";
import { COLUMN } from "@/components/app/app-shell";

/**
 * A page: the design language's type, transparent over the window's wash. It does not scroll on its
 * own; the window does (app-shell.tsx).
 */
export function AppPage({ children }: { children: ReactNode }) {
  return (
    <div data-design-page className="design-surface pb-16">
      <div className={COLUMN}>{children}</div>
    </div>
  );
}
