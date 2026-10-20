import * as cheerio from "cheerio";
import { domainMatchesBrand, registrableDomain } from "@/lib/website/domain";
import { fetchPage } from "@/lib/website/fetch-page";

function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return registrableDomain(new URL(url).hostname);
  } catch {
    return null;
  }
}

/**
 * The brand domain this bio link reaches: the page itself, or a link on it (Linktree-style pages).
 * One of the brand's checked sites first; failing that, a domain carrying the brand's name — the
 * global account often links a site the regional research never saw (@tirtir_global → tirtir.us).
 */
export function bioReachesBrand(page: { finalUrl: string | null; html: string }, brandDomains: string[], brand: string): string | null {
  const wanted = new Set(brandDomains.map((d) => d.toLowerCase()));
  const $ = cheerio.load(page.html);
  const domains = [domainOf(page.finalUrl), ...$("a[href]").toArray().map((el) => domainOf($(el).attr("href")))].filter(
    (d): d is string => Boolean(d),
  );
  return domains.find((d) => wanted.has(d)) ?? domains.find((d) => domainMatchesBrand(d, brand)) ?? null;
}

export async function checkBioLink(website: string | null, brandDomains: string[], brand: string): Promise<{ reached: string | null; via: string | null }> {
  if (!website) return { reached: null, via: null };
  const page = await fetchPage(website);
  return { reached: page.ok ? bioReachesBrand(page, brandDomains, brand) : null, via: website };
}
