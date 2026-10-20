import { describe, expect, it } from "vitest";
import { APP_NAV, APP_NAV_FOOTER, isAppNavActive } from "@/components/app/nav";
import { ICON_NAMES } from "@/design/icon";

describe("nav", () => {
  it("has the batches and team screens", () => {
    expect([...APP_NAV, ...APP_NAV_FOOTER].map((l) => l.href)).toEqual(["/batches", "/team"]);
  });

  it("uses only icons the design system has", () => {
    for (const leaf of [...APP_NAV, ...APP_NAV_FOOTER]) expect(ICON_NAMES).toContain(leaf.icon);
  });

  it("marks nested routes active", () => {
    expect(isAppNavActive("/batches/abc", "/batches")).toBe(true);
    expect(isAppNavActive("/team", "/batches")).toBe(false);
  });
});
