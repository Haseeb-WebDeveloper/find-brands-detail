"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getTeamScope, memberTag, scopeCan } from "@/lib/auth/scope";
import type { MemberRole } from "@/lib/auth/roles";
import { removalProblem, roleChangeProblem } from "@/lib/team/rules";
import { createInvitation, deleteMember, findMember, isMemberEmail, ownerCount, revokeInvitationById, setMemberRole } from "@/lib/team/store";

type Result = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES: MemberRole[] = ["owner", "member"];

export async function inviteMember(email: string, role: MemberRole): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "team:write")) return { ok: false, error: "Only owners can invite people." };
  const address = email.trim().toLowerCase();
  if (!address.includes("@") || address.length > 254) return { ok: false, error: "That doesn't look like an email address." };
  if (!ROLES.includes(role)) return { ok: false, error: "Pick a role." };
  if (await isMemberEmail(address)) return { ok: false, error: "That person is already on the team." };
  await createInvitation(scope, address, role);
  revalidatePath("/team");
  return { ok: true };
}

export async function revokeInvitation(id: string): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "team:write")) return { ok: false, error: "Only owners can revoke invitations." };
  if (!UUID.test(id)) return { ok: false, error: "That invitation doesn't exist." };
  await revokeInvitationById(scope, id);
  revalidatePath("/team");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "team:write")) return { ok: false, error: "Only owners can remove people." };
  if (!UUID.test(userId)) return { ok: false, error: "That person isn't on the team." };
  const target = await findMember(userId);
  if (!target) return { ok: false, error: "That person isn't on the team." };
  const problem = removalProblem({ actorId: scope.userId, targetId: target.id, targetRole: target.role, ownerCount: await ownerCount() });
  if (problem) return { ok: false, error: problem };
  await deleteMember(scope, target.id);
  revalidateTag(memberTag(target.id), { expire: 0 });
  revalidatePath("/team");
  return { ok: true };
}

export async function changeMemberRole(userId: string, role: MemberRole): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "team:write")) return { ok: false, error: "Only owners can change roles." };
  if (!UUID.test(userId) || !ROLES.includes(role)) return { ok: false, error: "That change isn't valid." };
  const target = await findMember(userId);
  if (!target) return { ok: false, error: "That person isn't on the team." };
  const problem = roleChangeProblem({ actorId: scope.userId, targetId: target.id, from: target.role, to: role, ownerCount: await ownerCount() });
  if (problem) return { ok: false, error: problem };
  await setMemberRole(scope, target.id, role);
  revalidateTag(memberTag(target.id), { expire: 0 });
  revalidatePath("/team");
  return { ok: true };
}
