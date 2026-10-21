import { describe, expect, it } from "vitest";
import { imageCells, imageProblem } from "@/lib/export/problems";
import { buildImportRow } from "@/lib/export/row";
import { READY } from "@/lib/export/fixtures";

describe("imageCells", () => {
  it("lists every image the importer will fetch, with its slot", () => {
    expect(imageCells(buildImportRow(READY)).map((c) => `${c.column}:${c.slot}`)).toEqual([
      "logo_url:logo",
      "cover_image_url:cover",
      "campaign_1_image_url:campaign",
      "campaign_2_image_url:campaign",
      "campaign_3_image_url:campaign",
    ]);
  });
});

describe("imageProblem", () => {
  it("says which image failed and why", () => {
    const failed = { url: "x", slot: "logo" as const, ok: false, status: 403, passesMin: false, minDimension: 256, reason: "Could not fetch image" };
    expect(imageProblem("logo_url", failed)).toBe("Logo: the image no longer passes the DB's check (Could not fetch image). Pick another on the brand page.");
    expect(imageProblem("campaign_2_image_url", { ...failed, ok: true, passesMin: true })).toBeNull();
  });
});
