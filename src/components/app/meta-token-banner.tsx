/** Spec §9: warn before Instagram checks stop working. Shown in the shell for everyone. */
export function MetaTokenBanner({ configured, daysLeft }: { configured: boolean; daysLeft: number | null }) {
  const text = !configured
    ? "Instagram checks are off: no Meta token is set. Run pnpm meta:token."
    : daysLeft !== null && daysLeft < 0
      ? "Instagram checks have stopped: the Meta token has expired. Run pnpm meta:token."
      : `The Meta token expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Run pnpm meta:token to renew it.`;
  return <div className="border-b border-separator bg-system-orange/15 px-4 py-2 text-footnote text-label">{text}</div>;
}
