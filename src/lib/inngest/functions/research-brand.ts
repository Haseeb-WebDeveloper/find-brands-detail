import { inngest } from "@/lib/inngest/client";
import { brandResearchRequested } from "@/lib/inngest/events";
import { RESEARCH_STEPS, type ResearchStepId } from "@/lib/research/steps";
import { failResearch, finishResearch, markStep } from "@/lib/brands/store";
import { clearResearchLog, researchLogger } from "@/lib/research/log";
import { runWebsiteStep } from "@/lib/research/website-step";
import { runInstagramStep } from "@/lib/research/instagram-step";
import { runTiktokStep } from "@/lib/research/tiktok-step";
import { runImagesStep } from "@/lib/research/images-step";
import { runScoreStep } from "@/lib/research/score-step";

/** The steps with real work so far; the rest are announced and skipped until their build lands. */
const RUNNERS: Partial<Record<ResearchStepId, typeof runWebsiteStep>> = {
  website: runWebsiteStep,
  instagram: runInstagramStep,
  tiktok: runTiktokStep,
  images: runImagesStep,
  score: runScoreStep,
};

/** The crawl happens inside the website step (it reads the regional sites it finds). */
const NOT_YET: Partial<Record<ResearchStepId, string>> = {
  crawl: "Brand sites were read with the website.",
  campaigns: "Campaign research comes in a later build.",
};

/**
 * One job per brand. Each research step is its own Inngest step so a failure retries only that
 * step. Every step writes plain-language lines to the brand's research log as it works.
 */
export const researchBrand = inngest.createFunction(
  {
    id: "research-brand",
    name: "Research a brand",
    triggers: [{ event: brandResearchRequested.name }],
    concurrency: [{ limit: 5 }, { key: "event.data.brandId", limit: 1 }],
    retries: 2,
    onFailure: async ({ event, error }) => {
      const { brandId } = brandResearchRequested.schema.parse(event.data.event.data);
      const log = await researchLogger(brandId, null);
      await log(`Research stopped after repeated errors: ${error.message.slice(0, 200)}`, "warn");
      await failResearch(brandId, "Research stopped after repeated errors. Retry it from the brand page.");
    },
  },
  async ({ event, step }) => {
    const { brandId } = brandResearchRequested.schema.parse(event.data);
    await step.run("start", async () => {
      await clearResearchLog(brandId);
      await (await researchLogger(brandId, null))("Research started.");
    });
    for (const { id, label } of RESEARCH_STEPS) {
      await step.run(`step:${id}`, async () => {
        await markStep(brandId, id);
        const log = await researchLogger(brandId, id);
        const run = RUNNERS[id];
        if (run) {
          await log(`${label}…`);
          await run(brandId, log);
        } else {
          await log(NOT_YET[id] ?? `${label}: skipped.`);
        }
      });
    }
    await step.run("finish", async () => {
      await finishResearch(brandId);
      await (await researchLogger(brandId, null))("Research finished. Ready for review.", "good");
    });
    return { brandId };
  },
);
