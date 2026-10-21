import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/design/page-header";
import { Empty } from "@/design/empty";
import { sayAgo } from "@/design/ago";
import { requireMember, scopeCan } from "@/lib/auth/scope";
import { aiAvailable } from "@/lib/ai/models";
import { listBatches, type BatchListItem } from "@/lib/batches/scoped";
import { batchTopic } from "@/lib/realtime/channels";
import { AppPage } from "@/components/app/app-page";
import { LiveRefresh } from "@/components/app/live-refresh";
import { CardsLoading } from "@/components/app/shell/page-skeletons";
import { NewBatchButton } from "@/components/app/research/new-batch-button";
import { ProgressBar } from "@/components/app/research/progress-bar";

export const metadata: Metadata = { title: "Batches" };

function statusLine(b: BatchListItem): string {
  const parts = [
    b.researching > 0 ? `${b.researching} researching` : null,
    b.brandCount - b.done - b.researching > 0 ? `${b.brandCount - b.done - b.researching} waiting` : null,
    b.needsReview > 0 ? `${b.needsReview} to review` : null,
    b.approved > 0 ? `${b.approved} approved` : null,
    b.exported > 0 ? `${b.exported} exported` : null,
    b.failed > 0 ? `${b.failed} stopped` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function BatchCard({ batch }: { batch: BatchListItem }) {
  const more = batch.brandCount - batch.names.length;
  return (
    <Link
      href={`/batches/${batch.id}`}
      className="group flex flex-col gap-3 rounded-card bg-surface p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-tint"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-title-3 text-label">
          {batch.brandCount} brand{batch.brandCount === 1 ? "" : "s"}
        </span>
        <span className="shrink-0 text-footnote text-label-secondary">{sayAgo(batch.createdAt)}</span>
      </div>
      <p className="line-clamp-2 text-callout text-label-secondary">
        {batch.names.join(", ")}
        {more > 0 ? ` and ${more} more` : ""}
      </p>
      <div className="mt-auto flex flex-col gap-1.5">
        <ProgressBar done={batch.done} total={batch.brandCount} active={batch.researching > 0} />
        <span className="text-footnote text-label-secondary">
          {batch.done}/{batch.brandCount} done · {statusLine(batch)}
        </span>
      </div>
    </Link>
  );
}

async function Batches() {
  const scope = await requireMember();
  const batches = await listBatches(scope);
  if (batches.length === 0) {
    return <Empty icon="inbox" title="No batches yet" action={<p className="text-subhead text-label-secondary">Paste this week&apos;s brands to start.</p>} />;
  }
  return (
    <>
      {/* Live while any brand in it is still being researched. */}
      {batches.filter((b) => b.done < b.brandCount).map((b) => (
        <LiveRefresh key={b.id} topic={batchTopic(b.id)} />
      ))}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {batches.map((b) => (
          <BatchCard key={b.id} batch={b} />
        ))}
      </div>
    </>
  );
}

async function Actions() {
  const scope = await requireMember();
  return scopeCan(scope, "batches:write") ? <NewBatchButton aiOn={aiAvailable()} /> : null;
}

export default function HomePage() {
  return (
    <AppPage>
      <PageHeader
        title="Batches"
        actions={
          <Suspense fallback={null}>
            <Actions />
          </Suspense>
        }
      />
      <Suspense fallback={<CardsLoading />}>
        <Batches />
      </Suspense>
    </AppPage>
  );
}
