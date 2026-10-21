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
});
