"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cn } from "@/design/cn";
import type { LogLine } from "@/lib/batches/scoped";

const DOT = { info: "bg-label-tertiary", good: "bg-system-green", warn: "bg-system-orange" } as const;

/** Local clock time, after hydration (the server doesn't know the viewer's time zone). */
function useClock() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * What the research is doing, newest first, as it happens: the page re-reads it whenever a line is
 * written (`LiveRefresh`). `showBrand` for a batch, where lines from several brands interleave.
 */
export function ResearchLog({ lines, showBrand = false, live = false }: { lines: LogLine[]; showBrand?: boolean; live?: boolean }) {
  const mounted = useClock();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-title-3 text-label">
        Activity
        {live ? (
          <span className="flex items-center gap-1.5 text-footnote font-normal text-label-secondary">
            <span aria-hidden className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-system-green opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-system-green" />
            </span>
            Live
          </span>
        ) : null}
      </h2>
      <div className="rounded-card bg-surface p-2">
        {lines.length === 0 ? (
          <p className="px-2 py-3 text-callout text-label-secondary">Nothing yet. Lines appear here as the research runs.</p>
        ) : (
          <ol className="flex flex-col">
            {lines.map((l) => (
              <li key={l.id} className="flex items-start gap-3 rounded-lg px-2 py-1.5 text-callout hover:bg-fill/50">
                <time className="w-16 shrink-0 pt-px font-mono text-footnote tabular-nums text-label-secondary" dateTime={l.at}>
                  {mounted ? new Date(l.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
                </time>
                <span aria-hidden className={cn("mt-2 size-1.5 shrink-0 rounded-full", DOT[l.level])} />
                <span className="min-w-0 flex-1 text-label">
                  {showBrand ? (
                    <Link href={`/brands/${l.brandId}`} className="mr-1.5 font-medium underline-offset-2 hover:underline">
                      {l.brandName}
                    </Link>
                  ) : null}
                  <span className={cn(l.level === "warn" && "text-system-orange", l.level === "good" && "text-system-green")}>{l.message}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
