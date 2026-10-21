import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/lib/auth/session";
import { can, type MemberRole, type Permission } from "@/lib/auth/roles";

declare const scopeBrand: unique symbol;

/**
 * Who is asking, resolved from the verified session and the users table. Branded so it can only be
 * produced here: every reader, store function and action takes a TeamScope, which proves the caller
 * was authenticated AND is a team member. Prisma bypasses RLS, so this is the authorization boundary.
 */
export type TeamScope = {
  readonly userId: string;
  readonly email: string;
  readonly role: MemberRole;
  readonly [scopeBrand]: true;
};

/** The tag that clears a member's cached row when the team changes (team/actions.ts). */
export const memberTag = (userId: string) => `member:${userId}`;

/**
 * A member's row, kept for a few minutes: every page asks, and each ask is a ~200ms round trip to the
 * database (measured 2026-10-21). Removing a member or changing a role clears it at once (`memberTag`).
 */
async function cachedMember(userId: string) {
  "use cache";
  cacheLife("standard");
  cacheTag(memberTag(userId));
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
}

export const getTeamScope = cache(async (): Promise<TeamScope | null> => {
  const session = await currentSession();
  if (!session) return null;
  // Not cached when missing: a first sign-in creates the row moments later (pending-access.ts).
  const user =
    (await cachedMember(session.userId)) ??
    (await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, role: true } }));
  if (!user) return null;
  return { userId: user.id, email: user.email, role: user.role } as TeamScope;
});

/** For pages and layouts: a signed-out visitor or a non-member goes to /login. */
export async function requireMember(): Promise<TeamScope> {
  const scope = await getTeamScope();
  if (!scope) redirect("/login");
  return scope;
}

export function scopeCan(scope: TeamScope, permission: Permission): boolean {
  return can(scope.role, permission);
}
