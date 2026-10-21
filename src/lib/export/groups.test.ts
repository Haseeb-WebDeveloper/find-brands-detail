import { describe, expect, it } from "vitest";
import { batchState, initialSelection, type ExportGroup } from "@/lib/export/groups";

const groups: ExportGroup[] = [
  {
    id: "b1",
    createdAt: "2026-10-21T00:00:00Z",
    brands: [
      { id: "a", name: "numbuzin", status: "approved" },
      { id: "b", name: "Jumiso", status: "needs_review" },
      { id: "c", name: "TIRTIR", status: "researching" },
    ],
  },
  { id: "b2", createdAt: "2026-10-20T00:00:00Z", brands: [{ id: "d", name: "Dr.G", status: "exported" }] },
];

describe("initialSelection", () => {
  it("picks the batch named in the link: every brand whose research has finished", () => {
    expect(initialSelection(groups, "b2")).toEqual(["d"]);
  });
  it("otherwise picks the newest batch", () => {
    expect(initialSelection(groups, null)).toEqual(["a", "b"]);
    expect(initialSelection(groups, "unknown")).toEqual(["a", "b"]);
    expect(initialSelection([], null)).toEqual([]);
  });
});

describe("batchState", () => {
  it("reads a batch's checkbox from the selection, ignoring brands still researching", () => {
    expect(batchState(groups[0], new Set(["a", "b"]))).toBe("all");
    expect(batchState(groups[0], new Set(["a"]))).toBe("some");
    expect(batchState(groups[0], new Set(["c"]))).toBe("none");
  });
});
