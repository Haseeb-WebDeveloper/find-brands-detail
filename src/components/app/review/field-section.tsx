import Link from "next/link";
import { ListGroup, ListRow, Pill } from "@/design/list";
import { cn } from "@/design/cn";
import type { BrandDetail } from "@/lib/brands/scoped";
import type { ReviewField } from "@/lib/export/row";
import { TypeValue, UseThisButton } from "@/components/app/review/field-controls";
import { ANCHOR } from "@/components/app/review/anchor";

const TONE = { proven: "green", review: "orange", rejected: "red" } as const;
const LABEL = { proven: "Proven", review: "Needs a look", rejected: "Rejected" } as const;
const TITLE: Record<ReviewField, string> = { website: "Website", instagram: "Instagram", tiktok: "TikTok", logo: "Logo", cover: "Cover" };
const HINT: Record<ReviewField, string> = {
  website: "The brand's official site; the global one when there are several.",
  instagram: "The brand's global account. The DB needs one to make the brand live.",
  tiktok: "Optional.",
  logo: "Shown square in the DB, so a square picture works best (256px or more).",
  cover: "Filled to a 16:11 frame in the DB (800px or more).",
};


type Section = BrandDetail["website"];
type Candidate = Section["candidates"][number];
type Evidence = {
  followers?: number | null;
  name?: string | null;
  verified?: boolean | null;
  private?: boolean | null;
  bioReached?: string | null;
  sameBioAsInstagram?: boolean;
  archivedAt?: string | null;
};

/** What the reviewer needs to judge one candidate, in a line. */
function detail(field: ReviewField, c: Candidate): string {
  const e = c.evidence as Evidence;
  const facts = [
    field === "website" && e.archivedAt ? `archive copy from ${String(e.archivedAt).slice(0, 4)}` : null,
    field !== "website" ? e.name : null,
    typeof e.followers === "number" ? `${e.followers.toLocaleString("en-US")} followers` : null,
    e.verified === true ? "verified badge" : e.verified === false ? "no badge" : null,
    e.private ? "private account" : null,
    e.bioReached ? `bio reaches ${e.bioReached}` : e.sameBioAsInstagram ? "same bio link as Instagram" : null,
  ].filter(Boolean);
  return [c.reason, c.source, ...facts].join(" · ");
}

function href(field: ReviewField, value: string): string {
  if (field === "instagram") return `https://www.instagram.com/${value}/`;
  if (field === "tiktok") return `https://www.tiktok.com/@${value}`;
  return value;
}

function name(field: ReviewField, c: Candidate): string {
  if (field === "instagram" || field === "tiktok") return `@${c.value}`;
  return c.value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Logo and cover: pictures large enough to judge, chosen first, rejected ones faded at the end. */
function ImageTiles({ brandId, field, section, canEdit }: { brandId: string; field: "logo" | "cover"; section: Section; canEdit: boolean }) {
  const order = { proven: 1, review: 2, rejected: 3 } as const;
  const tiles = [...section.candidates].sort((a, b) => {
    const chosen = Number(b.id === section.selectedCandidateId) - Number(a.id === section.selectedCandidateId);
    return chosen || order[a.score] - order[b.score];
  });
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
      {tiles.map((c) => {
        const chosen = c.id === section.selectedCandidateId;
        return (
          <div key={c.id} className={cn("flex flex-col gap-2 rounded-card bg-surface p-3", chosen && "ring-2 ring-tint", c.score === "rejected" && "opacity-55")}>
            <a href={c.value} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg bg-fill">
              {/* A remote image at its own address: the reviewer sees exactly what will be exported. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.value} alt="" loading="lazy" referrerPolicy="no-referrer" className={cn("w-full object-cover", field === "logo" ? "aspect-square" : "aspect-[16/11]")} />
            </a>
            <div className="flex flex-wrap items-center gap-1.5">
              {chosen ? <Pill tone="blue">Chosen</Pill> : null}
              <Pill tone={TONE[c.score]}>{LABEL[c.score]}</Pill>
            </div>
            <p className="line-clamp-1 text-subhead font-medium text-label" title={c.source}>
              {c.source}
            </p>
            <p className="line-clamp-3 text-footnote text-label-secondary" title={c.reason}>
              {c.reason}
            </p>
            {canEdit && !chosen && c.score !== "rejected" ? (
              <div className="mt-auto">
                <UseThisButton brandId={brandId} field={field} candidateId={c.id} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * One field on the brand page: every candidate research checked (and every value a reviewer typed),
 * the chosen one marked, "Use this" on the others, and a box for the reviewer's own value.
 */
export function FieldSection({ brandId, field, section, canEdit }: { brandId: string; field: ReviewField; section: Section; canEdit: boolean }) {
  return (
    <section id={field} className={cn("flex flex-col gap-3", ANCHOR)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-title-3 text-label">{TITLE[field]}</h2>
        <p className="text-subhead text-label-secondary">{HINT[field]}</p>
      </div>
      {section.candidates.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-3 text-callout text-label-secondary">Nothing found yet.{canEdit ? " Add one below." : ""}</p>
      ) : field === "logo" || field === "cover" ? (
        <ImageTiles brandId={brandId} field={field} section={section} canEdit={canEdit} />
      ) : (
        <ListGroup>
          {section.candidates.map((c, i) => {
            const chosen = c.id === section.selectedCandidateId;
            return (
              <ListRow
                key={c.id}
                first={i === 0}
                title={
                  <span className="flex items-center gap-2">
                    {chosen ? <Pill tone="blue">Chosen</Pill> : null}
                    <Link href={href(field, c.value)} target="_blank" rel="noreferrer" className="truncate underline-offset-4 hover:underline">
                      {name(field, c)}
                    </Link>
                  </span>
                }
                body={<p className="text-subhead text-label-secondary">{detail(field, c)}</p>}
                trailing={
                  <div className="flex shrink-0 items-center gap-2">
                    {canEdit && !chosen && c.score !== "rejected" ? <UseThisButton brandId={brandId} field={field} candidateId={c.id} /> : null}
                    <Pill tone={TONE[c.score]}>{LABEL[c.score]}</Pill>
                  </div>
                }
              />
            );
          })}
        </ListGroup>
      )}
      {canEdit ? <TypeValue brandId={brandId} field={field} /> : null}
    </section>
  );
}
