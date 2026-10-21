"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { Checkbox } from "@/design/checkbox";
import { Pill } from "@/design/list";
import { useToast } from "@/design/toast";
import { sayAgo } from "@/design/ago";
import { cn } from "@/design/cn";
import { batchPick, batchState, exportable, initialSelection, type ExportGroup } from "@/lib/export/groups";
import { exportBrands, type ExportResult } from "@/lib/export/actions";

const STATUS: Record<string, { label: string; tone: "green" | "orange" | "grey" }> = {
  approved: { label: "Approved", tone: "green" },
  exported: { label: "Exported", tone: "grey" },
  needs_review: { label: "Not approved yet", tone: "orange" },
};

/** Saves the CSV with a byte-order mark, so Excel reads Korean and accented names correctly. */
function download(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Spec 2026-10-21 §2: choose what to export — whole batches or single brands, grouped by batch — then
 * check them and their images and download the CSV, or see what blocked it.
 */
export function ExportPanel({ groups, batchId, canExport }: { groups: ExportGroup[]; batchId: string | null; canExport: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelection(groups, batchId)));
  const [report, setReport] = useState<Extract<ExportResult, { ok: false }> | null>(null);
  const [pending, start] = useTransition();

  if (groups.length === 0) {
    return <p className="rounded-card bg-surface p-5 text-callout text-label-secondary">Nothing to export yet. Approve a brand on its page and it appears here.</p>;
  }
  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const problems = new Map(report?.report.map((r) => [r.id, r.problems]) ?? []);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6 lg:order-1">
        {groups.map((g) => {
          const state = batchState(g, selected);
          const pick = batchPick(g);
          return (
            <section key={g.id} className={cn("flex flex-col rounded-card bg-surface", g.id === batchId && "ring-2 ring-tint")}>
              <header className="flex items-center gap-3 border-b border-separator px-5 py-4">
                {canExport ? (
                  <Checkbox
                    label={`Every approved brand in this batch`}
                    checked={state === "all"}
                    indeterminate={state === "some"}
                    disabled={pick.length === 0}
                    onCheckedChange={(on) => toggle(pick, on)}
                  />
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-headline text-label">
                    Batch of {new Date(g.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="text-subhead text-label-secondary">
                    {sayAgo(g.createdAt)} · {pick.length} of {g.brands.length} approved
                  </span>
                </div>
                <Link href={`/batches/${g.id}`} className="text-subhead text-tint-text underline-offset-4 hover:underline">
                  Open batch
                </Link>
              </header>
              <ul className="flex flex-col">
                {g.brands.map((b) => {
                  const can = exportable(b);
                  const status = STATUS[b.status] ?? { label: "Researching", tone: "grey" as const };
                  const issues = problems.get(b.id);
                  return (
                    <li key={b.id} className="flex flex-col gap-2 border-t border-separator px-5 py-3 first:border-t-0">
                      <div className="flex items-center gap-3">
                        {canExport ? (
                          <Checkbox label={`Export ${b.name}`} checked={selected.has(b.id)} disabled={!can} onCheckedChange={(on) => toggle([b.id], on)} />
                        ) : null}
                        <Link href={`/brands/${b.id}`} className={cn("min-w-0 flex-1 truncate text-body underline-offset-4 hover:underline", can ? "text-label" : "text-label-secondary")}>
                          {b.name}
                        </Link>
                        <Pill tone={status.tone}>{status.label}</Pill>
                      </div>
                      {issues ? (
                        <ul className="ml-9 flex list-disc flex-col gap-0.5 pl-5 text-subhead text-system-red">
                          {issues.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <aside className="flex flex-col gap-4 rounded-card bg-surface p-5 lg:sticky lg:top-[calc(var(--app-bar)+4.5rem)] lg:order-2">
        <h2 className="text-title-3 text-label">
          {selected.size} brand{selected.size === 1 ? "" : "s"} selected
        </h2>
        <p className="text-subhead text-label-secondary">
          Each brand is checked against the DB&apos;s import rules and every image is loaded again first: Instagram links expire within days.
        </p>
        {report ? <p className="text-subhead font-medium text-system-red">{report.error} Nothing was downloaded; the problems are listed under each brand.</p> : null}
        {canExport ? (
          <Button
            kind="filled"
            size="lg"
            icon="download"
            disabled={pending || selected.size === 0}
            onClick={() =>
              start(async () => {
                setReport(null);
                const r = await exportBrands([...selected]);
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
            {pending ? "Checking…" : "Check and download CSV"}
          </Button>
        ) : (
          <p className="text-subhead text-label-secondary">You can see what&apos;s ready, but exporting needs edit rights.</p>
        )}
      </aside>
    </div>
  );
}
