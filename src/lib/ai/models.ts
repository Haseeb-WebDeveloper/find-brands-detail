import "server-only";
import { noLog, type ResearchLog } from "@/lib/research/log-types";

type Effort = "low" | "medium";
const TIMEOUT_MS = 120_000;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

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
  for (const s of SEARCHERS.filter((x) => x.ready())) {
    try {
      await log(`Searching the web for ${what} with ${s.label}. This can take a minute…`);
      const text = await s.run(prompt, effort);
      if (accept(text)) return text;
      await log(`${s.label} found nothing usable.`, "warn");
    } catch (error) {
      console.error(`[ai] ${s.label} search failed`, error);
      const quota = /quota|rate.?limit|429/i.test(message(error));
      await log(`${s.label} search ${quota ? "is over its daily limit" : "failed"}.`, "warn");
    }
  }
  return null;
}

/** A plain (no search) answer for writing and extraction: Groq, then Gemini. Never throws. */
export async function askPlain(prompt: string): Promise<string | null> {
  const { generateText } = await import("ai");
  if (process.env.GROQ_API_KEY) {
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
      console.error("[ai] Groq writing failed", error);
    }
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      const { google } = await import("@ai-sdk/google");
      return (await generateText({ model: google("gemini-2.5-flash"), abortSignal: AbortSignal.timeout(TIMEOUT_MS), prompt })).text;
    } catch (error) {
      console.error("[ai] Gemini writing failed", error);
    }
  }
  return null;
}
