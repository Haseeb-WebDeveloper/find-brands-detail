import { formatShortDate } from "@/lib/format";

/**
 * HOW LONG AGO, IN WORDS (owner, 2026-10-15): "just now", "5 minutes ago", "2 hours ago",
 * "yesterday", "3 days ago", then the date. Never "2h" or "1d": a roofer reads a sentence, not a code.
 *
 * The office's own, in the new design language. `formatAgo` in the template package stays as it is,
 * because the website template (and leadforge, which installs it) uses it.
 */
export function sayAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, (now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatShortDate(iso);
}
