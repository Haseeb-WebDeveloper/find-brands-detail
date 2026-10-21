import { describe, expect, it } from "vitest";
import { batchState, initialSelection, type ExportGroup } from "@/lib/export/groups";

const groups: ExportGroup[] = [
  {
    id: "b1",
    createdAt: "2026-10-21T00:00:00Z",
    brands: [
      { id: "a", name: "numbuzin", status: "approved" },
      { id: "b", name: "Jumiso", status: "needs_review" },
      { id: "c", name: "TIRTIR", status: "exported" },
    ],
  },
  { id: "b2", createdAt: "2026-10-20T00:00:00Z", brands: [{ id: "d", name: "Dr.G", status: "approved" }] },
];

describe("initialSelection", () => {
  it("picks the batch named in the link: its approved and exported brands", () => {
    expect(initialSelection(groups, "b1")).toEqual(["a", "c"]);
  });
  it("otherwise picks every approved brand not yet exported", () => {
    expect(initialSelection(groups, null)).toEqual(["a", "d"]);
    expect(initialSelection(groups, "unknown")).toEqual(["a", "d"]);
  });
});

describe("batchState", () => {
  it("reads a batch's checkbox from the selection, ignoring brands not approved", () => {
    expect(batchState(groups[0], new Set(["a", "c"]))).toBe("all");
    expect(batchState(groups[0], new Set(["a"]))).toBe("some");
    expect(batchState(groups[0], new Set(["b"]))).toBe("none");
  });
});
