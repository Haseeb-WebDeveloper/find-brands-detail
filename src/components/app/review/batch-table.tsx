"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, type TableColumn } from "@/design/table";
import { Segmented } from "@/design/segmented";
import { Pill } from "@/design/list";
import { Button } from "@/design/button";
import { cn } from "@/design/cn";
import type { BrandRow } from "@/lib/batches/scoped";
import { progressText, progressTone } from "@/lib/brands/progress";
import type { ReviewField } from "@/lib/export/row";

type Filter = "all" | "needs" | "approved";

const DOT = { proven: "bg-system-green", review: "bg-system-orange", rejected: "bg-system-red", missing: "bg-system-red" } as const;
const WORD = { proven: "Proven", review: "Needs a look", rejected: "Rejected", missing: "Missing" } as const;

function Cell({ score }: { score: BrandRow["fields"][ReviewField] }) {
  const key = score ?? "missing";
  return (
    <span className="flex items-center gap-1.5" title={WORD[key]}>
      <span aria-hidden className={cn("size-2.5 rounded-full", DOT[key])} />
      <span className="text-subhead text-label-secondary">{WORD[key]}</span>
    </span>
  );
}

const field = (key: ReviewField, label: string): TableColumn<BrandRow> => ({
  key,
  label,
  width: 132,
  cell: (b) => (b.status === "queued" || b.status === "researching" ? <span className="text-footnote text-label-tertiary">—</span> : <Cell score={b.fields[key]} />),
});

const COLUMNS: TableColumn<BrandRow>[] = [
  {
    key: "name",
    label: "Brand",
    width: 200,
    grow: true,
    cell: (b) => (
      <Link href={`/brands/${b.id}`} className="font-medium text-label underline-offset-4 hover:underline">
        {b.name}
      </Link>
    ),
  },
  field("website", "Website"),
  field("instagram", "Instagram"),
  field("tiktok", "TikTok"),
  field("logo", "Logo"),
  field("cover", "Cover"),
  {
    key: "campaigns",
    label: "Campaigns",
    width: 120,
    cell: (b) => (
      <span className={cn("text-subhead tabular-nums", b.campaigns.approved < 3 ? "text-system-orange" : "text-label-secondary")}>
        {b.campaigns.approved}/{b.campaigns.total} approved
      </span>
    ),
  },
  { key: "status", label: "Status", width: 240, cell: (b) => <Pill tone={progressTone(b)}>{progressText(b)}</Pill> },
  {
    key: "open",
    label: "",
    width: 110,
    align: "end",
    cell: (b) => (
      <Button kind={b.status === "needs_review" ? "filled" : "gray"} size="sm" href={`/brands/${b.id}`}>
        {b.status === "needs_review" ? "Review" : "Open"}
      </Button>
    ),
  },
];

/** Spec §8 screen 4: one row per brand, a coloured cell per field, filters for what needs a person. */
export function BatchTable({ brands }: { brands: BrandRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const needs = brands.filter((b) => b.status === "needs_review");
  const approved = brands.filter((b) => b.status === "approved" || b.status === "exported");
  const rows = filter === "needs" ? needs : filter === "approved" ? approved : brands;
  return (
    <section className="flex flex-col gap-3">
      <Segmented
        label="Show"
        value={filter}
        onValueChange={setFilter}
        options={[
          { value: "all", label: "All", count: brands.length },
          { value: "needs", label: "Needs you", count: needs.length },
          { value: "approved", label: "Approved", count: approved.length },
        ]}
      />
      {rows.length === 0 ? (
        <p className="text-callout text-label-secondary">{filter === "needs" ? "Nothing needs you right now." : "No approved brands yet."}</p>
      ) : (
        <DataTable label="Brands" rows={rows} rowKey={(b) => b.id} columns={COLUMNS} />
      )}
    </section>
  );
}
