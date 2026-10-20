import type { MemberRole } from "@/lib/auth/roles";

export function removalProblem(input: { actorId: string; targetId: string; targetRole: MemberRole; ownerCount: number }): string | null {
  if (input.actorId === input.targetId) return "You can't remove yourself.";
  if (input.targetRole === "owner" && input.ownerCount <= 1) return "The team needs at least one owner.";
  return null;
}

export function roleChangeProblem(input: {
  actorId: string;
  targetId: string;
  from: MemberRole;
  to: MemberRole;
  ownerCount: number;
}): string | null {
  if (input.from === input.to) return null;
  if (input.from === "owner" && input.ownerCount <= 1) return "The team needs at least one owner.";
  return null;
}
