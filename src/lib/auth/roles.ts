export type MemberRole = "owner" | "member";

export type Permission = "batches:read" | "batches:write" | "team:read" | "team:write";

const GRANTS: Record<MemberRole, readonly Permission[]> = {
  owner: ["batches:read", "batches:write", "team:read", "team:write"],
  member: ["batches:read", "batches:write", "team:read"],
};

export function can(role: MemberRole, permission: Permission): boolean {
  return GRANTS[role].includes(permission);
}

export const ROLE_LABEL: Record<MemberRole, string> = { owner: "Owner", member: "Member" };

export const ROLE_DESCRIPTION: Record<MemberRole, string> = {
  owner: "Researches brands and manages the team.",
  member: "Researches and reviews brands.",
};
