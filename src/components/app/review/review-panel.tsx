"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { useToast } from "@/design/toast";
import { cn } from "@/design/cn";
import { approveBrand, reopenBrand } from "@/lib/review/actions";
import type { CheckItem } from "@/lib/review/checklist";

const MARK = {
  done: { sign: "✓", className: "bg-system-green/15 text-system-green" },
  warn: { sign: "!", className: "bg-system-orange/15 text-system-orange" },
  todo: { sign: "✕", className: "bg-system-red/15 text-system-red" },
  optional: { sign: "–", className: "bg-fill text-label-secondary" },
} as const;

/**
 * Beside the brand's work, always in view (sticky on wide screens, first on narrow ones): what is done,
 * what needs a look, what is missing — each a jump to its section — and Approve, which the DB
 * importer's own rules enable (spec 2026-10-21 §2).
 */
export function ReviewPanel({
  brandId,
  status,
  items,
  errors,
  warnings,
  canEdit,
}: {
  brandId: string;
  status: string;
  items: CheckItem[];
  errors: string[];
  warnings: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) =>
    start(async () => {
      const r = await action();
      if (!r.ok) return toast(r.error);
      toast(done);
      router.refresh();
    });
  const approved = status === "approved" || status === "exported";
  const researching = status === "queued" || status === "researching";

  return (
    <aside className="flex flex-col gap-4 rounded-card bg-surface p-5 lg:sticky lg:top-[calc(var(--app-bar)+4.5rem)]">
      <h2 className="text-title-3 text-label">{approved ? (status === "approved" ? "Approved" : "Exported") : researching ? "Researching…" : "Ready to approve?"}</h2>
      <ul className="flex flex-col gap-1">
        {items.map((i) => (
          <li key={i.key}>
            <a href={`#${i.anchor}`} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-fill/60">
              <span aria-hidden className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-footnote font-semibold", MARK[i.status].className)}>
                {MARK[i.status].sign}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-body text-label">{i.label}</span>
                <span className="text-subhead text-label-secondary">{i.detail}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      {!approved && !researching && errors.length > 0 ? (
        <details className="rounded-lg bg-fill/50 px-3 py-2 text-subhead text-label-secondary">
          <summary className="cursor-pointer text-label">The DB still needs {errors.length} thing{errors.length === 1 ? "" : "s"}</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-1 text-subhead text-system-orange">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {canEdit && approved ? (
        <>
          <p className="text-subhead text-label-secondary">Any change puts it back into review.</p>
          <Button kind="gray" size="lg" disabled={pending} onClick={() => run(() => reopenBrand(brandId), "Back in review.")}>
            Re-open
          </Button>
        </>
      ) : null}
      {canEdit && !approved ? (
        <Button kind="filled" size="lg" disabled={pending || errors.length > 0} onClick={() => run(() => approveBrand(brandId), "Approved. It's ready to export.")}>
          {pending ? "Approving…" : "Approve brand"}
        </Button>
      ) : null}
    </aside>
  );
}
