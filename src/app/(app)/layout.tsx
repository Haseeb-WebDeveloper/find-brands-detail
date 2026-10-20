import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { getTeamScope, requireMember, scopeCan } from "@/lib/auth/scope";
import { AppShell, type ShellNav } from "@/components/app/app-shell";
import { metaTokenStatus } from "@/lib/instagram/token";

export const metadata: Metadata = { title: { default: "Batches", template: "%s · Brand Enrich" } };

async function loadNav(): Promise<ShellNav | null> {
  const scope = await getTeamScope();
  if (!scope) return null;
  return {
    email: scope.email,
    role: scope.role,
    canSeeTeam: scopeCan(scope, "team:read"),
    metaToken: metaTokenStatus(),
  };
}

/** Redirects a signed-out visitor or non-member; renders nothing. */
async function ShellGate() {
  await requireMember();
  return null;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell nav={loadNav()}>
      <Suspense fallback={null}>
        <ShellGate />
      </Suspense>
      {children}
    </AppShell>
  );
}
