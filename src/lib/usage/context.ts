import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Which brand the AI calls running now are for. The research jobs set it around each step, so
 * `models.ts` can record usage against the brand without every caller passing the brand along.
 * A call outside a job (none today) is recorded with no brand.
 */
const current = new AsyncLocalStorage<string>();

export const withAiBrand = <T>(brandId: string, run: () => Promise<T>): Promise<T> => current.run(brandId, run);

export const currentAiBrand = (): string | null => current.getStore() ?? null;
