"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { DataTable, type TableColumn } from "@/design/table";
import { Pill } from "@/design/list";
import { useToast } from "@/design/toast";
import { sayAgo } from "@/design/ago";
import type { ExportableBrand } from "@/lib/export/scoped";
import { exportBrands, type ExportResult } from "@/lib/export/actions";

const COLUMNS: TableColumn<ExportableBrand>[] = [
  {
    key: "name",
    label: "Brand",
    width: 220,
    grow: true,
    cell: (b) => (
      <Link href={`/brands/${b.id}`} className="font-medium text-label underline-offset-4 hover:underline">
        {b.name}
      </Link>
    ),
  },
  { key: "status", label: "Status", width: 120, cell: (b) => <Pill tone="green">{b.status === "approved" ? "Approved" : "Exported"}</Pill> },
  { key: "updated", label: "Last change", width: 140, cell: (b) => <span className="text-footnote text-label-secondary">{sayAgo(b.updatedAt)}</span> },
  {
    key: "batch",
    label: "Batch",
    width: 100,
    cell: (b) => (
      <Link href={`/batches/${b.batchId}`} className="text-footnote text-tint-text underline-offset-4 hover:underline">
        Open
      </Link>
    ),
  },
];

/** Saves the CSV with a byte-order mark, so Excel reads Korean and accented names correctly. */
function download(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Spec §8 screen 6: pick approved brands, check them and their images, download the CSV or see what blocked it. */
export function ExportPanel({ brands, canExport }: { brands: ExportableBrand[]; canExport: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>(brands.filter((b) => b.status === "approved").map((b) => b.id));
  const [report, setReport] = useState<Extract<ExportResult, { ok: false }> | null>(null);
  const [pending, start] = useTransition();

  if (brands.length === 0) {
    return <p className="text-callout text-label-secondary">No approved brands yet. Approve a brand on its page and it appears here.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <DataTable label="Approved brands" rows={brands} rowKey={(b) => b.id} columns={COLUMNS} selection={canExport ? { selected, onChange: setSelected } : undefined} />
      {canExport ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            kind="filled"
            icon="download"
            disabled={pending || selected.length === 0}
            onClick={() =>
              start(async () => {
                setReport(null);
                const r = await exportBrands(selected);
                if (!r.ok) {
                  setReport(r);
                  return toast(r.error);
                }
                download(r.csv, r.filename);
                toast(`Downloaded ${r.count} brand${r.count === 1 ? "" : "s"}.`);
                router.refresh();
              })
            }
          >
            {pending ? `Checking ${selected.length} brand${selected.length === 1 ? "" : "s"} and their images…` : `Check and download (${selected.length})`}
          </Button>
          <p className="text-footnote text-label-secondary">Every image is checked again first: Instagram links expire within days.</p>
        </div>
      ) : null}
      {report && report.report.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
          <p className="text-callout font-medium text-label">{report.error} Nothing was downloaded.</p>
          {report.report.map((b) => (
            <div key={b.id} className="flex flex-col gap-1">
              <Link href={`/brands/${b.id}`} className="text-callout font-medium text-tint-text underline-offset-4 hover:underline">
                {b.name}
              </Link>
              <ul className="flex list-disc flex-col gap-0.5 pl-5 text-callout text-label-secondary">
                {b.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
