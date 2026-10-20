"use client";

import Link from "next/link";
import { DataTable, type TableColumn } from "@/design/table";
import { Pill } from "@/design/list";
import { sayAgo } from "@/design/ago";
import type { BatchListItem } from "@/lib/batches/scoped";

/**
 * A client component because `DataTable` is one and takes functions (`rowKey`, each column's
 * `cell`), which cannot cross from a Server Component. The server passes plain rows; the columns
 * live here, as contractor-sites' list screens do.
 */
const COLUMNS: TableColumn<BatchListItem>[] = [
  { key: "created", label: "Started", width: 180, cell: (b) => <Link href={`/batches/${b.id}`}>{sayAgo(b.createdAt)}</Link> },
  { key: "by", label: "By", width: 220, grow: true, cell: (b) => b.createdBy ?? "—" },
  { key: "brands", label: "Brands", width: 100, align: "end", cell: (b) => b.brandCount },
  {
    key: "review",
    label: "Needs review",
    width: 140,
    align: "end",
    cell: (b) => (b.needsReview > 0 ? <Pill tone="orange">{b.needsReview}</Pill> : "—"),
  },
];

export function BatchTable({ rows }: { rows: BatchListItem[] }) {
  return <DataTable label="Batches" rows={rows} rowKey={(b) => b.id} columns={COLUMNS} />;
}
