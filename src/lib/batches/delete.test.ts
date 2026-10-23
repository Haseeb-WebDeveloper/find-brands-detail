import { describe, expect, it } from "vitest";
import { STUCK_AFTER_MS } from "@/lib/research/ai-fill";
import { deleteBlocker } from "./delete";

const now = Date.parse("2026-10-23T12:00:00Z");
const at = (msAgo: number) => new Date(now - msAgo);

describe("deleteBlocker", () => {
  it("allows a batch whose research is done", () => {
    expect(deleteBlocker([{ id: "a", status: "needs_review", updatedAt: at(1000) }, { id: "b", status: "exported", updatedAt: at(1000) }], now)).toBeNull();
    expect(deleteBlocker([], now)).toBeNull();
  });

  it("waits while brands are still being researched", () => {
    expect(
      deleteBlocker(
        [
          { id: "a", status: "researching", updatedAt: at(1000) },
          { id: "b", status: "queued", updatedAt: at(2000) },
          { id: "c", status: "approved", updatedAt: at(1000) },
        ],
        now,
      ),
    ).toBe("2 brands are still being researched. Wait for research to finish, then delete.");
  });

  it("does not wait for brands whose research died", () => {
    expect(deleteBlocker([{ id: "a", status: "researching", updatedAt: at(STUCK_AFTER_MS + 1000) }], now)).toBeNull();
  });
});
