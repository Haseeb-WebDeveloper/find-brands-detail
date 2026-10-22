import { describe, expect, it } from "vitest";
import { MAX_BATCH_NAME, batchTitle, cleanBatchName, exportFileName } from "@/lib/batches/name";

describe("batch names", () => {
  it("tidies a typed name, and treats an empty one as none", () => {
    expect(cleanBatchName("  Week 43   skincare ")).toBe("Week 43 skincare");
    expect(cleanBatchName("   ")).toBeNull();
    expect(cleanBatchName("x".repeat(200))?.length).toBe(MAX_BATCH_NAME);
  });

  it("falls back to the day for batches without a name", () => {
    expect(batchTitle({ name: "Week 43", createdAt: "2026-10-22T08:00:00Z" })).toBe("Week 43");
    expect(batchTitle({ name: null, createdAt: "2026-10-22T08:00:00Z" })).toBe("Batch of 22 Oct");
  });

  it("makes the export file name from the batch name", () => {
    const at = new Date("2026-10-22T08:00:00Z");
    expect(exportFileName("Week 43: K-beauty / skincare", at)).toBe("week-43-k-beauty-skincare-2026-10-22.csv");
    expect(exportFileName("???", at)).toBe("brand-enrich-2026-10-22.csv");
  });
});
