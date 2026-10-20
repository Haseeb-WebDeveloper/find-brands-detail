import { describe, expect, it } from "vitest";
import { MAX_BRANDS_PER_BATCH, parseBatchInput } from "@/lib/batches/parse-input";

describe("parseBatchInput", () => {
  it("reads one brand per line and skips blanks", () => {
    expect(parseBatchInput("TIRTIR\n\n  Dr.G  \n").brands).toEqual([
      { name: "TIRTIR", websiteHint: null },
      { name: "Dr.G", websiteHint: null },
    ]);
  });

  it("reads a website after the last comma, keeping commas in names", () => {
    expect(parseBatchInput("TIRTIR, tirtir.global\nDear, Klairs, https://www.klairscosmetics.com/").brands).toEqual([
      { name: "TIRTIR", websiteHint: "https://tirtir.global/" },
      { name: "Dear, Klairs", websiteHint: "https://www.klairscosmetics.com/" },
    ]);
  });

  it("keeps a comma in the name when the rest is not a website", () => {
    expect(parseBatchInput("Dear, Klairs")).toEqual({ brands: [{ name: "Dear, Klairs", websiteHint: null }], errors: [] });
  });

  it("drops duplicates case-insensitively", () => {
    const { brands, errors } = parseBatchInput("Benton\nbenton");
    expect(brands).toHaveLength(1);
    expect(errors).toEqual(['Line 2: "benton" is already in this batch.']);
  });

  it("refuses oversized batches", () => {
    const text = Array.from({ length: MAX_BRANDS_PER_BATCH + 1 }, (_, i) => `Brand ${i}`).join("\n");
    expect(parseBatchInput(text)).toEqual({ brands: [], errors: [`At most ${MAX_BRANDS_PER_BATCH} brands per batch.`] });
  });
});
