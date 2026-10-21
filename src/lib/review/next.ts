export type Sibling = { id: string; name: string; status: string };

/** Research done and not yet marked reviewed or exported. */
export const toReview = (s: Sibling) => s.status === "needs_review";

/**
 * Where "Done → next" goes: the next brand in the batch still to review, after this one and then from
 * the top; null when none is left.
 */
export function nextToReview(siblings: Sibling[], currentId: string): Sibling | null {
  const at = siblings.findIndex((s) => s.id === currentId);
  const after = [...siblings.slice(at + 1), ...siblings.slice(0, Math.max(at, 0))];
  return after.find(toReview) ?? null;
}
