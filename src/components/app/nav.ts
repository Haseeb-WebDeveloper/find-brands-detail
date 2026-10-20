import type { IconName } from "@/design/icon";
import type { Permission } from "@/lib/auth/roles";

/** Kept out of client files on purpose: the layout filters it by permission on the server. */
export type AppNavLeaf = {
  href: string;
  label: string;
  icon: IconName;
  permission: Permission;
  tint?: string;
};

export const APP_NAV: AppNavLeaf[] = [
  { href: "/batches", label: "Batches", icon: "inbox", permission: "batches:read", tint: "text-violet-500" },
];

export const APP_NAV_FOOTER: AppNavLeaf[] = [
  { href: "/team", label: "Team", icon: "customers", permission: "team:read" },
];

export function allNavLeaves(): AppNavLeaf[] {
  return [...APP_NAV, ...APP_NAV_FOOTER];
}

export function isAppNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
