import { inngest } from "@/lib/inngest/client";
import { brandAiFillRequested } from "@/lib/inngest/events";
import { failResearch, finishResearch, markStep } from "@/lib/brands/store";
import { researchLogger } from "@/lib/research/log";
import { prisma } from "@/lib/prisma";
import { runCampaignsStep } from "@/lib/research/campaigns-step";
import { runDetailsStep } from "@/lib/research/details-step";
import { runScoreStep } from "@/lib/research/score-step";

/**
 * Fills in only what the AI makes and a brand is missing, for brands researched while no model could
 * answer (no key, or every key over its limit): campaigns when it has none at all (the campaigns step
 * replaces campaigns, so a brand with any — found or added by hand — is left alone), and the empty
 * brand details (the details step keeps what's filled). The website, accounts and images stay; the log
 * keeps its earlier lines.
 */
export const fillAiParts = inngest.createFunction(
  {
    id: "fill-ai-parts",
    name: "Fill in a brand's missing AI parts",
    triggers: [{ event: brandAiFillRequested.name }],
    concurrency: [{ limit: 5 }, { key: "event.data.brandId", limit: 1 }],
    retries: 2,
    onFailure: async ({ event, error }) => {
      const { brandId } = brandAiFillRequested.schema.parse(event.data.event.data);
      const log = await researchLogger(brandId, null);
      await log(`Filling in the missing parts stopped after repeated errors: ${error.message.slice(0, 200)}`, "warn");
      await failResearch(brandId, "Filling in the missing parts stopped after repeated errors. Try again from the brand page.");
    },
  },
  async ({ event, step }) => {
    const { brandId } = brandAiFillRequested.schema.parse(event.data);
    await step.run("start", async () => {
      await (await researchLogger(brandId, null))("Filling in the missing AI parts.");
    });
    await step.run("campaigns", async () => {
      if ((await prisma.campaign.count({ where: { brandId } })) > 0) return;
      await markStep(brandId, "campaigns");
      const log = await researchLogger(brandId, "campaigns");
      await log("Researching campaigns…");
      await runCampaignsStep(brandId, log);
    });
    await step.run("details", async () => {
      await markStep(brandId, "details");
      const log = await researchLogger(brandId, "details");
      await log("Drafting brand details…");
      await runDetailsStep(brandId, log);
    });
    await step.run("score", async () => {
      await markStep(brandId, "score");
      await runScoreStep(brandId, await researchLogger(brandId, "score"));
    });
    await step.run("finish", async () => {
      await finishResearch(brandId);
      await (await researchLogger(brandId, null))("Missing parts filled in. Ready for review.", "good");
    });
    return { brandId };
  },
);
