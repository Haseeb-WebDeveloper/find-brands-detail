import "server-only";
import { noLog, type ResearchLog } from "@/lib/research/log-types";
import { currentAiBrand } from "@/lib/usage/context";
import { errorHeaders, isQuotaError, rateLimitFrom, type AiOutcome } from "@/lib/usage/rules";
import { recordAiCall } from "@/lib/usage/store";

type Effort = "low" | "medium";

/**
 * Groq keys in the order they're used: GROQ_API_KEY, then GROQ_API_KEY_2 to _6. Each has
 * its own quota, so one over its limit hands over to the next.
 */
const GROQ_KEY_VARS = ["GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_API_KEY_3", "GROQ_API_KEY_4", "GROQ_API_KEY_5", "GROQ_API_KEY_6"] as const;
const groqKeys = () =>
  GROQ_KEY_VARS.map((v, n) => ({ label: n === 0 ? "Groq" : `Groq ${n + 1}`, key: process.env[v] })).filter((k): k is { label: string; key: string } => Boolean(k.key));

/**
 * Whether any model is set up. Only finding a website (when none is given) and finding and describing
 * campaigns need one; every other step works without (spec 2026-10-21 §3).
 */
export function aiAvailable(): boolean {
  return groqKeys().length > 0 || Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}
/** The keys this deployment has, by label, in the order they're tried (names only, never the keys). */
export function configuredKeys(): string[] {
  return [...groqKeys().map((k) => k.label), ...(process.env.GOOGLE_GENERATIVE_AI_API_KEY ? ["Gemini"] : [])];
}

const TIMEOUT_MS = 120_000;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const isQuota = (error: unknown) => isQuotaError(message(error));

/**
 * A model over its quota is skipped for a while instead of being asked again for every brand: each
 * refused call still costs half a minute (Gemini's free tier allows 20 searches a day).
 */
const COOLDOWN_MS = 30 * 60 * 1000;
const restingUntil = new Map<string, number>();
const resting = (label: string) => (restingUntil.get(label) ?? 0) > Date.now();
const rest = (label: string) => restingUntil.set(label, Date.now() + COOLDOWN_MS);

/** A model's answer with what it cost, for the usage record. */
type Answer = { text: string; usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number }; headers?: Record<string, string> };
const answer = (r: { text: string; totalUsage: Answer["usage"]; response: { headers?: Record<string, string> } }): Answer => ({
  text: r.text,
  usage: r.totalUsage,
  headers: r.response.headers,
});

type Model = { label: string; model: string; search: (prompt: string, effort: Effort) => Promise<Answer>; write: (prompt: string) => Promise<Answer> };

function groqModel({ label, key }: { label: string; key: string }): Model {
  const provider = async () => {
    const { createGroq } = await import("@ai-sdk/groq");
    return createGroq({ apiKey: key });
  };
  return {
    label,
    model: "openai/gpt-oss-120b",
    search: async (prompt, effort) => {
      const { generateText } = await import("ai");
      const groq = await provider();
      const ask = async () =>
        answer(
          await generateText({
            model: groq("openai/gpt-oss-120b"),
            tools: { browser_search: groq.tools.browserSearch({}) },
            providerOptions: { groq: { reasoningEffort: effort, reasoningFormat: "hidden" } },
            abortSignal: AbortSignal.timeout(TIMEOUT_MS),
            prompt,
          }),
        );
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
      return answer(
        await generateText({
          model: groq("openai/gpt-oss-120b"),
          providerOptions: { groq: { reasoningEffort: "low", reasoningFormat: "hidden" } },
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
          prompt,
        }),
      );
    },
  };
}

const gemini: Model = {
  label: "Gemini",
  model: "gemini-2.5-flash",
  search: async (prompt) => {
    const { generateText } = await import("ai");
    const { google } = await import("@ai-sdk/google");
    return answer(
      await generateText({
        model: google("gemini-2.5-flash"),
        tools: { google_search: google.tools.googleSearch({}) },
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        prompt,
      }),
    );
  },
  write: async (prompt) => {
    const { generateText } = await import("ai");
    const { google } = await import("@ai-sdk/google");
    return answer(await generateText({ model: google("gemini-2.5-flash"), abortSignal: AbortSignal.timeout(TIMEOUT_MS), prompt }));
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
 * Runs one attempt and records it in `ai_calls` (tokens spent, the provider's rate-limit headers, and
 * whether it was refused for being over its limit) against the brand the job is researching.
 * `usable` decides "answered" versus "unusable" for an answer that came back.
 */
async function attempt(m: Model, kind: "search" | "write", purpose: string, run: () => Promise<Answer>, usable: (text: string) => boolean = () => true) {
  const started = Date.now();
  const record = (outcome: AiOutcome, a: Answer | null, error: unknown) =>
    recordAiCall({
      brandId: currentAiBrand(),
      provider: m.label,
      model: m.model,
      kind,
      purpose,
      outcome,
      tokens: { input: a?.usage.inputTokens ?? null, output: a?.usage.outputTokens ?? null, total: a?.usage.totalTokens ?? null },
      durationMs: Date.now() - started,
      rateLimit: rateLimitFrom(a ? a.headers : errorHeaders(error)),
      error: error === null ? null : message(error),
    });
  try {
    const a = await run();
    await record(usable(a.text) ? "answered" : "unusable", a, null);
    return a.text;
  } catch (error) {
    await record(isQuota(error) ? "limit" : "failed", null, error);
    throw error;
  }
}

/**
 * Asks each searching model in turn until one answers with text `accept` takes. Never throws: no
 * key or every model failing is `null`, and the caller sends the brand to review.
 */
export async function askWithSearch(
  prompt: string,
  { what, effort, log = noLog, accept = () => true }: { what: string; effort: Effort; log?: ResearchLog; accept?: (text: string) => boolean },
): Promise<string | null> {
  const available = models();
  // Every key over its limit (each rests 30 minutes): said, so an empty result is never a mystery.
  if (available.length === 0) await log(`Every AI key is over its limit right now, so ${what} weren't searched.`, "warn");
  for (const m of available) {
    try {
      await log(`Searching the web for ${what} with ${m.label}. This can take a minute…`);
      const text = await attempt(m, "search", what, () => m.search(prompt, effort), accept);
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
export async function askPlain(prompt: string, what = "writing"): Promise<string | null> {
  for (const m of models()) {
    try {
      return await attempt(m, "write", what, () => m.write(prompt));
    } catch (error) {
      if (isQuota(error)) rest(m.label);
      console.error(`[ai] ${m.label} writing failed: ${message(error).slice(0, 200)}`);
    }
  }
  return null;
}
