import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./icon";

/**
 * THE GROUPED LIST: rows in a solid rounded card. Settings, notifications, integrations, a record's
 * details, a short list of jobs.
 *
 * ONE GEOMETRY, AND IT IS ARITHMETIC (owner, 2026-10-13, caught by eye). A 28px icon in a 44px row
 * sits 8px from the row's top; with a 16px side inset the icon in the first row was twice as far
 * from the left edge as from the top, crowding the card's corner. So the card carries 4px top and
 * bottom, and the side inset is COMPUTED from the row height: (row - icon) / 2 + 4. The icon is the
 * same distance from the top edge as from the left, 12px under a mouse and 16px under a finger.
 *
 * A TWO-LINE row (`detail`) is a fixed 48px with a 12px inset, and takes no icon: the record's name
 * and its one fact are the row.
 *
 * A ROW WITH A BODY (`body`) grows to fit it: a report's first lines, a note's opening. 16px all round,
 * the trailing figure on the title's line. This is how a record page lists what happened (owner,
 * 2026-10-14: raised cards, not tables and not lines across a flat page).
 *
 * The separator starts where the words start, not at the card's edge: it divides the rows' words,
 * and the icons stand as a column of their own.
 */
export function ListGroup({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("overflow-hidden rounded-card bg-surface py-1", className)}>{children}</div>;
}

/**
 * A row's icon: a plain line symbol in the secondary colour, in a 28px box so the row geometry above
 * holds. NOT a coloured tile: iOS Settings tiles read as a consumer toy in a work tool (owner,
 * 2026-10-13). The icon says what the row is; the words carry it.
 */
export function ListIcon({ name }: { name: IconName }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center text-label-secondary">
      <Icon name={name} className="size-5" />
    </span>
  );
}

export function ListRow({
  icon,
  title,
  detail,
  trailing,
  first = false,
  onClick,
  href,
  body,
}: {
  icon?: ReactNode;
  title: ReactNode;
  /** One short line under the title, only when it says something the title does not. */
  detail?: ReactNode;
  trailing?: ReactNode;
  /** The first row draws no separator above it. */
  first?: boolean;
  onClick?: () => void;
  /** The row opens something. A link, so it can be opened in a new tab and read by a screen reader. */
  href?: string;
  /** More under the title: a few lines of text, a warning. The row grows to fit. */
  body?: ReactNode;
}) {
  const pressable = Boolean(onClick || href);
  if (body !== undefined) {
    const rich = (
      <div className={cn("flex min-w-0 flex-col gap-1 px-4 py-3", !first && "border-t border-separator")}>
        <div className="flex min-w-0 items-baseline gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body font-medium text-label">{title}</span>
            {detail ? <span className="truncate text-subhead text-label-secondary">{detail}</span> : null}
          </div>
          {trailing ? <div className="flex shrink-0 items-center gap-2 self-center">{trailing}</div> : null}
        </div>
        {body}
      </div>
    );
    const shell = cn("block w-full text-left", pressable && "cursor-pointer transition-colors duration-100 active:bg-fill");
    if (href) return <Link href={href} className={shell}>{rich}</Link>;
    if (onClick) return <button type="button" onClick={onClick} className={shell}>{rich}</button>;
    return <div className={shell}>{rich}</div>;
  }
  const height = detail ? "min-h-12" : "min-h-(--ds-row)";
  const className = cn(
    "flex w-full items-center gap-3 text-left",
    height,
    detail ? "pl-3" : "pl-[calc((var(--ds-row)-1.75rem)/2+4px)]",
    pressable && "cursor-pointer transition-colors duration-100 active:bg-fill",
  );
  const inner = (
    <>
      {icon}
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 self-stretch",
          height,
          detail ? "pr-3" : "pr-[calc((var(--ds-row)-1.75rem)/2+4px)]",
          !first && "border-t border-separator",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body text-label">{title}</span>
          {detail ? <span className="truncate text-subhead text-label-secondary">{detail}</span> : null}
        </div>
        {trailing}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}

/**
 * A STATUS AS A SMALL COLOURED LABEL: Late in red, Paid in green, Waiting in blue. The one place a
 * card row spends colour, so the eye lands on what needs somebody. Ordinary states may stay grey.
 */
const PILL: Record<"red" | "orange" | "green" | "blue" | "grey", string> = {
  red: "bg-system-red/15 text-system-red",
  orange: "bg-system-orange/15 text-system-orange",
  green: "bg-system-green/15 text-system-green",
  blue: "bg-system-blue/15 text-system-blue",
  grey: "bg-fill text-label-secondary",
};

export function Pill({ tone, children }: { tone: keyof typeof PILL; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-footnote font-medium whitespace-nowrap", PILL[tone])}>
      {children}
    </span>
  );
}

/**
 * FIXED SLOTS ON A ROW'S RIGHT, so amounts and labels line up down a card whatever each row holds
 * (owner, 2026-10-14: a row with a menu pushed its amount left of the row without one). Every row in
 * a card, and every card on one tab, uses the same three: the figure, its status, and its menu. A row
 * with nothing for a slot still keeps it, empty.
 */
export function Slots({ figure, status, menu }: { figure?: ReactNode; status?: ReactNode; menu?: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center">
      <span className="flex w-24 justify-end text-callout text-label tabular-nums">{figure}</span>
      <span className="flex w-40 justify-start pl-3">{status}</span>
      <span className="flex w-8 justify-end">{menu}</span>
    </span>
  );
}
