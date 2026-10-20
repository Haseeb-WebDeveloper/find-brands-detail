"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore, useTransition } from "react";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABEL, type MemberRole } from "@/lib/auth/roles";
import { Button } from "@/design/button";
import { cn } from "@/design/cn";
import { Icon } from "@/design/icon";
import { Menu } from "@/design/menu";
import { Segmented } from "@/design/segmented";

/** The signed-in person's mark: the first letter of their email, in a quiet circle. */
function PersonMark({ email }: { email: string | null }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-fill text-footnote font-medium text-label">
      {(email?.[0] ?? "?").toUpperCase()}
    </span>
  );
}

/**
 * The account block, copied from contractor-sites' workspace menu: the product name and the person's
 * email at the top of the sidebar, opening one menu with the theme control and Sign out.
 */
export function WorkspaceMenu({
  email,
  role,
  collapsed,
}: {
  email: string | null;
  role: MemberRole;
  /** The icon rail. The mark alone becomes the trigger. */
  collapsed?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  // `next-themes` only knows the stored choice after mounting; until then the control shows Auto.
  // false on the server and during hydration, true after — without setting state in an effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const current = mounted && (theme === "light" || theme === "dark") ? theme : "system";
  const [, start] = useTransition();

  return (
    <Menu
      align="start"
      trigger={
        <Button
          kind="plain"
          size="lg"
          aria-label="Brand Enrich: account and theme"
          title={collapsed ? "Brand Enrich" : undefined}
          className={cn("min-w-0 gap-3 text-label", collapsed ? "w-(--ds-control-lg) px-0" : "flex-1 justify-start px-2")}
        >
          <PersonMark email={email} />
          {collapsed ? null : (
            <>
              <span className="min-w-0 flex-1 truncate text-left text-headline">Brand Enrich</span>
              <Icon name="chevronExpand" className="size-4 text-label-secondary" />
            </>
          )}
        </Button>
      }
      header={
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-1 pt-1">
            <PersonMark email={email} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-headline text-label" title={email ?? undefined}>
                {email ?? "Signed in"}
              </span>
              <span className="truncate text-footnote text-label-secondary">{ROLE_LABEL[role]}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-body text-label">Theme</span>
            <Segmented
              label="Theme"
              value={current}
              onValueChange={(next) => setTheme(next)}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "Auto" },
              ]}
            />
          </div>
        </div>
      }
      groups={[[{ label: "Sign out", icon: "signOut", onSelect: () => start(() => signOut()) }]]}
    />
  );
}
