"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { Checkbox } from "@/design/checkbox";
import { useToast } from "@/design/toast";
import { cn } from "@/design/cn";
import { batchPick, batchState, exportable, initialSelection, type ExportGroup } from "@/lib/export/groups";
import { exportBrands } from "@/lib/export/actions";

const MARK: Record<string, string> = { approved: "✓ Reviewed", exported: "Exported", needs_review: "", researching: "Researching", queued: "Waiting" };

/** Saves the CSV with a byte-order mark, so Excel reads Korean and accented names correctly. */
function download(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Pick a batch (or some of its brands) and download the CSV. Nothing blocks: empty stays empty. */
export function ExportPanel({ groups, batchId, canExport }: { groups: ExportGroup[]; batchId: string | null; canExport: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelection(groups, batchId)));
  const [notes, setNotes] = useState<string[]>([]);
  const [pending, start] = useTransition();

  if (groups.length === 0) return <p className="rounded-card bg-surface p-5 text-callout text-label-secondary">Nothing to export yet.</p>;
  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="sticky top-[calc(var(--app-bar)+4rem)] z-10 flex items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-sm">
        <span className="text-headline text-label">
          {selected.size} brand{selected.size === 1 ? "" : "s"}
        </span>
        {canExport ? (
          <Button
            kind="filled"
            icon="download"
            disabled={pending || selected.size === 0}
            onClick={() =>
              start(async () => {
                setNotes([]);
                const r = await exportBrands([...selected]);
                if (!r.ok) return toast(r.error);
                download(r.csv, r.filename);
                setNotes(r.notes);
                toast(`Downloaded ${r.count} brand${r.count === 1 ? "" : "s"}.`);
                router.refresh();
              })
            }
          >
            {pending ? "Preparing…" : "Download CSV"}
          </Button>
        ) : null}
      </div>
      {notes.length > 0 ? (
        <details className="rounded-card bg-surface px-4 py-3 text-subhead text-system-orange">
          <summary className="cursor-pointer">
            {notes.length} image{notes.length === 1 ? "" : "s"} didn&apos;t load and {notes.length === 1 ? "was" : "were"} left empty
          </summary>
          <ul className="mt-2 flex flex-col gap-0.5 text-label-secondary">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {groups.map((g) => {
        const state = batchState(g, selected);
        const pick = batchPick(g);
        return (
          <details key={g.id} open={g.id === (batchId ?? groups[0].id)} className="group rounded-card bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              {canExport ? (
                <span onClick={(e) => e.stopPropagation()}>
                  <Checkbox label="The whole batch" checked={state === "all"} indeterminate={state === "some"} disabled={pick.length === 0} onCheckedChange={(on) => toggle(pick, on)} />
                </span>
              ) : null}
              <span className="flex-1 text-headline text-label">Batch of {day(g.createdAt)}</span>
              <span className="text-subhead text-label-secondary">{g.brands.length} brands</span>
              <span aria-hidden className="text-label-secondary transition-transform group-open:rotate-90">›</span>
            </summary>
            <ul className="flex flex-col border-t border-separator">
              {g.brands.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-2">
                  {canExport ? <Checkbox label={b.name} checked={selected.has(b.id)} disabled={!exportable(b)} onCheckedChange={(on) => toggle([b.id], on)} /> : null}
                  <Link href={`/brands/${b.id}`} className={cn("min-w-0 flex-1 truncate text-body underline-offset-4 hover:underline", exportable(b) ? "text-label" : "text-label-tertiary")}>
                    {b.name}
                  </Link>
                  <span className="text-subhead text-label-secondary">{MARK[b.status] ?? ""}</span>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
