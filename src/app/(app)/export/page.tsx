import type { Metadata } from "next";
import { Suspense } from "react";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/design/page-header";
import { requireMember, scopeCan } from "@/lib/auth/scope";
import { listExportGroups } from "@/lib/export/scoped";
import { RowsLoading } from "@/components/app/shell/page-skeletons";
import { ExportPanel } from "@/components/app/review/export-panel";

export const metadata: Metadata = { title: "Export" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Export({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  const [scope, { batch }] = await Promise.all([requireMember(), searchParams]);
  const groups = await listExportGroups(scope);
  return <ExportPanel groups={groups} batchId={batch && UUID.test(batch) ? batch : null} canExport={scopeCan(scope, "batches:write")} />;
}

/** Spec 2026-10-21 §2: choose batches or brands, check them, download the DB importer's CSV. */
export default function ExportPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  return (
    <AppPage>
      <PageHeader back={{ href: "/", label: "Batches" }} title="Export" />
      <Suspense fallback={<RowsLoading count={3} />}>
        <Export searchParams={searchParams} />
      </Suspense>
    </AppPage>
  );
}
