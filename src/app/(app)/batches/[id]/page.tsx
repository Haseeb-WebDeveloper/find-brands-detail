import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/design/page-header";
import { Button } from "@/design/button";
import { Pill } from "@/design/list";
import { sayAgo } from "@/design/ago";
import { requireMember } from "@/lib/auth/scope";
import { getBatch, type BrandRow } from "@/lib/batches/scoped";
import { progressText, progressTone } from "@/lib/brands/progress";
import { RESEARCH_STEPS, stepNumber } from "@/lib/research/steps";
import { batchTopic } from "@/lib/realtime/channels";
import { AppPage } from "@/components/app/app-page";
import { LiveRefresh } from "@/components/app/live-refresh";
import { CardsLoading } from "@/components/app/shell/page-skeletons";
import { ResearchLog } from "@/components/app/research/research-log";
import { ProgressBar } from "@/components/app/research/progress-bar";
import { BatchTable } from "@/components/app/review/batch-table";

export const metadata: Metadata = { title: "Batch" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Steps finished: all of them once research is done, the ones before the current step while it runs. */
function stepsDone(b: BrandRow): number {
  if (b.status === "queued") return 0;
  if (b.status !== "researching") return RESEARCH_STEPS.length;
  return b.currentStep ? stepNumber(b.currentStep) - 1 : 0;
}

function BrandCard({ brand }: { brand: BrandRow }) {
  return (
    <Link href={`/brands/${brand.id}`} className="flex flex-col gap-3 rounded-card bg-surface p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-headline text-label">{brand.name}</span>
        <Pill tone={progressTone(brand)}>{brand.error ? "Stopped" : brand.status === "researching" ? "Researching" : progressText(brand)}</Pill>
      </div>
      <p className="line-clamp-2 min-h-[2lh] text-callout text-label-secondary">{brand.lastLog ?? (brand.status === "queued" ? "Waiting to start…" : "")}</p>
      <ProgressBar done={stepsDone(brand)} total={RESEARCH_STEPS.length} active={brand.status === "researching"} />
    </Link>
  );
}

async function Batch({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, scope] = await Promise.all([params, requireMember()]);
  if (!UUID.test(id)) notFound();
  const batch = await getBatch(scope, id);
  if (!batch) notFound();
  const running = batch.brands.some((b) => b.status === "queued" || b.status === "researching");
  const done = batch.brands.filter((b) => b.status !== "queued" && b.status !== "researching").length;
  const firstToReview = batch.brands.find((b) => b.status === "needs_review");

  return (
    <>
      <PageHeader
        title={`${batch.brands.length} brand${batch.brands.length === 1 ? "" : "s"}`}
        back={{ href: "/", label: "Batches" }}
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden text-subhead text-label-secondary md:inline">
              {sayAgo(batch.createdAt)} · {done}/{batch.brands.length} researched
            </span>
            <Button kind="gray" icon="download" href={`/export?batch=${batch.id}`}>
              Export
            </Button>
            {firstToReview ? (
              <Button kind="filled" href={`/brands/${firstToReview.id}`}>
                Start reviewing
              </Button>
            ) : null}
          </div>
        }
      />
      <LiveRefresh topic={batchTopic(batch.id)} />
      <div className="flex flex-col gap-8">
        {running ? (
          // While research runs, what each unfinished brand is doing; the table has their results.
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {batch.brands
              .filter((b) => b.status === "queued" || b.status === "researching")
              .map((b) => (
                <BrandCard key={b.id} brand={b} />
              ))}
          </div>
        ) : null}
        <BatchTable brands={batch.brands} />
        <ResearchLog lines={batch.log} showBrand live={running} defaultOpen={running} />
      </div>
    </>
  );
}

/** `params` is awaited inside the Suspense boundary, so the frame paints before the batch loads. */
export default function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AppPage>
      <Suspense fallback={<CardsLoading count={3} />}>
        <Batch params={params} />
      </Suspense>
    </AppPage>
  );
}
