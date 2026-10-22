import { researchBrand } from "@/lib/inngest/functions/research-brand";
import { fillAiParts } from "@/lib/inngest/functions/fill-ai-parts";

/** Every function must be listed here, or Inngest never runs it. */
export const functions = [researchBrand, fillAiParts];
