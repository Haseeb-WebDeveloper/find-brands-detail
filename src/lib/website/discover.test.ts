import { describe, expect, it } from "vitest";
import { findOfficialSites, parseSitesAnswer } from "@/lib/website/discover";

describe("parseSitesAnswer", () => {
  it("reads the JSON object out of a prose answer", () => {
    const text = 'Here you go:\n```json\n{"sites":[{"url":"https://tirtir.global/","region":"global"},{"url":"tirtir.co.kr","region":"kr"}]}\n```';
    expect(parseSitesAnswer(text)).toEqual([
      { url: "https://tirtir.global", region: "global" },
      { url: "https://tirtir.co.kr", region: "kr" },
    ]);
  });

  it("drops retailers, marketplaces and social profiles", () => {
    const text =
      '{"sites":[{"url":"https://www.sephora.com/brand/x","region":"us"},{"url":"https://www.amazon.com/stores/x","region":"us"},{"url":"https://instagram.com/x","region":"global"},{"url":"https://acme-beauty.com","region":"global"}]}';
    expect(parseSitesAnswer(text)).toEqual([{ url: "https://acme-beauty.com", region: "global" }]);
  });

  it("is empty for unreadable answers", () => {
    expect(parseSitesAnswer("I could not find it.")).toEqual([]);
    expect(parseSitesAnswer('{"sites": "nope"}')).toEqual([]);
  });
});

describe("findOfficialSites without an AI key", () => {
  it("says so and returns nothing, at once", async () => {
    const vars = ["GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_API_KEY_3", "GROQ_API_KEY_4", "GOOGLE_GENERATIVE_AI_API_KEY"];
    const saved = Object.fromEntries(vars.map((v) => [v, process.env[v]]));
    for (const v of vars) delete process.env[v];
    try {
      const lines: string[] = [];
      expect(await findOfficialSites("numbuzin", async (m) => void lines.push(m))).toEqual([]);
      expect(lines[0]).toMatch(/^No AI key is set up, so no website was searched/);
    } finally {
      for (const v of vars) if (saved[v]) process.env[v] = saved[v];
    }
  });
});
