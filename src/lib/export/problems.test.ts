import { describe, expect, it } from "vitest";
import { imageCells, imageNote } from "@/lib/export/problems";
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
      "campaign_4_image_url:campaign",
    ]);
  });
});

describe("imageNote", () => {
  it("says which image was left empty", () => {
    const failed = { url: "x", slot: "logo" as const, ok: false, status: 403, passesMin: false, minDimension: 256, reason: "Could not fetch image" };
    expect(imageNote("numbuzin", "logo_url", failed)).toBe("numbuzin: logo didn't load, left empty");
    expect(imageNote("numbuzin", "campaign_2_image_url", { ...failed, ok: true })).toBe("numbuzin: campaign 2 image is too small, left empty");
    expect(imageNote("numbuzin", "cover_image_url", { ...failed, ok: true, passesMin: true })).toBeNull();
  });
});
