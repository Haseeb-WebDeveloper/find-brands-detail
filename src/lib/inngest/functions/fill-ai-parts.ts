import { inngest } from "@/lib/inngest/client";
import { brandAiFillRequested } from "@/lib/inngest/events";
import { failResearch, finishResearch, markStep } from "@/lib/brands/store";
import { researchLogger } from "@/lib/research/log";
import { prisma } from "@/lib/prisma";
import { runCampaignsStep, runDescriptionsStep } from "@/lib/research/campaigns-step";
import { CAMPAIGNS_NEEDED } from "@/lib/research/ai-fill";
import { runDetailsStep } from "@/lib/research/details-step";
import { runScoreStep } from "@/lib/research/score-step";
import { withAiBrand } from "@/lib/usage/context";

/**
 * Fills in only what the AI makes and a brand is missing (ai-fill.ts), touching nothing already there:
 * - fewer than 3 campaigns: looks for more and adds them after the ones there (none replaced);
 * - campaigns with an empty description: writes just those descriptions;
 * - empty brand details: drafts them, keeping the filled ones.
 * The website, accounts and images stay; the log keeps its earlier lines.
 *
 * `moreCampaigns` ("Find more campaigns" on the brand page) only looks for more campaigns, however
 * many the brand has.
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
    const { brandId, moreCampaigns } = brandAiFillRequested.schema.parse(event.data);
    await step.run("start", async () => {
      await (await researchLogger(brandId, null))(moreCampaigns ? "Looking for more campaigns." : "Filling in the missing AI parts.");
    });
    // The brand marks the AI calls these steps make, so their usage is recorded against it.
    await step.run("campaigns", () =>
      withAiBrand(brandId, async () => {
        const live = await prisma.campaign.count({ where: { brandId, status: { not: "removed" } } });
        if (!moreCampaigns && live >= CAMPAIGNS_NEEDED) return;
        await markStep(brandId, "campaigns");
        const log = await researchLogger(brandId, "campaigns");
        await log(live === 0 ? "Researching campaigns…" : `Looking for more campaigns than the ${live} here…`);
        await runCampaignsStep(brandId, log, { more: true });
      }),
    );
    if (!moreCampaigns) {
      await step.run("descriptions", () =>
        withAiBrand(brandId, async () => {
          if ((await prisma.campaign.count({ where: { brandId, description: "", status: { not: "removed" } } })) === 0) return;
          await markStep(brandId, "campaigns");
          await runDescriptionsStep(brandId, await researchLogger(brandId, "campaigns"));
        }),
      );
      await step.run("details", () =>
        withAiBrand(brandId, async () => {
          await markStep(brandId, "details");
          const log = await researchLogger(brandId, "details");
          await log("Drafting brand details…");
          await runDetailsStep(brandId, log);
        }),
      );
    }
    await step.run("score", async () => {
      await markStep(brandId, "score");
      await runScoreStep(brandId, await researchLogger(brandId, "score"));
    });
    await step.run("finish", async () => {
      await finishResearch(brandId);
      await (await researchLogger(brandId, null))(moreCampaigns ? "Done looking for more campaigns. Ready for review." : "Missing parts filled in. Ready for review.", "good");
    });
    return { brandId };
  },
);
