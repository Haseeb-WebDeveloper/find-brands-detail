import Link from "next/link";
import { cn } from "@/design/cn";
import type { BrandRow } from "@/lib/batches/scoped";
import { RESEARCH_STEPS } from "@/lib/research/steps";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const host = (url: string) => url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
const waiting = (b: BrandRow) => b.status === "queued" || b.status === "researching";

function Handle({ value }: { value: BrandRow["chosen"]["instagram"] }) {
  if (!value) return <span className="text-label-tertiary">—</span>;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-callout text-label">@{value.value}</span>
      {value.followers !== null ? <span className="text-footnote text-label-secondary">{compact.format(value.followers)} followers</span> : null}
    </span>
  );
}

function Status({ b }: { b: BrandRow }) {
  if (b.error) return <span className="text-subhead text-system-red">Stopped</span>;
  if (b.status === "queued") return <span className="text-subhead text-label-tertiary">Waiting</span>;
  if (b.status === "researching") {
    const step = RESEARCH_STEPS.find((s) => s.id === b.currentStep);
    return <span className="text-subhead text-tint-text">{step ? step.label : "Starting"}…</span>;
  }
  if (b.status === "exported") return <span className="text-subhead text-label-secondary">Exported</span>;
  if (b.status === "approved") return <span className="text-subhead font-medium text-system-green">✓ Reviewed</span>;
  return <span className="rounded-full bg-tint px-3 py-1 text-subhead font-medium text-tint-contrast">Review</span>;
}

/**
 * The batch: one row per brand with what was found — logo, website, Instagram, TikTok, campaigns —
 * and where it stands. A row opens the brand (owner, 2026-10-21: no tabs, see it all at once).
 */
export function BatchList({ brands }: { brands: BrandRow[] }) {
  const grid = "grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_5rem_8rem] items-center gap-x-4";
  return (
    <div className="flex flex-col rounded-card bg-surface">
      <div className={cn(grid, "border-b border-separator px-4 py-2.5 text-footnote text-label-secondary")}>
        <span>Brand</span>
        <span>Instagram</span>
        <span className="hidden md:block">TikTok</span>
        <span className="hidden text-center md:block">Campaigns</span>
        <span className="text-right">Status</span>
      </div>
      {brands.map((b) => {
        const logo = b.chosen.logo?.value ?? null;
        const site = b.chosen.website?.value ?? null;
        return (
          <Link key={b.id} href={`/brands/${b.id}`} className={cn(grid, "border-b border-separator px-4 py-3 transition-colors last:border-b-0 hover:bg-fill/50")}>
            <span className="flex min-w-0 items-center gap-3">
              {logo ? (
                // A remote image at its own address.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-10 shrink-0 rounded-full bg-fill object-cover" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-fill text-subhead font-medium text-label-secondary">{b.name.slice(0, 1).toUpperCase()}</span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body font-medium text-label">{b.name}</span>
                <span className="truncate text-footnote text-label-secondary">{site ? host(site) : waiting(b) ? "" : "No website"}</span>
              </span>
            </span>
            <span className="min-w-0">{waiting(b) ? null : <Handle value={b.chosen.instagram} />}</span>
            <span className="hidden min-w-0 md:block">{waiting(b) ? null : <Handle value={b.chosen.tiktok} />}</span>
            <span className={cn("hidden text-center text-callout tabular-nums md:block", b.campaigns.total < 3 ? "text-system-orange" : "text-label")}>
              {waiting(b) ? "" : b.campaigns.total}
            </span>
            <span className="flex justify-end">
              <Status b={b} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
