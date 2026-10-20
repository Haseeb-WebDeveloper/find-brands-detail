import { describe, expect, it } from "vitest";
import { judgeSite, type FetchedPage } from "@/lib/website/judge";

const page = (over: Partial<FetchedPage>): FetchedPage => ({
  requestedUrl: "https://brand.com/",
  ok: true,
  status: 200,
  finalUrl: "https://brand.com/",
  html: "",
  error: null,
  elapsedMs: 300,
  ...over,
});

const REAL = (title: string) => `<html><head><title>${title}</title></head><body>${"x".repeat(3000)}</body></html>`;

describe("judgeSite", () => {
  it("proves a live site that names the brand", () => {
    const v = judgeSite(page({ requestedUrl: "https://tirtir.global/", finalUrl: "https://tirtir.global/", html: REAL("TIRTIR Global Official") }), "TIRTIR");
    expect(v).toMatchObject({ score: "proven", kind: "ok", siteUrl: "https://tirtir.global" });
  });

  it("matches the brand with accents and punctuation removed", () => {
    expect(judgeSite(page({ html: REAL("L’Oréal Paris | Official") }), "L'Oréal").score).toBe("proven");
  });

  it("sends a live site that never names the brand to review", () => {
    expect(judgeSite(page({ html: REAL("Welcome") }), "Benton")).toMatchObject({ score: "review", kind: "name_missing" });
  });

  it("rejects a site that does not load", () => {
    expect(judgeSite(page({ ok: false, status: null, finalUrl: null, error: "ENOTFOUND" }), "Dr.G")).toMatchObject({
      score: "rejected",
      kind: "unreachable",
    });
  });

  it("rejects a parked domain that bounces to /lander (jumiso.com)", () => {
    const html = '<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>';
    expect(judgeSite(page({ requestedUrl: "https://jumiso.com/", finalUrl: "https://jumiso.com/", html }), "Jumiso")).toMatchObject({
      score: "rejected",
      kind: "parked",
    });
  });

  it("rejects a for-sale page", () => {
    const html = REAL("brand.com is for sale") + " This domain may be for sale. Buy now on HugeDomains.";
    expect(judgeSite(page({ html }), "Brand").kind).toBe("parked");
  });

  it("rejects an offline store page (roundaround.co.kr on cafe24)", () => {
    const html = "<html><head><title>This store is unavailable</title></head><body>Sorry, this store is temporarily unavailable.</body></html>";
    expect(judgeSite(page({ html }), "Round A'Round")).toMatchObject({ score: "rejected", kind: "offline" });
  });

  it("rejects a redirect to an unrelated domain (pyunkangyul.us)", () => {
    const v = judgeSite(
      page({ requestedUrl: "https://pyunkangyul.us/", finalUrl: "https://xoilaclivettbdu.tv/", html: REAL("Watch live") }),
      "Pyunkang Yul",
    );
    expect(v).toMatchObject({ score: "rejected", kind: "hijacked" });
    expect(v.reason).toContain("xoilaclivettbdu.tv");
  });

  it("follows a redirect that stays with the brand", () => {
    const v = judgeSite(
      page({ requestedUrl: "https://www.aestura.com/", finalUrl: "https://www.aestura.com/web/main.do", html: REAL("AESTURA") }),
      "Aestura",
    );
    expect(v).toMatchObject({ score: "proven", siteUrl: "https://www.aestura.com" });
  });

  it("sends a bot check to review rather than guessing", () => {
    const html = "<html><head><title>Just a moment...</title></head><body>cf-chl</body></html>";
    expect(judgeSite(page({ status: 403, html }), "Brand")).toMatchObject({ score: "review", kind: "blocked" });
  });

  it("rejects a bare server error, but reviews one that still shows the brand", () => {
    expect(judgeSite(page({ status: 500, html: "Internal Server Error" }), "Brand").kind).toBe("server_error");
    expect(judgeSite(page({ status: 500, html: REAL("Dear Klairs") }), "Dear, Klairs")).toMatchObject({
      score: "review",
      kind: "server_error",
    });
  });
});
