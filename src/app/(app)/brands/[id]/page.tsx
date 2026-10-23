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
import { FillAiButton } from "@/components/app/research/fill-ai-button";
import { aiAvailable } from "@/lib/ai/models";
import { canFillAi, fillLabel } from "@/lib/research/ai-fill";

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

  const busy = brand.status === "queued" || brand.status === "researching";
  // Live research; a stuck brand isn't, and can be run again.
  const researching = busy && !brand.stuck;
  // Reviewing waits for research: its steps replace candidates and campaigns as they finish.
  const canEdit = scopeCan(scope, "batches:write") && !busy;
  const fill = scopeCan(scope, "batches:write") && aiAvailable() && canFillAi(brand.status, brand.missingAi);
  const fillText = fillLabel(brand.missingAi);

  return (
    <>
      <PageHeader
        title={brand.name}
        back={{ href: `/batches/${brand.batchId}`, label: "Batch" }}
        actions={
          busy ? (
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
        {/* Keyed by brand, not by its text: a save must not reset the field being typed in next. */}
        <BrandTextForm key={brand.id} brandId={brand.id} initial={brand.text} canEdit={canEdit} />
        <CampaignEditor brandId={brand.id} campaigns={brand.campaigns} canEdit={canEdit} findMore={canEdit && aiAvailable() && brand.status === "needs_review"} />
        <div className="flex flex-col gap-3">
          <ResearchLog lines={brand.log} live={researching} defaultOpen={researching} />
          {scopeCan(scope, "batches:write") && !researching ? (
            <div className="flex flex-wrap gap-2">
              {fill ? <FillAiButton target={{ brandId: brand.id }} label={fillText} /> : null}
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
