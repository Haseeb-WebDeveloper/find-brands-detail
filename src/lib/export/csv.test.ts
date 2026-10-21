import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/export/csv";

describe("toCsv", () => {
  it("writes a header and quotes cells that need it", () => {
    const csv = toCsv(["name", "description"], [{ name: "Dear, Klairs", description: 'Says "hi"\nthen more' }, { name: "Jumiso" }]);
    expect(csv).toBe('name,description\r\n"Dear, Klairs","Says ""hi""\nthen more"\r\nJumiso,\r\n');
  });
});
