import { z } from "zod";

/** The DB importer's limit (db-admin CAMPAIGN_DESCRIPTION_MAX). */
export const DESCRIPTION_MAX = 500;
/** Asked for, leaving room so a slightly long answer still fits. */
const TARGET = 450;
/** Source text per campaign in the prompt. */
const PROMPT_TEXT = 2_000;

/**
 * One call for all of a brand's campaigns, written only from the text of their source pages, in the
 * DB's voice: what the campaign shows, then why it matters for the brand.
 */
export function describePrompt(brand: string, items: { title: string; date: string | null; text: string }[]): string {
  const blocks = items.map((c, i) => `${i + 1}. ${c.title}${c.date ? ` (${c.date})` : ""}\nSource text:\n${c.text.slice(0, PROMPT_TEXT)}`).join("\n\n");
  return (
    `You write campaign notes for a beauty-industry database. For each campaign of the brand "${brand}" below, write one description ` +
    `of 300 to ${TARGET} characters (at most ${TARGET} characters): first what the campaign shows (who, the visual idea, the setting), ` +
    `then why it matters for the brand. Plain, analytical English; no hashtags, no emojis, no marketing superlatives. ` +
    `Use only facts stated in the source text. Never guess or hedge (no "likely", "presumably", "may", "appears to"). ` +
    `If the source text gives fewer than two facts about a campaign, give an empty string for it. ` +
    `Answer with JSON only: {"descriptions":["...", "..."]} in the same order.\n\n${blocks}`
  );
}

/**
 * For campaigns whose source pages were too thin to write from (a banner, a one-line press page): the
 * model searches the web for each and writes from what it finds, with the same rules and format.
 */
export function describeWithSearchPrompt(brand: string, items: { title: string; date: string | null; sources: string[] }[]): string {
  const list = items.map((c, i) => `${i + 1}. ${c.title}${c.date ? ` (${c.date})` : ""}${c.sources.length ? ` — seen on ${c.sources.join(", ")}` : ""}`).join("\n");
  return (
    `Search the web for each campaign of the beauty brand "${brand}" below, then write one description of 300 to ${TARGET} characters ` +
    `(at most ${TARGET} characters) for each: first what the campaign shows (who, the visual idea, the setting), then why it matters for the brand. ` +
    `Plain, analytical English; no hashtags, no emojis, no marketing superlatives. Use only facts you found. ` +
    `Never guess or hedge (no "likely", "presumably", "may", "appears to"). If you find fewer than two facts about a campaign, give an empty string for it. ` +
    // Not "answer with JSON": beside the search tool, that wording makes the model call a "json" tool that doesn't exist.
    `Use the search tool only to search. Then reply in plain text with this object and nothing else: {"descriptions":["...", "..."]}, in the same order.\n\n${list}`
  );
}

export function shortenPrompt(brand: string, title: string, description: string): string {
  return `Shorten this description of ${brand}'s campaign "${title}" to at most ${TARGET} characters, keeping its facts and tone. Answer with the text only.\n\n${description}`;
}

const Answer = z.object({ descriptions: z.array(z.string().nullish()) });

export function parseDescriptions(text: string, count: number): (string | null)[] {
  const empty: (string | null)[] = Array.from({ length: count }, () => null);
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return empty;
  try {
    const { descriptions } = Answer.parse(JSON.parse(json));
    return empty.map((_, i) => descriptions[i]?.trim() || null);
  } catch {
    return empty;
  }
}

/** The last resort for a description still too long after re-asking: whole sentences only. */
export function cutToSentence(text: string, max = DESCRIPTION_MAX): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "), head.endsWith(".") ? head.length - 1 : -1);
  return end > 0 ? head.slice(0, end + 1) : head.slice(0, head.lastIndexOf(" ")).trim();
}
