import * as cheerio from "cheerio";
import { registrableDomain } from "@/lib/website/domain";
import { fetchPage } from "@/lib/website/fetch-page";

function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return registrableDomain(new URL(url).hostname);
  } catch {
    return null;
  }
}

/** The brand domain this bio link reaches: the page itself, or a link on it (Linktree-style pages). */
export function bioReachesBrand(page: { finalUrl: string | null; html: string }, brandDomains: string[]): string | null {
  const wanted = new Set(brandDomains.map((d) => d.toLowerCase()));
  const own = domainOf(page.finalUrl);
  if (own && wanted.has(own)) return own;
  const $ = cheerio.load(page.html);
  for (const el of $("a[href]").toArray()) {
    const d = domainOf($(el).attr("href"));
    if (d && wanted.has(d)) return d;
  }
  return null;
}

export async function checkBioLink(website: string | null, brandDomains: string[]): Promise<{ reached: string | null; via: string | null }> {
  if (!website || brandDomains.length === 0) return { reached: null, via: website };
  const page = await fetchPage(website);
  return { reached: page.ok ? bioReachesBrand(page, brandDomains) : null, via: website };
}
