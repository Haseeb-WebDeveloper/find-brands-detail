import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * The line at the top of a tab: what is in it, in a few words, and the one thing to add to it. Shown
 * once a tab has something in it; an empty tab offers the same button in its middle instead.
 */
export function TabBar({ summary, action }: { summary?: ReactNode; action?: ReactNode }) {
  if (!summary && !action) return null;
  return (
    <div className="flex min-h-10 items-center justify-between gap-3">
      <span className="min-w-0 truncate text-callout text-label-secondary">{summary}</span>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * ONE PART OF A TAB that holds several (Money: invoices and payments, extra work, insurance): its
 * name, a few words, its buttons, then its table. **Lists are tables, like Tasks** (owner,
 * 2026-10-14): free blocks of text between full-width lines looked messy beside the Tasks table, so
 * every list on the job page is a table with a header row and one line per thing.
 */
export function Section({
  title,
  summary,
  action,
  children,
  className,
}: {
  title: string;
  summary?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-baseline gap-3">
          <h3 className="text-headline text-label">{title}</h3>
          {summary ? <span className="min-w-0 truncate text-callout text-label-secondary">{summary}</span> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
