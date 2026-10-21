import type { BrandDetail } from "@/lib/brands/scoped";
import { REVIEW_FIELDS, type ReviewField } from "@/lib/export/row";
import { FieldRow, type RowCandidate } from "@/components/app/review/field-row";

const LABEL: Record<ReviewField, string> = { website: "Website", instagram: "Instagram", tiktok: "TikTok", logo: "Logo", cover: "Cover" };

type Candidate = BrandDetail["website"]["candidates"][number];

function toRow(field: ReviewField, c: Candidate): RowCandidate {
  const e = c.evidence as { followers?: number | null };
  const followers = typeof e.followers === "number" ? `${e.followers.toLocaleString("en-US")} followers · ` : "";
  if (field === "instagram") return { id: c.id, label: `@${c.value}`, href: `https://www.instagram.com/${c.value}/`, image: null, score: c.score, note: `${followers}${c.reason}` };
  if (field === "tiktok") return { id: c.id, label: `@${c.value}`, href: `https://www.tiktok.com/@${c.value}`, image: null, score: c.score, note: `${followers}${c.reason}` };
  if (field === "website") return { id: c.id, label: c.value.replace(/^https?:\/\//, "").replace(/\/$/, ""), href: c.value, image: null, score: c.score, note: c.reason };
  // Logo and cover: the size says most; the source names where it came from.
  const size = c.reason.match(/\d+×\d+/)?.[0];
  return { id: c.id, label: size ? `${size} · ${c.source}` : c.source, href: c.value, image: c.value, score: c.score, note: c.reason };
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
