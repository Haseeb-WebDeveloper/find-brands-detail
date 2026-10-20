import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignPage } from "@/design/page";
import { PageHeader } from "@/design/page-header";
import { requireMember, scopeCan } from "@/lib/auth/scope";
import { listTeam } from "@/lib/team/scoped";
import { RowsLoading } from "@/components/app/shell/page-skeletons";
import { InviteButton, TeamList } from "./team-list";

export const metadata: Metadata = { title: "Team" };

async function Team() {
  const scope = await requireMember();
  const team = await listTeam(scope);
  return <TeamList {...team} selfId={scope.userId} canWrite={scopeCan(scope, "team:write")} />;
}

async function Actions() {
  const scope = await requireMember();
  return scopeCan(scope, "team:write") ? <InviteButton /> : null;
}

export default function TeamPage() {
  return (
    <DesignPage>
      <PageHeader
        title="Team"
        actions={
          <Suspense fallback={null}>
            <Actions />
          </Suspense>
        }
      />
      <Suspense fallback={<RowsLoading count={3} />}>
        <Team />
      </Suspense>
    </DesignPage>
  );
}
