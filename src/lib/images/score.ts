import type { ImageCheckResult } from "@/lib/images/check-image";

export type ImageSource = { kind: "site" | "instagram" | "tiktok"; label: string };
export type ImageCandidate = { slot: "logo" | "cover"; url: string; source: ImageSource; check: ImageCheckResult; expiresAt: Date | null };
export type ImageVerdict = { score: "proven" | "review" | "rejected"; reason: string };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** The DB shows logos square and cropped to fill; past this ratio a wordmark loses its ends. */
const MAX_LOGO_RATIO = 2;
/** The importer fills covers to this frame (db-admin FILL_FRAME_ASPECT.cover). */
const COVER_ASPECT = 16 / 11;

const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Spec §7, Logo and cover. */
export function scoreImage(c: ImageCandidate, now: Date): ImageVerdict {
  const { check } = c;
  if (!check.ok || !check.width || !check.height) return { score: "rejected", reason: check.reason ?? "Not an image." };
  const size = `${check.width}×${check.height}`;
  if (!check.passesMin) return { score: "rejected", reason: `${size} — below the ${check.minDimension}px minimum for a ${c.slot}.` };
  const ratio = Math.max(check.width, check.height) / Math.min(check.width, check.height);
  if (c.slot === "logo" && ratio > MAX_LOGO_RATIO) {
    return { score: "review", reason: `${size}: too ${check.width > check.height ? "wide" : "tall"} for the square logo frame, so it would be cropped.` };
  }
  const from = `${size} from ${c.source.label}.`;
  if (c.expiresAt && c.expiresAt.getTime() <= now.getTime()) {
    return { score: "review", reason: `${from} The link expired on ${day(c.expiresAt)}; re-run research for a fresh one.` };
  }
  if (c.expiresAt && c.expiresAt.getTime() - now.getTime() < WEEK_MS) {
    return { score: "review", reason: `${from} The link expires on ${day(c.expiresAt)}; export soon after review.` };
  }
  return { score: "proven", reason: from };
}

/** How far an image is from the shape its slot is shown in (0 = exact). */
function misfit(c: ImageCandidate): number {
  const { width = 1, height = 1 } = c.check;
  return Math.abs(Math.log(width / height / (c.slot === "logo" ? 1 : COVER_ASPECT)));
}

/** Proven first, then review; within a level the best-fitting shape, then the most pixels. */
export function chooseImage(scored: { candidate: ImageCandidate; verdict: ImageVerdict }[]): ImageCandidate | null {
  const rank = (c: ImageCandidate) => [Math.round(misfit(c) * 10), -Math.min(c.check.width ?? 0, c.check.height ?? 0)];
  const better = (a: ImageCandidate, b: ImageCandidate) => {
    const [x, y] = [rank(a), rank(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i];
    return false;
  };
  for (const level of ["proven", "review"] as const) {
    const pool = scored.filter((s) => s.verdict.score === level).map((s) => s.candidate);
    if (pool.length > 0) return pool.reduce((best, c) => (better(c, best) ? c : best));
  }
  return null;
}
