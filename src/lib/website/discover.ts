import { z } from "zod";
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

/**
 * Web-searching models, tried in order (contractor-sites' chain): Groq first, Gemini when Groq has
 * no key, errors or hits its quota. Search-grounded calls cannot also enforce a JSON schema, so the
 * prompt asks for JSON and `parseSitesAnswer` validates it.
 */
const SEARCHERS: { label: string; ready: () => boolean; run: (brand: string) => Promise<string> }[] = [
  {
    label: "Groq",
    ready: () => Boolean(process.env.GROQ_API_KEY),
    run: async (brand) => {
      const { generateText } = await import("ai");
      const { groq } = await import("@ai-sdk/groq");
      const { text } = await generateText({
        model: groq("openai/gpt-oss-120b"),
        tools: { browser_search: groq.tools.browserSearch({}) },
        providerOptions: { groq: { reasoningEffort: "medium", reasoningFormat: "hidden" } },
        abortSignal: AbortSignal.timeout(120_000),
        prompt: PROMPT(brand),
      });
      return text;
    },
  },
  {
    label: "Gemini",
    ready: () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    run: async (brand) => {
      const { generateText } = await import("ai");
      const { google } = await import("@ai-sdk/google");
      const { text } = await generateText({
        model: google("gemini-2.5-flash"),
        tools: { google_search: google.tools.googleSearch({}) },
        abortSignal: AbortSignal.timeout(120_000),
        prompt: PROMPT(brand),
      });
      return text;
    },
  },
];

/** Never throws: no key or every model failing means no suggestions, and the brand goes to review. */
export async function findOfficialSites(brand: string, log: ResearchLog = noLog): Promise<SiteSuggestion[]> {
  for (const s of SEARCHERS.filter((x) => x.ready())) {
    try {
      await log(`Searching the web for ${brand}'s official sites with ${s.label}. This can take a minute…`);
      const sites = parseSitesAnswer(await s.run(brand));
      if (sites.length > 0) return sites;
      await log(`${s.label} found no official site.`, "warn");
    } catch (error) {
      console.error(`[website] ${s.label} site search failed`, error);
      const quota = /quota|rate.?limit|429/i.test(String(error instanceof Error ? error.message : error));
      await log(`${s.label} search ${quota ? "is over its daily limit" : "failed"}.`, "warn");
    }
  }
  return [];
}
