import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/design/page-header";
import { Button } from "@/design/button";
import { requireMember, scopeCan } from "@/lib/auth/scope";
import { getBatch } from "@/lib/batches/scoped";
import { batchTopic } from "@/lib/realtime/channels";
import { AppPage } from "@/components/app/app-page";
import { LiveRefresh } from "@/components/app/live-refresh";
import { CardsLoading } from "@/components/app/shell/page-skeletons";
import { ResearchLog } from "@/components/app/research/research-log";
import { ProgressBar } from "@/components/app/research/progress-bar";
import { BatchList } from "@/components/app/review/batch-list";
import { ExportButton } from "@/components/app/review/export-dialog";
import { FillAiButton } from "@/components/app/research/fill-ai-button";
import { aiAvailable } from "@/lib/ai/models";
import { canFillAi } from "@/lib/research/ai-fill";

export const metadata: Metadata = { title: "Batch" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Batch({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, scope] = await Promise.all([params, requireMember()]);
  if (!UUID.test(id)) notFound();
  const batch = await getBatch(scope, id);
  if (!batch) notFound();
  const total = batch.brands.length;
  const running = batch.brands.some((b) => (b.status === "queued" || b.status === "researching") && !b.stuck);
  const stuck = batch.brands.filter((b) => b.stuck).length;
  const toFill = scopeCan(scope, "batches:write") && aiAvailable() ? batch.brands.filter((b) => canFillAi(b.status, b.missingAi)).length : 0;
  const researched = batch.brands.filter((b) => b.status !== "queued" && b.status !== "researching").length;
  const reviewed = batch.brands.filter((b) => b.status === "approved" || b.status === "exported").length;
  const next = batch.brands.find((b) => b.status === "needs_review");
  const day = new Date(batch.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <>
      <PageHeader
        title={`Batch of ${day}`}
        back={{ href: "/", label: "Batches" }}
        actions={
          <div className="flex items-center gap-2">
            {toFill > 0 && !running ? <FillAiButton target={{ batchId: batch.id }} label={`Fill in missing AI parts (${toFill})`} /> : null}
            {scopeCan(scope, "batches:write") ? <ExportButton brands={batch.brands.map((b) => ({ id: b.id, name: b.name, status: b.status }))} /> : null}
            {next ? (
              <Button kind="filled" href={`/brands/${next.id}`}>
                {reviewed > 0 ? "Continue reviewing" : "Start reviewing"}
              </Button>
            ) : null}
          </div>
        }
      />
      <LiveRefresh topic={batchTopic(batch.id)} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-callout text-label-secondary">
            {total} brand{total === 1 ? "" : "s"}
            {running ? ` · ${researched} researched` : ""} · {reviewed} reviewed
            {stuck > 0 ? <span className="text-system-red"> · {stuck} stuck: open {stuck === 1 ? "it" : "each"} and run research again</span> : null}
          </p>
          {running ? <ProgressBar done={researched} total={total} active /> : null}
        </div>
        <BatchList brands={batch.brands} />
        <ResearchLog lines={batch.log} showBrand live={running} defaultOpen={false} />
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
