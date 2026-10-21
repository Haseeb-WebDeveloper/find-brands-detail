"use client";

import { useState } from "react";
import { cn } from "@/design/cn";
import type { ReviewField } from "@/lib/export/row";
import { TypeValue, UseThisButton } from "@/components/app/review/field-controls";

type Score = "proven" | "review" | "rejected";
export type RowCandidate = { id: string; label: string; href: string; image: string | null; score: Score; note: string };

const DOT: Record<Score, string> = { proven: "bg-system-green", review: "bg-system-orange", rejected: "bg-system-red" };
const WORD: Record<Score, string> = { proven: "Proven", review: "Needs a look", rejected: "Rejected" };

function Thumb({ src, field }: { src: string; field: ReviewField }) {
  return (
    // A remote image at its own address: the reviewer sees exactly what will be exported.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className={cn("shrink-0 rounded-md bg-fill object-cover", field === "logo" ? "size-12" : "h-12 w-[4.4rem]")} />
  );
}

/** One field: the chosen value at a glance; "Change" opens the other options and a box for your own. */
export function FieldRow({
  brandId,
  field,
  label,
  chosen,
  options,
  canEdit,
  first,
}: {
  brandId: string;
  field: ReviewField;
  label: string;
  chosen: RowCandidate | null;
  options: RowCandidate[];
  canEdit: boolean;
  first: boolean;
}) {
  const [open, setOpen] = useState(false);
  const image = field === "logo" || field === "cover";
  return (
    <div className={cn("flex flex-col", !first && "border-t border-separator")}>
      <div className="flex min-h-16 items-center gap-4 px-4 py-2">
        <span className="w-24 shrink-0 text-subhead text-label-secondary">{label}</span>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {chosen ? (
            <>
              {image && chosen.image ? <Thumb src={chosen.image} field={field} /> : null}
              <a href={chosen.href} target="_blank" rel="noreferrer" className="min-w-0 truncate text-body text-label underline-offset-4 hover:underline" title={chosen.note}>
                {chosen.label}
              </a>
              <span aria-label={WORD[chosen.score]} title={`${WORD[chosen.score]}: ${chosen.note}`} className={cn("size-2.5 shrink-0 rounded-full", DOT[chosen.score])} />
            </>
          ) : (
            <span className="text-body text-label-tertiary">—</span>
          )}
        </div>
        {canEdit || options.length > 0 ? (
          <button type="button" onClick={() => setOpen(!open)} className="shrink-0 text-subhead text-tint-text hover:underline">
            {open ? "Close" : chosen ? "Change" : "Add"}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="flex flex-col gap-2 bg-fill/40 px-4 py-3">
          {options.map((o) => (
            <div key={o.id} className={cn("flex items-center gap-3", o.score === "rejected" && "opacity-55")}>
              {image && o.image ? <Thumb src={o.image} field={field} /> : null}
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[o.score])} />
              <div className="flex min-w-0 flex-1 flex-col">
                <a href={o.href} target="_blank" rel="noreferrer" className="truncate text-callout text-label underline-offset-4 hover:underline">
                  {o.label}
                </a>
                <span className="truncate text-footnote text-label-secondary" title={o.note}>
                  {o.note}
                </span>
              </div>
              {canEdit && o.score !== "rejected" ? <UseThisButton brandId={brandId} field={field} candidateId={o.id} /> : null}
            </div>
          ))}
          {canEdit ? <TypeValue brandId={brandId} field={field} /> : null}
        </div>
      ) : null}
    </div>
  );
}
