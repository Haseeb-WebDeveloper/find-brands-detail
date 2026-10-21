"use client";

import Link from "next/link";
import { useState } from "react";
import { Segmented } from "@/design/segmented";
import { cn } from "@/design/cn";
import type { BrandRow } from "@/lib/batches/scoped";
import { REVIEW_FIELDS, type ReviewField } from "@/lib/export/row";

type Filter = "all" | "todo" | "done";

const DOT = { proven: "bg-system-green", review: "bg-system-orange", rejected: "bg-system-red" } as const;
const SHORT: Record<ReviewField, string> = { website: "Site", instagram: "IG", tiktok: "TT", logo: "Logo", cover: "Cover" };
const WORD = { proven: "proven", review: "needs a look", rejected: "rejected" } as const;

const done = (b: BrandRow) => b.status === "approved" || b.status === "exported";
const waiting = (b: BrandRow) => b.status === "queued" || b.status === "researching";

function Status({ b }: { b: BrandRow }) {
  if (b.error) return <span className="text-subhead text-system-red">Stopped</span>;
  if (waiting(b)) return <span className="text-subhead text-label-tertiary">{b.status === "queued" ? "Waiting" : "Researching"}</span>;
  if (b.status === "exported") return <span className="text-subhead text-label-secondary">Exported</span>;
  if (done(b)) return <span className="text-subhead text-system-green">✓ Reviewed</span>;
  return <span className="text-subhead text-tint-text">Review →</span>;
}

/** The batch at a glance: a dot per fact (green, orange, red, empty) and where each brand is. A row opens the brand. */
export function BatchTable({ brands }: { brands: BrandRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const todo = brands.filter((b) => !done(b) && !waiting(b));
  const reviewed = brands.filter(done);
  const rows = filter === "todo" ? todo : filter === "done" ? reviewed : brands;
  const grid = "grid grid-cols-[minmax(8rem,1fr)_repeat(5,3.25rem)_4.5rem_7rem] items-center gap-x-2";
  return (
    <section className="flex flex-col gap-3">
      <Segmented
        label="Show"
        value={filter}
        onValueChange={setFilter}
        options={[
          { value: "all", label: "All", count: brands.length },
          { value: "todo", label: "To review", count: todo.length },
          { value: "done", label: "Reviewed", count: reviewed.length },
        ]}
      />
      <div className="overflow-x-auto rounded-card bg-surface">
        <div className="min-w-[38rem]">
          <div className={cn(grid, "border-b border-separator px-4 py-2 text-footnote text-label-secondary")}>
            <span>Brand</span>
            {REVIEW_FIELDS.map((f) => (
              <span key={f} className="text-center">
                {SHORT[f]}
              </span>
            ))}
            <span className="text-center">Camp.</span>
            <span />
          </div>
          {rows.map((b) => (
            <Link key={b.id} href={`/brands/${b.id}`} className={cn(grid, "border-b border-separator px-4 py-3 transition-colors last:border-b-0 hover:bg-fill/50")}>
              <span className="truncate text-body text-label">{b.name}</span>
              {REVIEW_FIELDS.map((f) => {
                const s = b.fields[f];
                return (
                  <span key={f} className="flex justify-center" title={`${f}: ${s ? WORD[s] : "empty"}`}>
                    <span className={cn("size-2.5 rounded-full", waiting(b) ? "bg-fill" : s ? DOT[s] : "border border-label-tertiary")} />
                  </span>
                );
              })}
              <span className={cn("text-center text-subhead tabular-nums", b.campaigns.total < 3 ? "text-system-orange" : "text-label-secondary")}>
                {waiting(b) ? "" : b.campaigns.total}
              </span>
              <span className="text-right">
                <Status b={b} />
              </span>
            </Link>
          ))}
          {rows.length === 0 ? <p className="px-4 py-6 text-center text-callout text-label-secondary">Nothing here.</p> : null}
        </div>
      </div>
    </section>
  );
}
