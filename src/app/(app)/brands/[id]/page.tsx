import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppPage } from "@/components/app/app-page";
import { ResearchLog } from "@/components/app/research/research-log";
import { BrandTextForm } from "@/components/app/review/brand-text-form";
import { CampaignEditor } from "@/components/app/review/campaign-editor";
import { FieldsCard } from "@/components/app/review/fields-card";
import { ReviewBar } from "@/components/app/review/review-bar";
import { PageHeader } from "@/design/page-header";
import { Pill } from "@/design/list";
import { requireMember, scopeCan } from "@/lib/auth/scope";
import { brandTopic } from "@/lib/realtime/channels";
import { LiveRefresh } from "@/components/app/live-refresh";
import { RetryButton } from "./retry-button";
import { getBrandDetail } from "@/lib/brands/scoped";
import { progressText, progressTone } from "@/lib/brands/progress";
import { RowsLoading } from "@/components/app/shell/page-skeletons";

export const metadata: Metadata = { title: "Brand" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The review screen, built to get through a batch fast (owner, 2026-10-21): the five facts with
 * their chosen values, the campaigns as tiles, the brand details folded, and Done → next.
 */
async function Brand({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, scope] = await Promise.all([params, requireMember()]);
  if (!UUID.test(id)) notFound();
  const brand = await getBrandDetail(scope, id);
  if (!brand) notFound();

  const researching = brand.status === "queued" || brand.status === "researching";
  // Reviewing waits for research: its steps replace candidates and campaigns as they finish.
  const canEdit = scopeCan(scope, "batches:write") && !researching;

  return (
    <>
      <PageHeader
        title={brand.name}
        back={{ href: `/batches/${brand.batchId}`, label: "Batch" }}
        actions={
          researching ? (
            <Pill tone={progressTone(brand)}>{progressText(brand)}</Pill>
          ) : (
            <ReviewBar brandId={brand.id} batchId={brand.batchId} siblings={brand.siblings} status={brand.status} canEdit={canEdit} />
          )
        }
      />
      <LiveRefresh topic={brandTopic(brand.id)} />
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        {brand.error ? <p className="rounded-card bg-surface px-4 py-3 text-callout text-system-red">{brand.error}</p> : null}
        <FieldsCard brand={brand} canEdit={canEdit} />
        <CampaignEditor brandId={brand.id} campaigns={brand.campaigns} canEdit={canEdit} />
        <BrandTextForm key={JSON.stringify(brand.text)} brandId={brand.id} initial={brand.text} canEdit={canEdit} />
        <div className="flex flex-col gap-3">
          <ResearchLog lines={brand.log} live={researching} defaultOpen={researching} />
          {scopeCan(scope, "batches:write") && !researching ? (
            <div>
              <RetryButton brandId={brand.id} />
            </div>
          ) : null}
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
