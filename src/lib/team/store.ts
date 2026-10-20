import "server-only";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import type { MemberRole } from "@/lib/auth/roles";
import { INVITE_TTL_DAYS, normalizeEmail } from "@/lib/auth/pending-access";

export async function ownerCount(): Promise<number> {
  return prisma.user.count({ where: { role: "owner" } });
}

export async function findMember(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
}

export async function isMemberEmail(email: string): Promise<boolean> {
  return (await prisma.user.count({ where: { email: normalizeEmail(email) } })) > 0;
}

/** Replaces any pending invitation for the same email, so the newest role wins. */
export async function createInvitation(scope: TeamScope, email: string, role: MemberRole): Promise<void> {
  const address = normalizeEmail(email);
  await prisma.$transaction([
    prisma.invitation.updateMany({ where: { email: address, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.invitation.create({
      data: { email: address, role, invitedById: scope.userId, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000) },
    }),
  ]);
}

export async function revokeInvitationById(_scope: TeamScope, id: string): Promise<void> {
  await prisma.invitation.updateMany({ where: { id, acceptedAt: null }, data: { revokedAt: new Date() } });
}

export async function deleteMember(_scope: TeamScope, userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}

export async function setMemberRole(_scope: TeamScope, userId: string, role: MemberRole): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { role } });
}
