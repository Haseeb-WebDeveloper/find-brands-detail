import { Pill } from "@/design/list";
import { cn } from "@/design/cn";
import type { CampaignCard } from "@/lib/brands/scoped";

const TONE = { proven: "green", review: "orange", rejected: "red" } as const;
const LABEL = { proven: "Proven", review: "Needs a look", rejected: "Rejected" } as const;
/** The DB importer's limit; descriptions are asked for at 450 to leave room. */
const MAX = 500;

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const month = (date: string | null) =>
  date ? new Date(`${date.length === 4 ? `${date}-01` : date}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : null;

/**
 * The proposed campaigns, newest first, as the DB will show them: the chosen image in the campaign
 * tile's 200:236 frame, the title and the description with its length against the importer's limit.
 * Editing, approving and reordering come with the review screens.
 */
export function CampaignCards({ campaigns }: { campaigns: CampaignCard[] }) {
  if (campaigns.length === 0) return <p className="text-callout text-label-secondary">No campaigns found yet. Add them by hand during review.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {campaigns.map((c) => {
        const chosen = c.images.find((i) => i.selected) ?? null;
        const others = c.images.filter((i) => !i.selected);
        return (
          <article key={c.id} className="flex gap-3 rounded-card bg-surface p-3">
            <div className="w-28 shrink-0">
              {chosen ? (
                <a href={chosen.url} target="_blank" rel="noreferrer" title={chosen.reason}>
                  {/* A remote image at its own address: the reviewer sees exactly what will be exported. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={chosen.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[200/236] w-full rounded-lg bg-fill object-cover" />
                </a>
              ) : (
                <div className="flex aspect-[200/236] w-full items-center justify-center rounded-lg bg-fill p-2 text-center text-footnote text-label-secondary">No usable image</div>
              )}
              {chosen ? (
                <div className="mt-1.5">
                  <Pill tone={TONE[chosen.score]}>{chosen.sourceKind === "third_party" ? "Third-party" : LABEL[chosen.score]}</Pill>
                </div>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-headline text-label">
                  <span className="mr-1.5 text-label-tertiary tabular-nums">{c.position}.</span>
                  {c.title}
                </h3>
                {month(c.date) ? <span className="shrink-0 text-footnote text-label-secondary">{month(c.date)}</span> : null}
              </div>
              <p className="text-callout text-label">{c.description || <span className="text-label-secondary">No description yet.</span>}</p>
              <p className={cn("text-footnote tabular-nums", c.description.length > 450 ? "text-system-orange" : "text-label-secondary")}>
                {c.description.length} / {MAX} characters
              </p>
              {c.note ? <p className="text-footnote text-system-orange">{c.note}</p> : null}
              {others.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {others.map((i) => (
                    <a key={i.id} href={i.url} target="_blank" rel="noreferrer" title={`${LABEL[i.score]}: ${i.reason}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={i.url} alt="" loading="lazy" referrerPolicy="no-referrer" className={cn("size-10 rounded-md bg-fill object-cover", i.score === "rejected" && "opacity-40")} />
                    </a>
                  ))}
                </div>
              ) : null}
              {c.sources.length > 0 ? (
                <p className="truncate text-footnote text-label-secondary">
                  Sources:{" "}
                  {c.sources.map((u, n) => (
                    <span key={u}>
                      {n > 0 ? ", " : ""}
                      <a href={u} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                        {host(u)}
                      </a>
                    </span>
                  ))}
                </p>
              ) : (
                <p className="text-footnote text-label-secondary">Source: the brand&apos;s Instagram posts.</p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
