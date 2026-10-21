import { z } from "zod";
import { AESTHETICS, INDUSTRIES, REGIONS, TIERS } from "@/lib/details/vocab";

export type DetailsDraft = { description: string; tier: string; industry: string[]; aesthetic: string[]; regions: string[] };
export type DetailsInput = {
  brand: string;
  website: string | null;
  instagram: { handle: string; followers: number | null; bio: string | null } | null;
  /** The brand's own pages: titles and descriptions, a few hundred words at most. */
  siteText: string;
  campaigns: string[];
};
type Text = { description: string; tier: string; aesthetic: string; industry: string; regions: string };

/** The DB's descriptions run 240–320 characters; anything far past that is cut at a sentence end. */
const DESCRIPTION_MAX = 400;
const MAX_AESTHETIC = 4;
const MAX_INDUSTRY = 4;

/**
 * One search-grounded call for all five fields, in the DB's own voice and words (DB-mvp data,
 * 2026-10-21): "Founded in <place> in <year> by <founder>, … It is known for … Positioned as …".
 */
export function detailsPrompt(input: DetailsInput): string {
  const ig = input.instagram
    ? `@${input.instagram.handle}${input.instagram.followers !== null ? ` (${input.instagram.followers.toLocaleString("en-US")} followers)` : ""}${input.instagram.bio ? `, bio: "${input.instagram.bio}"` : ""}`
    : null;
  const facts = [
    input.website ? `Official site: ${input.website}` : null,
    ig ? `Instagram: ${ig}` : null,
    input.campaigns.length > 0 ? `Campaigns: ${input.campaigns.slice(0, 6).join("; ")}` : null,
    input.siteText ? `From its site:\n${input.siteText.slice(0, 2_000)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    `Write the database entry for the beauty/fashion brand "${input.brand}". Look it up on the web; use only facts you find.\n\n${facts}\n\n` +
    `description: 240 to 320 characters, three sentences in this pattern: "Founded in <place> in <year> by <founder>, <what the brand does>. ` +
    `It is known for <signature products or ideas>. Positioned as <its place in the market>." Leave out any fact you can't confirm. Plain English, no hype.\n` +
    `tier: one of ${TIERS.join(", ")} (luxury = high fashion houses; premium = prestige beauty; masstige = affordable, drugstore or K-beauty).\n` +
    `industry: 1 to ${MAX_INDUSTRY} of: ${INDUSTRIES.join(", ")}.\n` +
    `aesthetic: 2 to ${MAX_AESTHETIC} of: ${AESTHETICS.join(", ")}.\n` +
    `regions: 1 or 2 of: ${REGIONS.join(", ")} ("global" when it sells worldwide).\n` +
    `Answer with JSON only: {"description":"...","tier":"...","industry":["..."],"aesthetic":["..."],"regions":["..."]}`
  );
}

const Answer = z.object({
  description: z.string().catch(""),
  tier: z.string().catch(""),
  industry: z.array(z.string()).catch([]),
  aesthetic: z.array(z.string()).catch([]),
  regions: z.array(z.string()).catch([]),
});

/** Only the allowed words, lowercased, without repeats, at most `max`. */
function pick(values: string[], allowed: readonly string[], max: number): string[] {
  const ok = new Set(allowed);
  return [...new Set(values.map((v) => v.trim().toLowerCase()).filter((v) => ok.has(v)))].slice(0, max);
}

function cut(text: string): string {
  if (text.length <= DESCRIPTION_MAX) return text;
  const head = text.slice(0, DESCRIPTION_MAX);
  const end = head.lastIndexOf(". ");
  return end > 0 ? head.slice(0, end + 1) : head.slice(0, head.lastIndexOf(" ")).trim();
}

/** The model's answer held to the DB's words; null when there is no usable answer. */
export function parseDetails(text: string): DetailsDraft | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  let a: z.infer<typeof Answer>;
  try {
    a = Answer.parse(JSON.parse(json));
  } catch {
    return null;
  }
  const tier = a.tier.trim().toLowerCase();
  return {
    description: cut(a.description.trim().replace(/\s+/g, " ")),
    tier: (TIERS as readonly string[]).includes(tier) ? tier : "",
    industry: pick(a.industry, INDUSTRIES, MAX_INDUSTRY),
    aesthetic: pick(a.aesthetic, AESTHETICS, MAX_AESTHETIC),
    regions: pick(a.regions, REGIONS, 2),
  };
}

/** The draft fills only what is empty: a reviewer's own words are never replaced. Lists in the importer's "|" form. */
export function mergeDraft(current: Text, draft: DetailsDraft): Text {
  const or = (mine: string, theirs: string) => (mine.trim() ? mine : theirs);
  return {
    description: or(current.description, draft.description),
    tier: or(current.tier, draft.tier),
    aesthetic: or(current.aesthetic, draft.aesthetic.join("|")),
    industry: or(current.industry, draft.industry.join("|")),
    regions: or(current.regions, draft.regions.join("|")),
  };
}
