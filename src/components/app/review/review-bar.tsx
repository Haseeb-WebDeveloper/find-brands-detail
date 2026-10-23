"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { useToast } from "@/design/toast";
import { markReviewed } from "@/lib/review/actions";
import { nextToReview, type Sibling } from "@/lib/review/next";

/**
 * Moving through a batch: ‹ 3 of 25 › and "Done → next", which marks this brand reviewed and opens the
 * next one still to review (owner, 2026-10-21: review 25 brands as fast as possible).
 */
export function ReviewBar({ brandId, batchId, siblings, status, canEdit }: { brandId: string; batchId: string; siblings: Sibling[]; status: string; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const at = siblings.findIndex((s) => s.id === brandId);
  const prev = at > 0 ? siblings[at - 1] : null;
  const next = at < siblings.length - 1 ? siblings[at + 1] : null;
  const after = nextToReview(siblings, brandId);
  const go = (to: Sibling | null) => router.push(to ? `/brands/${to.id}` : `/batches/${batchId}`);
  const reviewed = status === "approved" || status === "exported";
  // Where Done goes, loaded ahead: the next brand opens at once (pages here wait ~200ms per database trip).
  const afterId = after?.id;
  useEffect(() => {
    if (afterId) router.prefetch(`/brands/${afterId}`);
  }, [afterId, router]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        <Button kind="plain" size="sm" iconOnly icon="chevronLeft" disabled={!prev} href={prev ? `/brands/${prev.id}` : undefined} prefetch className="border-none text-label">
          Previous brand
        </Button>
        <span className="min-w-14 text-center text-subhead text-label-secondary tabular-nums">
          {at + 1} of {siblings.length}
        </span>
        <Button kind="plain" size="sm" iconOnly icon="chevronRight" disabled={!next} href={next ? `/brands/${next.id}` : undefined} prefetch className="border-none text-label">
          Next brand
        </Button>
      </div>
      {canEdit && !reviewed ? (
        <Button
          kind="filled"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await markReviewed(brandId);
              if (!r.ok) return toast(r.error, { tone: "error" });
              if (!after) toast("That was the last one. The batch is reviewed.");
              go(after);
            })
          }
        >
          {pending ? "Saving…" : after ? "Done → next" : "Done"}
        </Button>
      ) : (
        <Button kind="gray" onClick={() => go(after)}>
          {reviewed ? "✓ Reviewed · " : ""}
          {after ? "Next to review →" : "Back to batch"}
        </Button>
      )}
    </div>
  );
}
