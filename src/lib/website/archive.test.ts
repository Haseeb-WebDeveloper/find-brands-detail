import { describe, expect, it } from "vitest";
import { parseCdx, snapshotUrl } from "@/lib/website/archive";

describe("parseCdx", () => {
  it("reads timestamps newest first and skips the header row", () => {
    expect(parseCdx([["timestamp"], ["20230130142252"], ["20251203093431"], ["20240121170818"]])).toEqual([
      "20251203093431",
      "20240121170818",
      "20230130142252",
    ]);
  });

  it("is empty for anything unexpected", () => {
    expect(parseCdx(null)).toEqual([]);
    expect(parseCdx("nope")).toEqual([]);
    expect(parseCdx([["timestamp"]])).toEqual([]);
  });
});

describe("snapshotUrl", () => {
  it("asks for the raw capture without the Wayback toolbar", () => {
    expect(snapshotUrl("20210727130542", "https://roundaround.co.kr/")).toBe(
      "https://web.archive.org/web/20210727130542id_/https://roundaround.co.kr/",
    );
  });
});
