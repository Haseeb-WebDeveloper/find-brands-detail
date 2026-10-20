import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/design/page-header";
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

  return (
    <>
      <PageHeader
        title={`${batch.brands.length} brand${batch.brands.length === 1 ? "" : "s"}`}
        back={{ href: "/", label: "Batches" }}
        actions={<span className="text-callout text-label-secondary">Started {sayAgo(batch.createdAt)} · {done}/{batch.brands.length} done</span>}
      />
      <LiveRefresh topic={batchTopic(batch.id)} />
      <div className="flex flex-col gap-8 pb-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {batch.brands.map((b) => (
            <BrandCard key={b.id} brand={b} />
          ))}
        </div>
        <ResearchLog lines={batch.log} showBrand live={running} />
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
