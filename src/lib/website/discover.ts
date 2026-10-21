import { z } from "zod";
import { aiAvailable, askWithSearch } from "@/lib/ai/models";
import { noLog, type ResearchLog } from "@/lib/research/log-types";

export type SiteSuggestion = { url: string; region: "global" | "us" | "kr" | "other" };

const Answer = z.object({
  sites: z.array(z.object({ url: z.string(), region: z.enum(["global", "us", "kr", "other"]).catch("other") })),
});

/** Hosts that are never a brand's own site. */
const NOT_OFFICIAL =
  /(^|\.)(instagram|tiktok|facebook|youtube|x|twitter|linkedin|amazon|sephora|ulta|oliveyoung|yesstyle|stylevana|stylekorean|ebay|walmart|target|wikipedia|linktr)\.[a-z.]+$/i;

export function parseSitesAnswer(text: string): SiteSuggestion[] {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  let parsed: z.infer<typeof Answer>;
  try {
    parsed = Answer.parse(JSON.parse(json));
  } catch {
    return [];
  }
  const out: SiteSuggestion[] = [];
  for (const s of parsed.sites) {
    try {
      const u = new URL(/^https?:\/\//i.test(s.url) ? s.url : `https://${s.url}`);
      if (NOT_OFFICIAL.test(u.hostname)) continue;
      const origin = `https://${u.hostname}`;
      if (!out.some((o) => o.url === origin)) out.push({ url: origin, region: s.region });
    } catch {
      continue;
    }
  }
  return out.slice(0, 4);
}

const PROMPT = (brand: string) =>
  `Find the official website(s) owned by the beauty/fashion brand "${brand}". ` +
  `Include its global site and regional official sites (US, Korea) if they exist. ` +
  `Exclude retailers, marketplaces, distributors and social media. ` +
  `Answer with JSON only: {"sites":[{"url":"https://...","region":"global|us|kr|other"}]}`;

/** Never throws: no key or every model failing means no suggestions, and the brand goes to review. */
export async function findOfficialSites(brand: string, log: ResearchLog = noLog): Promise<SiteSuggestion[]> {
  if (!aiAvailable()) {
    await log("No AI key is set up, so no website was searched. Give the brand as \"Name, website\" in the batch, or type the website on the brand page.", "warn");
    return [];
  }
  const text = await askWithSearch(PROMPT(brand), { what: `${brand}'s official sites`, effort: "medium", log, accept: (t) => parseSitesAnswer(t).length > 0 });
  return text ? parseSitesAnswer(text) : [];
}
