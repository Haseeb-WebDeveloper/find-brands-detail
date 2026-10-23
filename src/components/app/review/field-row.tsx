"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageViewer, type ViewerAction, type ViewerFrame } from "@/components/app/review/image-viewer";
import { FramedImage } from "@/components/app/review/framed-image";
import { cn } from "@/design/cn";
import { useToast } from "@/design/toast";
import { FRAME_ASPECT, type Framing } from "@/lib/images/framing";
import { chooseValue, frameCover } from "@/lib/review/actions";
import type { ReviewField } from "@/lib/export/row";
import { TypeValue, UseThisButton } from "@/components/app/review/field-controls";

type Score = "proven" | "review" | "rejected";
/** `meta`: the few facts that decide it at a glance (followers, size); `note`: the full reason, on hover. */
export type RowCandidate = {
  id: string;
  label: string;
  meta: string;
  href: string;
  image: string | null;
  score: Score;
  note: string;
  /** A cover's place in its card (null: centred); `size`: its pixels, when measured. */
  framing: Framing | null;
  size: { w: number; h: number } | null;
};

const DOT: Record<Score, string> = { proven: "bg-system-green", review: "bg-system-orange", rejected: "bg-system-red" };
const WORD: Record<Score, string> = { proven: "Proven", review: "Needs a look", rejected: "Rejected" };

/** The frames on the site: the cover card (cropped by the importer) and the logo's circle (shown whole). */
const FRAME: Partial<Record<ReviewField, ViewerFrame>> = {
  cover: { kind: "box", aspect: FRAME_ASPECT.cover, label: "Cover card, as on the site" },
  logo: { kind: "circle", label: "Logo, as on the site" },
};

function Thumb({ c, field, onOpen }: { c: RowCandidate; field: ReviewField; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="shrink-0 cursor-zoom-in" aria-label="View full screen">
      {field === "cover" ? (
        <FramedImage src={c.image as string} aspect={FRAME_ASPECT.cover} framing={c.framing} size={c.size} className="aspect-[16/11] h-12 rounded-md" />
      ) : (
        // The logo as the site shows it: whole, in a circle.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.image as string} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-12 rounded-full bg-fill object-cover" />
      )}
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
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (act: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) =>
    start(async () => {
      const r = await act();
      if (!r.ok) return toast(r.error, { tone: "error" });
      toast(done);
      router.refresh();
    });
  // "Use this image" for a logo or cover; a cover keeps the framing on screen, and "Save framing" a changed one.
  const action: ViewerAction | undefined = canEdit
    ? {
        label: "Use this image",
        doneLabel: "In use",
        busy: pending,
        done: (n) => pictures[n]?.id === chosen?.id,
        can: (n) => pictures[n]?.score !== "rejected",
        onUse: (n, framing) => run(() => chooseValue(brandId, field, pictures[n].id, field === "cover" ? framing : undefined), ` chosen.`),
        onFrame: (n, framing) => run(() => frameCover(pictures[n].id, framing), "Framing saved."),
      }
    : undefined;
  return (
    <div className={cn("flex flex-col", !first && "border-t border-separator")}>
      <div className="flex min-h-16 items-center gap-4 px-4 py-2">
        <span className="w-24 shrink-0 text-subhead text-label-secondary">{label}</span>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {chosen ? (
            <>
              {image && chosen.image ? <Thumb c={chosen} field={field} onOpen={() => view(chosen)} /> : null}
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
              {image && o.image ? <Thumb c={o} field={field} onOpen={() => view(o)} /> : null}
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
        <ImageViewer
          images={pictures.map((p) => ({ url: p.image as string, caption: [p.label, p.meta].filter(Boolean).join(" · "), framing: p.framing, size: p.size }))}
          start={viewing}
          onClose={() => setViewing(null)}
          frame={FRAME[field]}
          action={action}
        />
      ) : null}
    </div>
  );
}
