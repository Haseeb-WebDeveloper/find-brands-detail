import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DesignPage } from "@/design/page";
import { PageHeader } from "@/design/page-header";
import { ListGroup, ListRow, Pill } from "@/design/list";
import { sayAgo } from "@/design/ago";
import { requireMember } from "@/lib/auth/scope";
import { getBatch } from "@/lib/batches/scoped";
import { progressText, progressTone } from "@/lib/brands/progress";
import { RowsLoading } from "@/components/app/shell/page-skeletons";
import { LiveRefresh } from "@/components/app/live-refresh";
import { batchTopic } from "@/lib/realtime/channels";

export const metadata: Metadata = { title: "Batch" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Batch({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, scope] = await Promise.all([params, requireMember()]);
  if (!UUID.test(id)) notFound();
  const batch = await getBatch(scope, id);
  if (!batch) notFound();

  return (
    <>
      <PageHeader title={`Batch started ${sayAgo(batch.createdAt)}`} back={{ href: "/batches", label: "Batches" }} />
      <LiveRefresh topic={batchTopic(batch.id)} />
      <ListGroup>
        {batch.brands.map((b, i) => (
          <ListRow key={b.id} first={i === 0} href={`/brands/${b.id}`} title={b.name} trailing={<Pill tone={progressTone(b)}>{progressText(b)}</Pill>} />
        ))}
      </ListGroup>
    </>
  );
}

/** `params` is awaited inside the Suspense boundary, so the frame paints before the batch loads. */
export default function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <DesignPage>
      <Suspense fallback={<RowsLoading count={5} />}>
        <Batch params={params} />
      </Suspense>
    </DesignPage>
  );
}
