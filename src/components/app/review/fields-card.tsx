import type { BrandDetail } from "@/lib/brands/scoped";
import { REVIEW_FIELDS, type ReviewField } from "@/lib/export/row";
import { FieldRow, type RowCandidate } from "@/components/app/review/field-row";

const LABEL: Record<ReviewField, string> = { website: "Website", instagram: "Instagram", tiktok: "TikTok", logo: "Logo", cover: "Cover" };

type Candidate = BrandDetail["website"]["candidates"][number];

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

type Evidence = { followers?: number | null; verified?: boolean | null; kind?: string; width?: number | null; height?: number | null };

/** Where a picture came from, in a word or two. */
function origin(c: Candidate, e: Evidence): string {
  if (c.source === "Typed by a reviewer" || e.kind === "typed") return "Added by you";
  if (e.kind === "instagram") return "Instagram";
  if (e.kind === "tiktok") return "TikTok";
  return c.source;
}

function toRow(field: ReviewField, c: Candidate): RowCandidate {
  const e = c.evidence as Evidence;
  const base = { id: c.id, score: c.score, note: c.reason };
  if (field === "instagram" || field === "tiktok") {
    const meta = [typeof e.followers === "number" ? `${compact.format(e.followers)} followers` : null, e.verified ? "verified" : null].filter(Boolean).join(" · ");
    const href = field === "instagram" ? `https://www.instagram.com/${c.value}/` : `https://www.tiktok.com/@${c.value}`;
    return { ...base, label: `@${c.value}`, meta, href, image: null, framing: null, size: null };
  }
  if (field === "website") return { ...base, label: c.value.replace(/^https?:\/\//, "").replace(/\/$/, ""), meta: "", href: c.value, image: null, framing: null, size: null };
  const size = e.width && e.height ? `${e.width}×${e.height}` : (c.reason.match(/\d+×\d+/)?.[0] ?? "");
  return { ...base, label: origin(c, e), meta: size, href: c.value, image: c.value, framing: c.framing, size: e.width && e.height ? { w: e.width, h: e.height } : null };
}

/** The five facts, one row each: the chosen value at a glance, everything else behind "Change". */
export function FieldsCard({ brand, canEdit }: { brand: BrandDetail; canEdit: boolean }) {
  return (
    <section className="flex flex-col rounded-card bg-surface">
      {REVIEW_FIELDS.map((field, i) => {
        const section = brand[field];
        const chosen = section.candidates.find((c) => c.id === section.selectedCandidateId) ?? null;
        const options = section.candidates.filter((c) => c.id !== section.selectedCandidateId);
        return (
          <FieldRow
            key={field}
            brandId={brand.id}
            field={field}
            label={LABEL[field]}
            chosen={chosen ? toRow(field, chosen) : null}
            options={options.map((c) => toRow(field, c))}
            canEdit={canEdit}
            first={i === 0}
          />
        );
      })}
    </section>
  );
}
