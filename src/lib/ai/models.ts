import "server-only";
import { noLog, type ResearchLog } from "@/lib/research/log-types";

type Effort = "low" | "medium";

/**
 * Whether any model is set up. Only finding a website (when none is given) and finding and describing
 * campaigns need one; every other step works without (spec 2026-10-21 §3).
 */
export function aiAvailable(): boolean {
  return Boolean(process.env.GROQ_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}
const TIMEOUT_MS = 120_000;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const isQuota = (error: unknown) => /quota|rate.?limit|429/i.test(message(error));

/**
 * A model over its quota is skipped for a while instead of being asked again for every brand: each
 * refused call still costs half a minute (Gemini's free tier allows 20 searches a day).
 */
const COOLDOWN_MS = 30 * 60 * 1000;
const restingUntil = new Map<string, number>();
const resting = (label: string) => (restingUntil.get(label) ?? 0) > Date.now();
const rest = (label: string) => restingUntil.set(label, Date.now() + COOLDOWN_MS);

/**
 * Web-searching models, tried in order (contractor-sites' chain): Groq first, Gemini when Groq has
 * no key, errors or hits its quota. Search-grounded calls cannot also enforce a JSON schema, so
 * callers ask for JSON in the prompt and validate it.
 */
const SEARCHERS: { label: string; ready: () => boolean; run: (prompt: string, effort: Effort) => Promise<string> }[] = [
  {
    label: "Groq",
    ready: () => Boolean(process.env.GROQ_API_KEY),
    run: async (prompt, effort) => {
      const { generateText } = await import("ai");
      const { groq } = await import("@ai-sdk/groq");
      const ask = async () =>
        (
          await generateText({
            model: groq("openai/gpt-oss-120b"),
            tools: { browser_search: groq.tools.browserSearch({}) },
            providerOptions: { groq: { reasoningEffort: effort, reasoningFormat: "hidden" } },
            abortSignal: AbortSignal.timeout(TIMEOUT_MS),
            prompt,
          })
        ).text;
      try {
        return await ask();
      } catch (error) {
        // The model now and then calls a tool that doesn't exist ("json"), which Groq rejects
        // outright. A second try almost always answers.
        if (!/tool call validation failed/i.test(message(error))) throw error;
        return ask();
      }
    },
  },
  {
    label: "Gemini",
    ready: () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    run: async (prompt) => {
      const { generateText } = await import("ai");
      const { google } = await import("@ai-sdk/google");
      const { text } = await generateText({
        model: google("gemini-2.5-flash"),
        tools: { google_search: google.tools.googleSearch({}) },
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        prompt,
      });
      return text;
    },
  },
];

/**
 * Asks each searching model in turn until one answers with text `accept` takes. Never throws: no
 * key or every model failing is `null`, and the caller sends the brand to review.
 */
export async function askWithSearch(
  prompt: string,
  { what, effort, log = noLog, accept = () => true }: { what: string; effort: Effort; log?: ResearchLog; accept?: (text: string) => boolean },
): Promise<string | null> {
  for (const s of SEARCHERS.filter((x) => x.ready() && !resting(x.label))) {
    try {
      await log(`Searching the web for ${what} with ${s.label}. This can take a minute…`);
      const text = await s.run(prompt, effort);
      if (accept(text)) return text;
      await log(`${s.label} found nothing usable.`, "warn");
    } catch (error) {
      console.error(`[ai] ${s.label} search failed: ${message(error).slice(0, 200)}`);
      if (isQuota(error)) rest(s.label);
      await log(isQuota(error) ? `${s.label} is over its limit; it is skipped for the next 30 minutes.` : `${s.label} search failed.`, "warn");
    }
  }
  return null;
}

/** A plain (no search) answer for writing and extraction: Groq, then Gemini. Never throws. */
export async function askPlain(prompt: string): Promise<string | null> {
  const { generateText } = await import("ai");
  if (process.env.GROQ_API_KEY && !resting("Groq")) {
    try {
      const { groq } = await import("@ai-sdk/groq");
      return (
        await generateText({
          model: groq("openai/gpt-oss-120b"),
          providerOptions: { groq: { reasoningEffort: "low", reasoningFormat: "hidden" } },
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
          prompt,
        })
      ).text;
    } catch (error) {
      if (isQuota(error)) rest("Groq");
      console.error(`[ai] Groq writing failed: ${message(error).slice(0, 200)}`);
    }
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY && !resting("Gemini")) {
    try {
      const { google } = await import("@ai-sdk/google");
      return (await generateText({ model: google("gemini-2.5-flash"), abortSignal: AbortSignal.timeout(TIMEOUT_MS), prompt })).text;
    } catch (error) {
      if (isQuota(error)) rest("Gemini");
      console.error(`[ai] Gemini writing failed: ${message(error).slice(0, 200)}`);
    }
  }
  return null;
}
