/**
 * One-off (2026-10-23): re-scores images research rejected under the old rules, now that a portrait
 * cover and an image the host blocks our server from are usable after a look (images/score.ts). Then
 * picks a cover, and a campaign image, where none is chosen yet, the way research would have.
 *
 * Only research's own images are re-scored; a reviewer's typed ones keep their verdict. Only brands
 * not yet reviewed get a pick: an approved or exported brand stays as it was left.
 *
 *   pnpm tsx --conditions=react-server scripts/rescore-images.ts          # what would change
 *   pnpm tsx --conditions=react-server scripts/rescore-images.ts --apply  # change it
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const APPLY = process.argv.includes("--apply");
const OLD_REASON = /not a landscape image|Upstream returned 40[13]/;

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { chooseImage, scoreImage } = await import("../src/lib/images/score");
  type Candidate = Parameters<typeof scoreImage>[0];
  const now = new Date();

  /** A stored image rebuilt as research saw it: its check from its evidence and reason. */
  const rebuild = (slot: Candidate["slot"], url: string, kind: string, label: string, width: number | null, height: number | null, reason: string, expiresAt: string | null): Candidate => {
    // The old wording ("Upstream returned 403") or the new ("…downloading it (403)…").
    const m = reason.match(/returned (\d{3})|downloading it \((\d{3})\)/);
    const status = Number(m?.[1] ?? m?.[2] ?? 200);
    const ok = status === 200 && Boolean(width && height);
    return {
      slot,
      url,
      source: { kind: (["site", "instagram", "tiktok", "third_party"].includes(kind) ? kind : "site") as Candidate["source"]["kind"], label },
      check: { url, slot, ok, status, width: width ?? undefined, height: height ?? undefined, passesMin: ok, minDimension: slot === "logo" ? 256 : 800 },
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    };
  };
  const reviewable = (status: string) => status === "needs_review" || status === "queued" || status === "researching";

  // ── Logos and covers ──
  const rows = await prisma.candidate.findMany({
    where: { field: { in: ["logo", "cover"] }, score: "rejected", source: { not: "Typed by a reviewer" } },
    select: { id: true, brandId: true, field: true, value: true, source: true, reason: true, evidence: true },
  });
  let rescored = 0;
  for (const r of rows.filter((r) => OLD_REASON.test(r.reason))) {
    const e = (r.evidence ?? {}) as { kind?: string; width?: number | null; height?: number | null; expiresAt?: string | null };
    const label = r.source.replace(/^a recent /, "").replace(/'s Instagram profile picture$/, "");
    const v = scoreImage(rebuild(r.field as "logo" | "cover", r.value, e.kind ?? "site", label, e.width ?? null, e.height ?? null, r.reason, e.expiresAt ?? null), now);
    if (v.score === "rejected") continue;
    rescored++;
    console.log(`${r.field} ${r.value.slice(0, 70)} → ${v.score}: ${v.reason.slice(0, 90)}`);
    if (APPLY) await prisma.candidate.update({ where: { id: r.id }, data: { score: v.score, reason: v.reason } });
  }

  // A cover where none is chosen, on brands not yet reviewed.
  const brands = await prisma.brand.findMany({ select: { id: true, name: true, status: true, selections: { where: { field: "cover" }, select: { candidateId: true } } } });
  let picked = 0;
  for (const b of brands.filter((b) => b.selections.length === 0 && reviewable(b.status))) {
    const covers = await prisma.candidate.findMany({ where: { brandId: b.id, field: "cover" }, orderBy: { createdAt: "asc" } });
    const scored = covers.map((c) => {
      const e = (c.evidence ?? {}) as { kind?: string; width?: number | null; height?: number | null; expiresAt?: string | null };
      const cand = rebuild("cover", c.value, e.kind ?? "site", c.source, e.width ?? null, e.height ?? null, c.reason, e.expiresAt ?? null);
      // The verdict as stored (or as re-scored above, when applied).
      const verdict = { score: (APPLY ? c.score : OLD_REASON.test(c.reason) ? scoreImage(cand, now).score : c.score) as "proven" | "review" | "rejected", reason: c.reason };
      return { candidate: cand, verdict, id: c.id };
    });
    const chosen = chooseImage(scored);
    const row = scored.find((s) => s.candidate === chosen);
    if (!row) continue;
    picked++;
    console.log(`cover picked for ${b.name}: ${row.candidate.url.slice(0, 80)}`);
    if (APPLY) await prisma.selection.create({ data: { brandId: b.id, field: "cover", candidateId: row.id, chosenBy: "auto" } });
  }

  // ── Campaign images ──
  const images = await prisma.campaignImage.findMany({ where: { score: "rejected" }, select: { id: true, url: true, reason: true, sourceKind: true } });
  let campaignRescored = 0;
  for (const i of images.filter((i) => OLD_REASON.test(i.reason))) {
    const host = (() => {
      try {
        return new URL(i.url).hostname.replace(/^www\./, "");
      } catch {
        return i.url;
      }
    })();
    const v = scoreImage(rebuild("campaign", i.url, i.sourceKind === "third_party" ? "third_party" : "site", host, null, null, i.reason, null), now);
    if (v.score === "rejected") continue;
    campaignRescored++;
    if (APPLY) await prisma.campaignImage.update({ where: { id: i.id }, data: { score: v.score, reason: v.reason } });
  }
  // A campaign image where none is used: the first usable one, on brands not yet reviewed.
  const campaigns = await prisma.campaign.findMany({
    where: { images: { none: { selected: true } }, brand: { status: { in: ["needs_review", "queued", "researching"] } } },
    select: { id: true, title: true, images: { where: { score: { not: "rejected" } }, orderBy: { position: "asc" }, select: { id: true }, take: 1 } },
  });
  let campaignPicked = 0;
  for (const c of campaigns.filter((c) => c.images.length > 0)) {
    campaignPicked++;
    if (APPLY) await prisma.campaignImage.update({ where: { id: c.images[0].id }, data: { selected: true } });
  }

  console.log(
    `\n${APPLY ? "Changed" : "Would change"}: ${rescored} logo/cover images re-scored, ${picked} covers picked, ${campaignRescored} campaign images re-scored, ${campaignPicked} campaign images picked.`,
  );
  if (!APPLY) console.log("Dry run. Pass --apply to change it.");
  await prisma.$disconnect();
}
main();
