"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { Checkbox } from "@/design/checkbox";
import { Dialog } from "@/design/dialog";
import { useToast } from "@/design/toast";
import { exportBrands } from "@/lib/export/actions";

type Brand = { id: string; name: string; status: string };

/** Research has finished; reviewed or not, it can go (owner, 2026-10-21: export never blocks). */
const finished = (b: Brand) => b.status === "needs_review" || b.status === "approved" || b.status === "exported";

/** Saves the CSV with a byte-order mark, so Excel reads Korean and accented names correctly. */
function download(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** "Export": the batch's brands, all ticked; untick any, download the CSV. */
export function ExportButton({ brands }: { brands: Brand[] }) {
  const router = useRouter();
  const toast = useToast();
  const ready = brands.filter(finished);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const all = selected.size === ready.length;

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <>
      <Button
        kind="gray"
        icon="download"
        disabled={ready.length === 0}
        onClick={() => {
          setSelected(new Set(ready.map((b) => b.id)));
          setNotes([]);
          setOpen(true);
        }}
      >
        Export
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title={notes.length > 0 ? "Downloaded" : "Export"}
        confirm={notes.length > 0 ? undefined : pending ? "Preparing…" : `Download CSV (${selected.size})`}
        cancel={notes.length > 0 ? "Close" : "Cancel"}
        busy={pending || selected.size === 0}
        closeOnConfirm={false}
        onConfirm={() =>
          start(async () => {
            const r = await exportBrands([...selected]);
            if (!r.ok) return toast(r.error);
            download(r.csv, r.filename);
            toast(`Downloaded ${r.count} brand${r.count === 1 ? "" : "s"}.`);
            router.refresh();
            if (r.notes.length > 0) setNotes(r.notes);
            else setOpen(false);
          })
        }
      >
        {notes.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-callout text-label">
              {notes.length} image{notes.length === 1 ? "" : "s"} didn&apos;t load and {notes.length === 1 ? "was" : "were"} left empty:
            </p>
            <ul className="flex flex-col gap-0.5 text-subhead text-label-secondary">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-separator pb-2">
              <span className="flex items-center gap-3">
                <Checkbox label="All brands" checked={all} indeterminate={!all && selected.size > 0} onCheckedChange={(on) => setSelected(new Set(on ? ready.map((b) => b.id) : []))} />
                <span className="text-body font-medium text-label">All</span>
              </span>
              <span className="text-subhead text-label-secondary">
                {selected.size} of {ready.length}
              </span>
            </div>
            <ul className="flex max-h-[50dvh] flex-col overflow-y-auto py-1">
              {ready.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-1.5">
                  <Checkbox label={b.name} checked={selected.has(b.id)} onCheckedChange={(on) => toggle(b.id, on)} />
                  <span className="min-w-0 flex-1 truncate text-body text-label">{b.name}</span>
                  <span className="text-subhead text-label-secondary">{b.status === "approved" ? "✓" : b.status === "exported" ? "Exported" : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    </>
  );
}
