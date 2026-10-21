import Link from "next/link";
import { ListGroup, ListRow, Pill } from "@/design/list";
import type { BrandDetail } from "@/lib/brands/scoped";
import type { ReviewField } from "@/lib/export/row";
import { TypeValue, UseThisButton } from "@/components/app/review/field-controls";

const TONE = { proven: "green", review: "orange", rejected: "red" } as const;
const LABEL = { proven: "Proven", review: "Needs a look", rejected: "Rejected" } as const;
const TITLE: Record<ReviewField, string> = { website: "Website", instagram: "Instagram", tiktok: "TikTok", logo: "Logo", cover: "Cover" };

type Candidate = BrandDetail["website"]["candidates"][number];
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
  if (field === "logo" || field === "cover") return c.reason;
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
  if (field === "website") return c.value.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return c.source;
}

/**
 * One field on the brand page: every candidate research checked (and every value a reviewer typed),
 * the chosen one marked, "Use this" on the others, and a box for the reviewer's own value.
 */
export function FieldSection({ brandId, field, section, canEdit }: { brandId: string; field: ReviewField; section: BrandDetail["website"]; canEdit: boolean }) {
  const image = field === "logo" || field === "cover";
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-headline text-label">{TITLE[field]}</h2>
      {section.candidates.length === 0 ? (
        <p className="text-callout text-label-secondary">Nothing found yet.{canEdit ? " Type one below." : ""}</p>
      ) : (
        <ListGroup>
          {section.candidates.map((c, i) => {
            const chosen = c.id === section.selectedCandidateId;
            return (
              <ListRow
                key={c.id}
                first={i === 0}
                icon={
                  image ? (
                    // A remote image at its own address: the reviewer sees exactly what will be exported.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.value}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className={field === "logo" ? "size-10 shrink-0 rounded-lg bg-fill object-cover" : "h-10 w-[3.6rem] shrink-0 rounded-lg bg-fill object-cover"}
                    />
                  ) : undefined
                }
                title={
                  <span className="flex items-center gap-2">
                    {chosen ? <Pill tone="blue">Chosen</Pill> : null}
                    <Link href={href(field, c.value)} target="_blank" rel="noreferrer" className="truncate underline-offset-4 hover:underline">
                      {name(field, c)}
                    </Link>
                  </span>
                }
                detail={detail(field, c)}
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
