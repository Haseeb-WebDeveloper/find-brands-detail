import { z } from "zod";

export type FoundCampaign = { title: string; date: string | null; sources: string[] };

const Answer = z.object({
  campaigns: z.array(z.object({ title: z.string(), date: z.string().nullish(), sources: z.array(z.string()).catch([]) })),
});
/** Social pages: never fetched as sources (they need sign-in, and their images come from the profile steps). */
const SOCIAL = /(^|\.)(instagram|tiktok|facebook|youtube|youtu|x|twitter|threads|pinterest)\.[a-z.]+$/i;
const MAX = 8;

export function campaignsPrompt({ brand, site, instagram }: { brand: string; site: string | null; instagram: string | null }): string {
  const about = [site ? `official site ${site}` : null, instagram ? `Instagram @${instagram}` : null].filter(Boolean).join(", ");
  return (
    `List the visual marketing campaigns of the beauty brand "${brand}"${about ? ` (${about})` : ""}, most recent first, up to ${MAX}. ` +
    `A campaign has distinct campaign imagery: ambassadors, collaborations, seasonal campaigns, hero product launches with campaign visuals, pop-ups. ` +
    `Skip sales, discounts, retail expansion and promotions without imagery. ` +
    `For each give: title (short, as the brand names it), date (YYYY-MM, or null), and sources: up to 3 URLs of pages that show the campaign imagery, ` +
    `the brand's own pages first (site, press release), then press articles. Only URLs you actually found; no social media links. ` +
    `Answer with JSON only: {"campaigns":[{"title":"...","date":"YYYY-MM","sources":["https://..."]}]}`
  );
}

/** The model's list, validated: real-looking URLs only, no social pages, no repeats, at most 8. */
export function parseCampaignsAnswer(text: string): FoundCampaign[] {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  let parsed: z.infer<typeof Answer>;
  try {
    parsed = Answer.parse(JSON.parse(json));
  } catch {
    return [];
  }
  const out: FoundCampaign[] = [];
  for (const c of parsed.campaigns) {
    const title = c.title.trim();
    if (!title || out.some((o) => o.title.toLowerCase() === title.toLowerCase())) continue;
    const sources = c.sources.flatMap((s) => {
      try {
        const u = new URL(s);
        return /^https?:$/.test(u.protocol) && !SOCIAL.test(u.hostname) ? [u.toString()] : [];
      } catch {
        return [];
      }
    });
    const date = c.date && /^\d{4}(-\d{2})?$/.test(c.date.trim()) ? c.date.trim() : null;
    out.push({ title, date, sources: [...new Set(sources)].slice(0, 3) });
    if (out.length === MAX) break;
  }
  return out;
}
