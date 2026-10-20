import type { ReactNode } from "react";
import { DesignPage } from "@/design/page";
import { COLUMN } from "@/components/app/app-shell";

/** A page: the design language's page (its type, its scroll), transparent over the window's wash. */
export function AppPage({ children }: { children: ReactNode }) {
  return (
    <DesignPage className="bg-transparent">
      <div className={COLUMN}>{children}</div>
    </DesignPage>
  );
}
