import "server-only";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import type { MemberRole } from "@/lib/auth/roles";

export type TeamMember = { id: string; email: string; role: MemberRole; createdAt: string };
export type PendingInvite = { id: string; email: string; role: MemberRole; expiresAt: string };

export async function listTeam(_scope: TeamScope): Promise<{ members: TeamMember[]; invites: PendingInvite[] }> {
  const [users, invites] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.invitation.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    members: users.map((u) => ({ id: u.id, email: u.email, role: u.role, createdAt: u.createdAt.toISOString() })),
    invites: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() })),
  };
}
