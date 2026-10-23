import "server-only";
import { noLog, type ResearchLog } from "@/lib/research/log-types";
import { currentAiBrand } from "@/lib/usage/context";
import { errorHeaders, isQuotaError, rateLimitFrom, restingKeys, type AiOutcome } from "@/lib/usage/rules";
import { recentKeyCalls, recordAiCall } from "@/lib/usage/store";

type Effort = "low" | "medium";

/**
 * Groq keys in the order they're used: GROQ_API_KEY, then GROQ_API_KEY_2 to _6. Each has
 * its own quota, so one over its limit hands over to the next. Groq only (owner, 2026-10-23: no
 * Gemini fallback).
 */
const GROQ_KEY_VARS = ["GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_API_KEY_3", "GROQ_API_KEY_4", "GROQ_API_KEY_5", "GROQ_API_KEY_6"] as const;
const groqKeys = () =>
  GROQ_KEY_VARS.map((v, n) => ({ label: n === 0 ? "Groq" : `Groq ${n + 1}`, key: process.env[v] })).filter((k): k is { label: string; key: string } => Boolean(k.key));

/**
 * Whether any model is set up. Only finding a website (when none is given) and finding and describing
 * campaigns need one; every other step works without (spec 2026-10-21 §3).
 */
export function aiAvailable(): boolean {
  return groqKeys().length > 0;
}

/** The keys this deployment has, by label, in the order they're tried (names only, never the keys). */
export function configuredKeys(): string[] {
  return groqKeys().map((k) => k.label);
}

const TIMEOUT_MS = 120_000;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const isQuota = (error: unknown) => isQuotaError(message(error));

/**
 * RESTING KEYS. A key that refused a call for its limit is left alone until Groq says it can answer
 * again (usage/rules.ts `restUntil`): seconds for the per-minute token limit most refusals are, longer
 * for the daily one. Worked out from the recorded calls, not kept in memory, so the jobs running on
 * separate servers at once, and a later "Fill in missing AI parts", all see which keys are free now.
 */
const REST_LOOKBACK_MS = 6 * 60 * 60 * 1000;
/** Every key resting, but one free within this: wait for it rather than leave the work undone. */
const WAIT_MAX_MS = 75_000;

async function keyState(): Promise<{ ready: Model[]; soonest: { label: string; until: Date } | null }> {
  const now = new Date();
  const resting = restingKeys(await recentKeyCalls(new Date(now.getTime() - REST_LOOKBACK_MS)), now);
  const all = groqKeys().map(groqModel);
  const soonest = all
    .filter((m) => resting.has(m.label))
    .map((m) => ({ label: m.label, until: resting.get(m.label) as Date }))
    .sort((a, b) => a.until.getTime() - b.until.getTime())[0];
  return { ready: all.filter((m) => !resting.has(m.label)), soonest: soonest ?? null };
}

/** The keys free now; when none is but one will be within a minute or so, after waiting for it. */
async function freeKeys(what: string, log: ResearchLog): Promise<Model[]> {
  let state = await keyState();
  if (state.ready.length > 0 || !state.soonest) return state.ready;
  const wait = state.soonest.until.getTime() - Date.now();
  if (wait > WAIT_MAX_MS) {
    await log(`Every Groq key is over its limit; the first is free again at ${state.soonest.until.toISOString().slice(11, 16)} UTC, so ${what} had to wait. Use Fill in missing AI parts after that.`, "warn");
    return [];
  }
  await log(`Every Groq key is at its per-minute limit; waiting ${Math.ceil(wait / 1000)}s for ${state.soonest.label}…`);
  await new Promise((r) => setTimeout(r, Math.max(0, wait) + 500));
  state = await keyState();
  return state.ready;
}

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
            // A refused key hands over to the next at once: retrying the same key only meets its limit again.
            maxRetries: 0,
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
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
          prompt,
        }),
      );
    },
  };
}

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
 * Asks each free Groq key in turn until one answers with text `accept` takes. A key over its limit
 * hands over to the next at once; when they all were, it waits for the first to be free (if that's
 * soon) and goes round once more. Never throws: no key or every key failing is `null`, and the caller
 * sends the brand to review.
 */
export async function askWithSearch(
  prompt: string,
  { what, effort, log = noLog, accept = () => true }: { what: string; effort: Effort; log?: ResearchLog; accept?: (text: string) => boolean },
): Promise<string | null> {
  if (!aiAvailable()) return null;
  for (let round = 0; round < 2; round++) {
    let limited = false;
    for (const m of await freeKeys(what, log)) {
      try {
        await log(`Searching the web for ${what} with ${m.label}. This can take a minute…`);
        const text = await attempt(m, "search", what, () => m.search(prompt, effort), accept);
        if (accept(text)) return text;
        await log(`${m.label} found nothing usable.`, "warn");
      } catch (error) {
        console.error(`[ai] ${m.label} search failed: ${message(error).slice(0, 200)}`);
        if (isQuota(error)) limited = true;
        await log(isQuota(error) ? `${m.label} is over its limit; trying the next key.` : `${m.label} search failed.`, "warn");
      }
    }
    if (!limited) break;
  }
  return null;
}

/** A plain (no search) answer for writing and extraction, from the same keys. Never throws. */
export async function askPlain(prompt: string, what = "writing"): Promise<string | null> {
  if (!aiAvailable()) return null;
  for (let round = 0; round < 2; round++) {
    let limited = false;
    for (const m of await freeKeys(what, noLog)) {
      try {
        return await attempt(m, "write", what, () => m.write(prompt));
      } catch (error) {
        if (isQuota(error)) limited = true;
        console.error(`[ai] ${m.label} writing failed: ${message(error).slice(0, 200)}`);
      }
    }
    if (!limited) break;
  }
  return null;
}
