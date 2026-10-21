import type { Metadata } from "next";
import { Suspense } from "react";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/design/page-header";
import { requireMember, scopeCan } from "@/lib/auth/scope";
import { listExportable } from "@/lib/export/scoped";
import { RowsLoading } from "@/components/app/shell/page-skeletons";
import { ExportPanel } from "@/components/app/review/export-panel";

export const metadata: Metadata = { title: "Export" };

async function Export() {
  const scope = await requireMember();
  const brands = await listExportable(scope);
  return <ExportPanel brands={brands} canExport={scopeCan(scope, "batches:write")} />;
}

/** Spec §8 screen 6: approved brands to the DB importer's CSV. */
export default function ExportPage() {
  return (
    <AppPage>
      <PageHeader back={{ href: "/", label: "Batches" }} title="Export" />
      <div className="pb-10">
        <Suspense fallback={<RowsLoading count={3} />}>
          <Export />
        </Suspense>
      </div>
    </AppPage>
  );
}
