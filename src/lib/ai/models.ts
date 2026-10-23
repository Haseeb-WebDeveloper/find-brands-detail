import "server-only";
import { noLog, type ResearchLog } from "@/lib/research/log-types";

type Effort = "low" | "medium";

/**
 * Groq keys in the order they're used: GROQ_API_KEY, then GROQ_API_KEY_2 to _4. Each has
 * its own quota, so one over its limit hands over to the next.
 */
const GROQ_KEY_VARS = ["GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_API_KEY_3", "GROQ_API_KEY_4"] as const;
const groqKeys = () =>
  GROQ_KEY_VARS.map((v, n) => ({ label: n === 0 ? "Groq" : `Groq ${n + 1}`, key: process.env[v] })).filter((k): k is { label: string; key: string } => Boolean(k.key));

/**
 * Whether any model is set up. Only finding a website (when none is given) and finding and describing
 * campaigns need one; every other step works without (spec 2026-10-21 §3).
 */
export function aiAvailable(): boolean {
  return groqKeys().length > 0 || Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
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

type Model = { label: string; search: (prompt: string, effort: Effort) => Promise<string>; write: (prompt: string) => Promise<string> };

function groqModel({ label, key }: { label: string; key: string }): Model {
  const provider = async () => {
    const { createGroq } = await import("@ai-sdk/groq");
    return createGroq({ apiKey: key });
  };
  return {
    label,
    search: async (prompt, effort) => {
      const { generateText } = await import("ai");
      const groq = await provider();
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
    write: async (prompt) => {
      const { generateText } = await import("ai");
      const groq = await provider();
      return (
        await generateText({
          model: groq("openai/gpt-oss-120b"),
          providerOptions: { groq: { reasoningEffort: "low", reasoningFormat: "hidden" } },
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
          prompt,
        })
      ).text;
    },
  };
}

const gemini: Model = {
  label: "Gemini",
  search: async (prompt) => {
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
  write: async (prompt) => {
    const { generateText } = await import("ai");
    const { google } = await import("@ai-sdk/google");
    return (await generateText({ model: google("gemini-2.5-flash"), abortSignal: AbortSignal.timeout(TIMEOUT_MS), prompt })).text;
  },
};

/**
 * The models with a key and not resting, in order (contractor-sites' chain): each Groq key, then
 * Gemini when every Groq key errors or is over its limit. Search-grounded calls cannot also enforce a
 * JSON schema, so callers ask for JSON in the prompt and validate it.
 */
const models = (): Model[] =>
  [...groqKeys().map(groqModel), ...(process.env.GOOGLE_GENERATIVE_AI_API_KEY ? [gemini] : [])].filter((m) => !resting(m.label));

/**
 * Asks each searching model in turn until one answers with text `accept` takes. Never throws: no
 * key or every model failing is `null`, and the caller sends the brand to review.
 */
export async function askWithSearch(
  prompt: string,
  { what, effort, log = noLog, accept = () => true }: { what: string; effort: Effort; log?: ResearchLog; accept?: (text: string) => boolean },
): Promise<string | null> {
  for (const m of models()) {
    try {
      await log(`Searching the web for ${what} with ${m.label}. This can take a minute…`);
      const text = await m.search(prompt, effort);
      if (accept(text)) return text;
      await log(`${m.label} found nothing usable.`, "warn");
    } catch (error) {
      console.error(`[ai] ${m.label} search failed: ${message(error).slice(0, 200)}`);
      if (isQuota(error)) rest(m.label);
      await log(isQuota(error) ? `${m.label} is over its limit; it is skipped for the next 30 minutes.` : `${m.label} search failed.`, "warn");
    }
  }
  return null;
}

/** A plain (no search) answer for writing and extraction, from the same chain. Never throws. */
export async function askPlain(prompt: string): Promise<string | null> {
  for (const m of models()) {
    try {
      return await m.write(prompt);
    } catch (error) {
      if (isQuota(error)) rest(m.label);
      console.error(`[ai] ${m.label} writing failed: ${message(error).slice(0, 200)}`);
    }
  }
  return null;
}
