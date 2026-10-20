import "server-only";
import { prisma } from "@/lib/prisma";

export const INVITE_TTL_DAYS = 7;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function pendingWhere(email: string) {
  return { email: normalizeEmail(email), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } };
}

/** Whether a magic link may CREATE an account for this email (shouldCreateUser). */
export async function hasPendingInvite(email: string): Promise<boolean> {
  return (await prisma.invitation.count({ where: pendingWhere(email) })) > 0;
}

/**
 * Runs on every sign-in. An existing member stays a member. A new account with a pending
 * invitation becomes a member with the invited role and the invitation is marked accepted.
 * Anyone else is not a member.
 */
export async function claimAccess(session: { userId: string; email: string | null }): Promise<"member" | "none"> {
  const existing = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } });
  if (existing) return "member";
  if (!session.email) return "none";

  const invite = await prisma.invitation.findFirst({ where: pendingWhere(session.email), orderBy: { createdAt: "desc" } });
  if (!invite) return "none";

  await prisma.$transaction([
    prisma.user.create({ data: { id: session.userId, email: normalizeEmail(session.email), role: invite.role } }),
    prisma.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
  ]);
  return "member";
}
