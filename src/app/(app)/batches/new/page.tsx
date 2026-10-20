import type { Metadata } from "next";
import { DesignPage } from "@/design/page";
import { PageHeader } from "@/design/page-header";
import { requireMember } from "@/lib/auth/scope";
import { NewBatchForm } from "./new-batch-form";

export const metadata: Metadata = { title: "New batch" };

export default async function NewBatchPage() {
  await requireMember();
  return (
    <DesignPage>
      <PageHeader title="New batch" back={{ href: "/batches", label: "Batches" }} />
      <NewBatchForm />
    </DesignPage>
  );
}
