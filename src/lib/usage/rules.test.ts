import { describe, expect, it } from "vitest";
import { errorHeaders, limitKind, rateLimitFrom, summarizeUsage, type UsageRow } from "./rules";

describe("rateLimitFrom", () => {
  it("keeps the rate-limit headers and reads the daily request pair", () => {
    expect(
      rateLimitFrom({
        "content-type": "application/json",
        "x-ratelimit-limit-requests": "1000",
        "x-ratelimit-remaining-requests": "987",
        "x-ratelimit-remaining-tokens": "7400",
        "Retry-After": "12",
      }),
    ).toEqual({
      requestsLeft: 987,
      requestsLimit: 1000,
      headers: { "x-ratelimit-limit-requests": "1000", "x-ratelimit-remaining-requests": "987", "x-ratelimit-remaining-tokens": "7400", "retry-after": "12" },
    });
  });

  it("is empty when the provider sends none (Gemini)", () => {
    expect(rateLimitFrom({ "content-type": "application/json" })).toEqual({ requestsLeft: null, requestsLimit: null, headers: null });
    expect(rateLimitFrom(undefined)).toEqual({ requestsLeft: null, requestsLimit: null, headers: null });
  });
});

describe("errorHeaders", () => {
  it("finds the headers on the error or on the last retried try", () => {
    const headers = { "retry-after": "60" };
    expect(errorHeaders({ responseHeaders: headers })).toBe(headers);
    expect(errorHeaders({ lastError: { responseHeaders: headers } })).toBe(headers);
    expect(errorHeaders(new Error("boom"))).toBeUndefined();
  });
});

describe("limitKind", () => {
  it("names the limit Groq says was reached", () => {
    expect(limitKind("Rate limit reached for model `openai/gpt-oss-120b` on tokens per day (TPD): Limit 200000, Used 199500")).toBe("tokens per day");
    expect(limitKind("Rate limit reached … on requests per day (RPD): Limit 1000")).toBe("requests per day");
    expect(limitKind("Quota exceeded for metric: generate_content_free_tier_requests, GenerateRequestsPerDayPerProjectPerModel")).toBe("daily quota");
    expect(limitKind("429 Too Many Requests")).toBeNull();
    expect(limitKind(null)).toBeNull();
  });
});

const row = (over: Partial<UsageRow>): UsageRow => ({
  brandId: "b1",
  brandName: "Numbuzin",
  provider: "Groq",
  outcome: "answered",
  totalTokens: 1000,
  requestsLeft: null,
  requestsLimit: null,
  error: null,
  createdAt: new Date("2026-10-23T08:00:00Z"),
  ...over,
});

describe("summarizeUsage", () => {
  it("totals each key per UTC day and records the first limit hit with the tokens spent before it", () => {
    const { keyDays, limitHits } = summarizeUsage([
      row({ createdAt: new Date("2026-10-23T08:00:00Z"), totalTokens: 30000, requestsLeft: 990, requestsLimit: 1000 }),
      row({ createdAt: new Date("2026-10-23T09:00:00Z"), totalTokens: 40000, requestsLeft: 989, requestsLimit: 1000 }),
      row({ createdAt: new Date("2026-10-23T10:00:00Z"), totalTokens: null, outcome: "limit", error: "on tokens per day (TPD)" }),
      row({ createdAt: new Date("2026-10-23T10:30:00Z"), totalTokens: null, outcome: "limit", error: "on tokens per day (TPD)" }),
      row({ createdAt: new Date("2026-10-23T10:00:01Z"), provider: "Groq 2", totalTokens: 5000 }),
      row({ createdAt: new Date("2026-10-22T23:59:00Z"), totalTokens: 2000 }),
    ]);
    expect(keyDays).toEqual([
      {
        day: "2026-10-23",
        provider: "Groq",
        calls: 4,
        tokens: 70000,
        limitHits: 2,
        firstLimitAt: "2026-10-23T10:00:00.000Z",
        firstLimitKind: "tokens per day",
        tokensBeforeLimit: 70000,
        requestsLeft: 989,
        requestsLimit: 1000,
      },
      expect.objectContaining({ day: "2026-10-23", provider: "Groq 2", calls: 1, tokens: 5000, limitHits: 0, firstLimitAt: null }),
      expect.objectContaining({ day: "2026-10-22", provider: "Groq", tokens: 2000 }),
    ]);
    expect(limitHits.map((h) => h.at)).toEqual(["2026-10-23T10:30:00.000Z", "2026-10-23T10:00:00.000Z"]);
  });

  it("averages per brand over brands that got at least one answer", () => {
    const { brands, perBrand } = summarizeUsage([
      row({ brandId: "a", brandName: "A", totalTokens: 40000 }),
      row({ brandId: "a", brandName: "A", totalTokens: 20000, createdAt: new Date("2026-10-23T08:01:00Z") }),
      row({ brandId: "b", brandName: "B", totalTokens: 30000, createdAt: new Date("2026-10-23T09:00:00Z") }),
      row({ brandId: "c", brandName: "C", totalTokens: null, outcome: "limit", createdAt: new Date("2026-10-23T10:00:00Z") }),
      row({ brandId: null, brandName: null, totalTokens: 999 }),
    ]);
    expect(brands.map((b) => [b.brandName, b.calls, b.tokens, b.limitHits])).toEqual([
      ["C", 1, 0, 1],
      ["B", 1, 30000, 0],
      ["A", 2, 60000, 0],
    ]);
    expect(perBrand).toEqual({ brands: 2, tokens: 45000, calls: 1.5 });
  });

  it("has no average before any brand got an answer", () => {
    expect(summarizeUsage([]).perBrand).toBeNull();
  });
});
