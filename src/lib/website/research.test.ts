import { describe, expect, it, vi } from "vitest";
import { researchWebsite, type WebsiteDeps } from "@/lib/website/research";
import type { FetchedPage } from "@/lib/website/judge";

const real = (title: string, body = "") => `<html><head><title>${title}</title></head><body>${body}${"x".repeat(3000)}</body></html>`;

function deps(pages: Record<string, Partial<FetchedPage>>, over: Partial<WebsiteDeps> = {}): WebsiteDeps {
  return {
    fetchPage: vi.fn(async (url: string) => ({
      requestedUrl: url,
      ok: true,
      status: 200,
      finalUrl: url,
      html: "",
      error: null,
      elapsedMs: 10,
      ...(pages[url] ?? { ok: false, status: null, finalUrl: null, error: "ENOTFOUND" }),
    })),
    latestSnapshot: vi.fn(async () => null),
    findOfficialSites: vi.fn(async () => []),
    ...over,
  };
}

describe("researchWebsite", () => {
  it("proves the hint and follows its regional links", async () => {
    const d = deps({
      "https://numbuzin.com/": { html: real("numbuzin", '<a href="https://us.numbuzin.com/">US</a>') },
      "https://us.numbuzin.com/": { html: real("numbuzin US") },
    });
    const r = await researchWebsite("numbuzin", "https://numbuzin.com/", d);
    expect(r.chosen?.url).toBe("https://numbuzin.com/");
    expect(r.candidates.map((c) => [c.url, c.source, c.verdict.score])).toEqual([
      ["https://numbuzin.com/", "hint", "proven"],
      ["https://us.numbuzin.com/", "regional-link", "proven"],
    ]);
    expect(d.findOfficialSites).not.toHaveBeenCalled();
  });

  it("rejects a hijacked hint and attaches the archive, then asks Gemini", async () => {
    const d = deps(
      {
        "https://pyunkangyul.us/": { finalUrl: "https://xoilaclivettbdu.tv/", html: real("live sport") },
        "https://pyunkangyul.com/": { html: real("Pyunkang Yul") },
      },
      {
        latestSnapshot: vi.fn(async () => ({
          timestamp: "20240121170818",
          page: { requestedUrl: "", ok: true, status: 200, finalUrl: "", html: real("Pyunkang Yul US Official"), error: null, elapsedMs: 1 },
        })),
        findOfficialSites: vi.fn(async () => [{ url: "https://pyunkangyul.com", region: "global" as const }]),
      },
    );
    const r = await researchWebsite("Pyunkang Yul", "https://pyunkangyul.us/", d);
    const hint = r.candidates.find((c) => c.source === "hint")!;
    expect(hint.verdict.kind).toBe("hijacked");
    expect(hint.archive?.timestamp).toBe("20240121170818");
    expect(r.chosen?.url).toBe("https://pyunkangyul.com/");
  });

  it("uses Gemini when there is no hint, and chooses nothing when nothing loads", async () => {
    const d = deps({}, { findOfficialSites: vi.fn(async () => [{ url: "https://dr-g.co.kr", region: "kr" as const }]) });
    const r = await researchWebsite("Dr.G", null, d);
    expect(d.findOfficialSites).toHaveBeenCalledWith("Dr.G");
    expect(r.candidates[0].verdict.kind).toBe("unreachable");
    expect(r.chosen).toBeNull();
  });
});
