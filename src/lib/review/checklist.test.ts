import { describe, expect, it } from "vitest";
import { buildChecklist, type ChecklistInput } from "@/lib/review/checklist";

const input: ChecklistInput = {
  fields: { website: "proven", instagram: "proven", tiktok: null, logo: "review", cover: "rejected" },
  text: { description: "Korean skincare.", tier: "masstige", aesthetic: "", industry: "skincare", regions: "" },
  campaigns: { approved: 2, proposed: 1 },
};

describe("buildChecklist", () => {
  it("lists each field, the details and the campaigns in page order", () => {
    expect(buildChecklist(input).map((i) => `${i.key}:${i.status}`)).toEqual([
      "website:done",
      "instagram:done",
      "tiktok:optional",
      "logo:warn",
      "cover:todo",
      "details:todo",
      "campaigns:todo",
    ]);
  });

  it("says what is missing in plain words", () => {
    const items = buildChecklist(input);
    expect(items.find((i) => i.key === "details")?.detail).toBe("Missing aesthetic, regions");
    expect(items.find((i) => i.key === "campaigns")?.detail).toBe("2 of 3 approved");
    expect(items.find((i) => i.key === "cover")?.detail).toBe("The chosen one failed its check");
  });

  it("flags a missing Instagram account without blocking, and campaigns still to decide", () => {
    const items = buildChecklist({ ...input, fields: { ...input.fields, instagram: null }, campaigns: { approved: 3, proposed: 2 } });
    expect(items.find((i) => i.key === "instagram")).toMatchObject({ status: "warn", detail: "None: the DB needs one to make the brand live" });
    expect(items.find((i) => i.key === "campaigns")).toMatchObject({ status: "warn", detail: "3 approved · 2 still to decide" });
  });
});
