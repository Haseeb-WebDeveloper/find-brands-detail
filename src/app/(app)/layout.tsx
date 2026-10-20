import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { getTeamScope, requireMember, scopeCan } from "@/lib/auth/scope";
import { AppShell, type ShellNav } from "@/components/app/app-shell";
import { allNavLeaves } from "@/components/app/nav";

export const metadata: Metadata = { title: { default: "Batches", template: "%s · Brand Enrich" } };

async function loadNav(): Promise<ShellNav | null> {
  const scope = await getTeamScope();
  if (!scope) return null;
  return {
    allowedHrefs: allNavLeaves().filter((l) => scopeCan(scope, l.permission)).map((l) => l.href),
    badges: {},
    email: scope.email,
    role: scope.role,
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
