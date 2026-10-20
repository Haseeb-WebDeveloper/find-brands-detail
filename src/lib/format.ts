/** Pinned locale so server and client render the same string. */
const LOCALE = "en-US";

/** "Oct 16" — the short date the design system's `sayAgo` falls back to after a week. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}
