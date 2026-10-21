"use client";

import { useState } from "react";
import { ImageViewer } from "@/components/app/review/image-viewer";
import { cn } from "@/design/cn";
import type { ReviewField } from "@/lib/export/row";
import { TypeValue, UseThisButton } from "@/components/app/review/field-controls";

type Score = "proven" | "review" | "rejected";
/** `meta`: the few facts that decide it at a glance (followers, size); `note`: the full reason, on hover. */
export type RowCandidate = { id: string; label: string; meta: string; href: string; image: string | null; score: Score; note: string };

const DOT: Record<Score, string> = { proven: "bg-system-green", review: "bg-system-orange", rejected: "bg-system-red" };
const WORD: Record<Score, string> = { proven: "Proven", review: "Needs a look", rejected: "Rejected" };

function Thumb({ src, field, onOpen }: { src: string; field: ReviewField; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="shrink-0 cursor-zoom-in" aria-label="View full screen">
      {/* A remote image at its own address: the reviewer sees exactly what will be exported. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className={cn("rounded-md bg-fill object-cover", field === "logo" ? "size-12" : "h-12 w-[4.4rem]")} />
    </button>
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
  const [viewing, setViewing] = useState<number | null>(null);
  const image = field === "logo" || field === "cover";
  const pictures = [chosen, ...options].filter((c): c is RowCandidate => Boolean(c?.image));
  const view = (c: RowCandidate) => setViewing(pictures.findIndex((p) => p.id === c.id));
  return (
    <div className={cn("flex flex-col", !first && "border-t border-separator")}>
      <div className="flex min-h-16 items-center gap-4 px-4 py-2">
        <span className="w-24 shrink-0 text-subhead text-label-secondary">{label}</span>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {chosen ? (
            <>
              {image && chosen.image ? <Thumb src={chosen.image} field={field} onOpen={() => view(chosen)} /> : null}
              <a href={chosen.href} target="_blank" rel="noreferrer" className="min-w-0 truncate text-body text-label underline-offset-4 hover:underline" title={chosen.note}>
                {chosen.label}
              </a>
              {chosen.meta ? <span className="shrink-0 text-subhead text-label-secondary">{chosen.meta}</span> : null}
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
              {image && o.image ? <Thumb src={o.image} field={field} onOpen={() => view(o)} /> : null}
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[o.score])} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-baseline gap-2">
                  <a href={o.href} target="_blank" rel="noreferrer" className="truncate text-callout text-label underline-offset-4 hover:underline">
                    {o.label}
                  </a>
                  {o.meta ? <span className="shrink-0 text-footnote text-label-secondary">{o.meta}</span> : null}
                </span>
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
      {viewing !== null && viewing >= 0 ? (
        <ImageViewer images={pictures.map((p) => ({ url: p.image as string, caption: [p.label, p.meta].filter(Boolean).join(" · ") }))} start={viewing} onClose={() => setViewing(null)} />
      ) : null}
    </div>
  );
}
