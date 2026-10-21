import { describe, expect, it } from "vitest";
import { approvalBlockers } from "@/lib/review/blockers";
import { READY } from "@/lib/export/fixtures";

describe("approvalBlockers", () => {
  it("is empty for a brand the importer accepts, extra proposed campaigns included", () => {
    expect(approvalBlockers(READY)).toEqual({ errors: [], warnings: [] });
  });

  it("says what blocks approval in plain words", () => {
    const r = approvalBlockers({ ...READY, logo: null, campaigns: READY.campaigns.slice(0, 1), rejected: ["cover"], text: { ...READY.text, tier: "cheap" } });
    expect(r.errors).toEqual(
      expect.arrayContaining([
        "Logo: Logo URL is required",
        "Tier: Tier must be one of: luxury, premium, masstige",
        "Campaigns: At least 3 complete campaigns are required (found 1)",
        "Cover: the chosen image failed its check. Choose another.",
      ]),
    );
  });

  it("names the campaign slot an error belongs to", () => {
    const campaigns = READY.campaigns.map((c, i) => (i === 3 ? { ...c, description: "x".repeat(501) } : c));
    expect(approvalBlockers({ ...READY, campaigns }).errors).toEqual(["Campaign 3: 501 characters — the maximum is 500"]);
  });

  it("warns, without blocking, when there is no Instagram account", () => {
    const r = approvalBlockers({ ...READY, instagram: null });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(["Instagram: No Instagram source — this brand cannot be activated until one is added"]);
  });
});
