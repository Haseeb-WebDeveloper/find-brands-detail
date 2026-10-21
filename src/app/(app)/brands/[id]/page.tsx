import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppPage } from "@/components/app/app-page";
import { ResearchLog } from "@/components/app/research/research-log";
import { ApproveBar } from "@/components/app/review/approve-bar";
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
      <div className="flex flex-col gap-8 pb-10">
        <ApproveBar brandId={brand.id} status={brand.status} errors={blockers.errors} warnings={blockers.warnings} canEdit={canEdit} />

        {REVIEW_FIELDS.map((field) => (
          <FieldSection key={field} brandId={brand.id} field={field} section={brand[field]} canEdit={canEdit} />
        ))}

        <BrandTextForm key={JSON.stringify(brand.text)} brandId={brand.id} initial={brand.text} canEdit={canEdit} />

        <CampaignEditor brandId={brand.id} campaigns={brand.campaigns} canEdit={canEdit} />

        <section className="flex flex-col gap-2">
          <h2 className="text-headline text-label">Pages read</h2>
          <ListGroup>
            <ListRow first title="Brand sites" detail={`${live.length} live${archived.length ? `, ${archived.length} from the Wayback Machine` : ""}`} />
          </ListGroup>
        </section>

        <ResearchLog lines={brand.log} live={researching} />
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
