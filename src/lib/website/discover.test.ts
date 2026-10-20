import { describe, expect, it } from "vitest";
import { parseSitesAnswer } from "@/lib/website/discover";

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
