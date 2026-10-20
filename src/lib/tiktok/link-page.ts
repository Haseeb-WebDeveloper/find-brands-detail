import "server-only";
import { extractFacts } from "@/lib/website/extract";
import { fetchPage } from "@/lib/website/fetch-page";

/** The TikTok handles a link page (Linktree and similar) lists. Never throws; a failed page lists none. */
export async function readLinkPage(url: string): Promise<string[]> {
  const page = await fetchPage(url);
  return page.ok ? extractFacts(page.html, page.finalUrl ?? url, "").tiktok : [];
}
