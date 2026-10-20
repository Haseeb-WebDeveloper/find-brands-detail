import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DesignPage } from "@/design/page";
import { PageHeader } from "@/design/page-header";
import { ListGroup, ListRow, Pill } from "@/design/list";
import { requireMember } from "@/lib/auth/scope";
import { getBrandDetail } from "@/lib/brands/scoped";
import { progressText, progressTone } from "@/lib/brands/progress";
import { RowsLoading } from "@/components/app/shell/page-skeletons";

export const metadata: Metadata = { title: "Brand" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TONE = { proven: "green", review: "orange", rejected: "red" } as const;
const LABEL = { proven: "Proven", review: "Needs a look", rejected: "Rejected" } as const;

async function Brand({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, scope] = await Promise.all([params, requireMember()]);
  if (!UUID.test(id)) notFound();
  const brand = await getBrandDetail(scope, id);
  if (!brand) notFound();

  const live = brand.pages.filter((p) => p.source === "live");
  const archived = brand.pages.filter((p) => p.source === "archive");
  const found = (key: "instagram" | "tiktok") => [...new Set(brand.pages.flatMap((p) => p.facts[key] ?? []))];

  return (
    <>
      <PageHeader
        title={brand.name}
        back={{ href: `/batches/${brand.batchId}`, label: "Batch" }}
        actions={<Pill tone={progressTone(brand)}>{progressText(brand)}</Pill>}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-headline text-label">Website</h2>
        {brand.website.candidates.length === 0 ? (
          <p className="text-callout text-label-secondary">No website checked yet.</p>
        ) : (
          <ListGroup>
            {brand.website.candidates.map((c, i) => (
              <ListRow
                key={c.id}
                first={i === 0}
                title={
                  <span className="flex items-center gap-2">
                    {c.id === brand.website.selectedCandidateId ? <Pill tone="blue">Chosen</Pill> : null}
                    <Link href={c.value} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      {c.value.replace(/^https?:\/\//, "")}
                    </Link>
                  </span>
                }
                detail={`${c.reason} · ${c.source}${c.evidence.archivedAt ? ` · archive copy from ${String(c.evidence.archivedAt).slice(0, 4)}` : ""}`}
                trailing={<Pill tone={TONE[c.score]}>{LABEL[c.score]}</Pill>}
              />
            ))}
          </ListGroup>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-headline text-label">Found on the brand&apos;s sites</h2>
        <ListGroup>
          <ListRow first title="Instagram" detail={found("instagram").map((h) => `@${h}`).join(", ") || "None linked"} />
          <ListRow title="TikTok" detail={found("tiktok").map((h) => `@${h}`).join(", ") || "None linked"} />
          <ListRow title="Pages read" detail={`${live.length} live${archived.length ? `, ${archived.length} from the Wayback Machine` : ""}`} />
        </ListGroup>
        <p className="text-footnote text-label-secondary">
          Instagram, TikTok, logo and cover are checked in the next build steps; this shows what the site links to.
        </p>
      </section>
    </>
  );
}

export default function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <DesignPage>
      <Suspense fallback={<RowsLoading count={5} />}>
        <Brand params={params} />
      </Suspense>
    </DesignPage>
  );
}
