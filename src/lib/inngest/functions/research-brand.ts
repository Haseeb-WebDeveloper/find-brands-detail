import { inngest } from "@/lib/inngest/client";
import { brandResearchRequested } from "@/lib/inngest/events";
import { RESEARCH_STEPS } from "@/lib/research/steps";
import { failResearch, finishResearch, markStep } from "@/lib/brands/store";
import { runWebsiteStep } from "@/lib/research/website-step";

/**
 * One job per brand. Each research step is its own Inngest step so a failure retries only that
 * step. Steps are placeholders in this plan; later plans replace each body with real research.
 */
export const researchBrand = inngest.createFunction(
  {
    id: "research-brand",
    name: "Research a brand",
    triggers: [{ event: brandResearchRequested.name }],
    concurrency: [{ limit: 5 }, { key: "event.data.brandId", limit: 1 }],
    retries: 2,
    onFailure: async ({ event }) => {
      const { brandId } = brandResearchRequested.schema.parse(event.data.event.data);
      await failResearch(brandId, "Research stopped after repeated errors. Retry it from the brand page.");
    },
  },
  async ({ event, step }) => {
    const { brandId } = brandResearchRequested.schema.parse(event.data);
    for (const { id } of RESEARCH_STEPS) {
      await step.run(`step:${id}`, async () => {
        await markStep(brandId, id);
        // Real work so far: the website (which also reads the regional sites — the crawl). The
        // other steps are still placeholders; later plans fill them in.
        if (id === "website") await runWebsiteStep(brandId);
      });
      // Placeholder pacing so progress is visible while the remaining steps are empty.
      if (id !== "website") await step.sleep(`pause:${id}`, "1s");
    }
    await step.run("finish", () => finishResearch(brandId));
    return { brandId };
  },
);
