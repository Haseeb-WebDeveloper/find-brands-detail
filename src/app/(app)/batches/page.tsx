import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DesignPage } from "@/design/page";
import { PageHeader } from "@/design/page-header";
import { Button } from "@/design/button";
import { Empty } from "@/design/empty";
import { DataTable, type TableColumn } from "@/design/table";
import { Pill } from "@/design/list";
import { sayAgo } from "@/design/ago";
import { requireMember, scopeCan } from "@/lib/auth/scope";
import { listBatches, type BatchListItem } from "@/lib/batches/scoped";
import { RowsLoading } from "@/components/app/shell/page-skeletons";

export const metadata: Metadata = { title: "Batches" };

const COLUMNS: TableColumn<BatchListItem>[] = [
  { key: "created", label: "Started", width: 180, cell: (b) => <Link href={`/batches/${b.id}`}>{sayAgo(b.createdAt)}</Link> },
  { key: "by", label: "By", width: 220, grow: true, cell: (b) => b.createdBy ?? "—" },
  { key: "brands", label: "Brands", width: 100, align: "end", cell: (b) => b.brandCount },
  { key: "review", label: "Needs review", width: 140, align: "end", cell: (b) => (b.needsReview > 0 ? <Pill tone="orange">{b.needsReview}</Pill> : "—") },
];

async function BatchTable() {
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
  return <DataTable label="Batches" rows={batches} rowKey={(b) => b.id} columns={COLUMNS} />;
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
        <BatchTable />
      </Suspense>
    </DesignPage>
  );
}
