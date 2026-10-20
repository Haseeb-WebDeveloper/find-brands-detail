import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignPage } from "@/design/page";
import { PageHeader } from "@/design/page-header";
import { Button } from "@/design/button";
import { Empty } from "@/design/empty";
import { requireMember, scopeCan } from "@/lib/auth/scope";
import { listBatches } from "@/lib/batches/scoped";
import { RowsLoading } from "@/components/app/shell/page-skeletons";
import { BatchTable } from "./batch-table";

export const metadata: Metadata = { title: "Batches" };

async function Batches() {
  const scope = await requireMember();
  const batches = await listBatches(scope);
  if (batches.length === 0) {
    return (
      <Empty
        icon="inbox"
        title="No batches yet. Paste this week's brands to start."
        action={
          scopeCan(scope, "batches:write") ? (
            <Button href="/batches/new" kind="filled" icon="add">
              New batch
            </Button>
          ) : undefined
        }
      />
    );
  }
  return <BatchTable rows={batches} />;
}

async function Actions() {
  const scope = await requireMember();
  return scopeCan(scope, "batches:write") ? (
    <Button href="/batches/new" kind="filled" icon="add">
      New batch
    </Button>
  ) : null;
}

export default function BatchesPage() {
  return (
    <DesignPage>
      <PageHeader
        title="Batches"
        actions={
          <Suspense fallback={null}>
            <Actions />
          </Suspense>
        }
      />
      <Suspense fallback={<RowsLoading />}>
        <Batches />
      </Suspense>
    </DesignPage>
  );
}
