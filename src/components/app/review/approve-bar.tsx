"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { useToast } from "@/design/toast";
import { approveBrand, reopenBrand } from "@/lib/review/actions";

/**
 * Top of the brand page: what still blocks the DB import, in plain words, and the Approve button,
 * enabled only when nothing does (spec §8). Warnings never block.
 */
export function ApproveBar({ brandId, status, errors, warnings, canEdit }: { brandId: string; status: string; errors: string[]; warnings: string[]; canEdit: boolean }) {
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

  if (status === "approved" || status === "exported") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface p-4">
        <p className="text-callout text-label">
          <span className="font-medium text-system-green">{status === "approved" ? "Approved." : "Exported."}</span> Any change puts it back into review.
        </p>
        {canEdit ? (
          <Button kind="gray" disabled={pending} onClick={() => run(() => reopenBrand(brandId), "Back in review.")}>
            Re-open
          </Button>
        ) : null}
      </div>
    );
  }
  if (status !== "needs_review") return null;
  return (
    <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
      {errors.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-callout font-medium text-label">Before approving, the DB needs:</p>
          <ul className="flex list-disc flex-col gap-0.5 pl-5 text-callout text-label-secondary">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-callout text-label">Everything the DB needs is here.</p>
      )}
      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-footnote text-system-orange">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        <div>
          <Button kind="filled" disabled={pending || errors.length > 0} onClick={() => run(() => approveBrand(brandId), "Approved. It's ready to export.")}>
            {pending ? "Approving…" : "Approve brand"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
