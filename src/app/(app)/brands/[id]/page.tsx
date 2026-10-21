import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppPage } from "@/components/app/app-page";
import { ResearchLog } from "@/components/app/research/research-log";
import { ReviewPanel } from "@/components/app/review/review-panel";
import { BrandTextForm } from "@/components/app/review/brand-text-form";
import { CampaignEditor } from "@/components/app/review/campaign-editor";
import { FieldSection } from "@/components/app/review/field-section";
import { PageHeader } from "@/design/page-header";
import { ListGroup, ListRow, Pill } from "@/design/list";
import { requireMember, scopeCan } from "@/lib/auth/scope";
import { brandTopic } from "@/lib/realtime/channels";
import { LiveRefresh } from "@/components/app/live-refresh";
import { RetryButton } from "./retry-button";
import { getBrandDetail } from "@/lib/brands/scoped";
import { progressText, progressTone } from "@/lib/brands/progress";
import { getReviewState } from "@/lib/review/scoped";
import { approvalBlockers } from "@/lib/review/blockers";
import { buildChecklist } from "@/lib/review/checklist";
import { REVIEW_FIELDS } from "@/lib/export/row";
import { RowsLoading } from "@/components/app/shell/page-skeletons";

export const metadata: Metadata = { title: "Brand" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Brand({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, scope] = await Promise.all([params, requireMember()]);
  if (!UUID.test(id)) notFound();
  const [brand, state] = await Promise.all([getBrandDetail(scope, id), getReviewState(scope, id)]);
  if (!brand || !state) notFound();

  const researching = brand.status === "queued" || brand.status === "researching";
  // Reviewing waits for research: its steps replace candidates and campaigns as they finish.
  const canEdit = scopeCan(scope, "batches:write") && !researching;
  const blockers = approvalBlockers(state);
  const score = (f: (typeof REVIEW_FIELDS)[number]) => brand[f].candidates.find((c) => c.id === brand[f].selectedCandidateId)?.score ?? null;
  const checklist = buildChecklist({
    fields: { website: score("website"), instagram: score("instagram"), tiktok: score("tiktok"), logo: score("logo"), cover: score("cover") },
    text: brand.text,
    campaigns: { approved: brand.campaigns.filter((c) => c.status === "approved").length, proposed: brand.campaigns.filter((c) => c.status === "proposed").length },
  });
  const live = brand.pages.filter((p) => p.source === "live");
  const archived = brand.pages.filter((p) => p.source === "archive");

  return (
    <>
      <PageHeader
        title={brand.name}
        back={{ href: `/batches/${brand.batchId}`, label: "Batch" }}
        actions={
          <div className="flex items-center gap-2">
            <Pill tone={progressTone(brand)}>{progressText(brand)}</Pill>
            {scopeCan(scope, "batches:write") && !researching ? <RetryButton brandId={brand.id} /> : null}
          </div>
        }
      />
      <LiveRefresh topic={brandTopic(brand.id)} />
      {/* The work on the left, the checklist and Approve beside it, always in view (spec 2026-10-21 §2). */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="lg:order-2 lg:self-stretch">
          <ReviewPanel brandId={brand.id} status={brand.status} items={checklist} errors={blockers.errors} warnings={blockers.warnings} canEdit={canEdit} />
        </div>
      <div className="flex min-w-0 flex-col gap-10 lg:order-1">
        {REVIEW_FIELDS.map((field) => (
          <FieldSection key={field} brandId={brand.id} field={field} section={brand[field]} canEdit={canEdit} />
        ))}

        <BrandTextForm key={JSON.stringify(brand.text)} brandId={brand.id} initial={brand.text} canEdit={canEdit} />

        <CampaignEditor brandId={brand.id} campaigns={brand.campaigns} canEdit={canEdit} />

        <section className="flex flex-col gap-2">
          <h2 className="text-title-3 text-label">Pages read</h2>
          <ListGroup>
            <ListRow first title="Brand sites" detail={`${live.length} live${archived.length ? `, ${archived.length} from the Wayback Machine` : ""}`} />
          </ListGroup>
        </section>

        <ResearchLog lines={brand.log} live={researching} defaultOpen={researching} />
      </div>
      </div>
    </>
  );
}

export default function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AppPage>
      <Suspense fallback={<RowsLoading count={5} />}>
        <Brand params={params} />
      </Suspense>
    </AppPage>
  );
}
