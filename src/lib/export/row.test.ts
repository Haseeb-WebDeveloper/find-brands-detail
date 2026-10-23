import { describe, expect, it } from "vitest";
import { buildImportRow } from "@/lib/export/row";
import { READY } from "@/lib/export/fixtures";
import { IMPORT_HEADERS, validateImportRow } from "@/lib/export/importer/brand-import";

describe("buildImportRow", () => {
  it("fills the importer's columns from the review state", () => {
    const row = buildImportRow(READY);
    expect(row.name).toBe("numbuzin");
    expect(row.tier).toBe("masstige");
    expect(row.brand_aesthetic).toBe("clean|clinical");
    expect(row.profile_regions).toBe("Asia|North America");
    expect(row.source_website).toBe("https://us.numbuzin.com/");
    expect(row.source_instagram).toBe("numbuzin_global");
    expect(row.logo_url).toBe("https://numbuzin.com/logo.png");
  });

  it("exports every campaign not switched off, in order, into consecutive slots", () => {
    const row = buildImportRow(READY);
    expect([row.campaign_1_title, row.campaign_2_title, row.campaign_3_title, row.campaign_4_title, row.campaign_5_title]).toEqual([
      "Campaign 1",
      "Campaign 3",
      "Campaign 4",
      "Campaign 5",
      undefined,
    ]);
    expect(row.campaign_2_image_url).toBe("https://numbuzin.com/c3.jpg");
  });

  it("produces a row the copied importer accepts (spec §10 export test)", () => {
    const row = buildImportRow(READY);
    expect(validateImportRow(row).ok).toBe(true);
    expect(Object.keys(row).every((k) => IMPORT_HEADERS.includes(k))).toBe(true);
  });

  it("leaves gaps the importer reports", () => {
    const v = validateImportRow(buildImportRow({ ...READY, logo: null, text: { ...READY.text, tier: "" } }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.map((e) => e.column)).toEqual(expect.arrayContaining(["logo_url", "tier"]));
  });

  it("writes where each image sits in its frame, which the importer accepts", () => {
    const state = {
      ...READY,
      coverFraming: { zoom: 1.4, x: 0.5, y: 0.32 },
      campaigns: READY.campaigns.map((c, i) => (i === 2 ? { ...c, imageFraming: { zoom: 2.2, x: 0.56, y: 0.27 } } : c)),
    };
    const row = buildImportRow(state);
    expect(row.cover_image_framing).toBe("1.4,0.5,0.32");
    // Campaign 3 is the second in the row: campaign 2 is switched off.
    expect(row.campaign_2_image_framing).toBe("2.2,0.56,0.27");
    expect(row.campaign_1_image_framing).toBe("");
    const checked = validateImportRow(row);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(checked.row.images.find((i) => i.slot === "cover")?.framing).toEqual({ zoom: 1.4, x: 0.5, y: 0.32 });
      expect(checked.row.images.find((i) => i.column === "campaign_2_image_url")?.framing).toEqual({ zoom: 2.2, x: 0.56, y: 0.27 });
    }
  });

  it("puts the framing columns in the template beside their images", () => {
    expect(IMPORT_HEADERS.slice(IMPORT_HEADERS.indexOf("cover_image_url"), IMPORT_HEADERS.indexOf("cover_image_url") + 2)).toEqual(["cover_image_url", "cover_image_framing"]);
    expect(IMPORT_HEADERS).toContain("campaign_8_image_framing");
  });
});
