import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AiOutcome, RateLimit } from "@/lib/usage/rules";

export type AiCallRecord = {
  brandId: string | null;
  provider: string;
  model: string;
  kind: "search" | "write";
  purpose: string;
  outcome: AiOutcome;
  tokens: { input: number | null; output: number | null; total: number | null };
  durationMs: number;
  rateLimit: RateLimit;
  error: string | null;
};

/**
 * Saves one AI attempt. Called only from the AI chain inside the research jobs, so it takes no scope.
 * Never fails the research: a row that can't be saved is dropped with a console error.
 */
export async function recordAiCall(call: AiCallRecord): Promise<void> {
  try {
    const brand = call.brandId
      ? await prisma.brand.findUnique({ where: { id: call.brandId }, select: { name: true, batchId: true } })
      : null;
    await prisma.aiCall.create({
      data: {
        brandId: call.brandId,
        brandName: brand?.name ?? null,
        batchId: brand?.batchId ?? null,
        provider: call.provider,
        model: call.model,
        kind: call.kind,
        purpose: call.purpose.slice(0, 200),
        outcome: call.outcome,
        inputTokens: call.tokens.input,
        outputTokens: call.tokens.output,
        totalTokens: call.tokens.total,
        durationMs: call.durationMs,
        requestsLeft: call.rateLimit.requestsLeft,
        requestsLimit: call.rateLimit.requestsLimit,
        rateHeaders: (call.rateLimit.headers ?? undefined) as Prisma.InputJsonValue | undefined,
        error: call.error?.slice(0, 1000) ?? null,
      },
    });
  } catch (error) {
    console.error("[ai-usage] could not save a call", error);
  }
}

/**
 * The calls each key made since `since`, for working out which keys are resting (rules.ts
 * `restingKeys`). Called only by the AI chain inside the research jobs, so it takes no scope.
 */
export async function recentKeyCalls(since: Date) {
  return prisma.aiCall.findMany({
    where: { createdAt: { gte: since }, outcome: { in: ["limit", "answered", "unusable"] } },
    select: { provider: true, outcome: true, createdAt: true, error: true, rateHeaders: true },
  });
}
