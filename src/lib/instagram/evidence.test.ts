import { describe, expect, it } from "vitest";
import { parseBadge } from "@/lib/instagram/badge";
import { bioReachesBrand } from "@/lib/instagram/bio-link";

describe("parseBadge", () => {
  it("reads the flag next to the username", () => {
    const html = '..."full_name":"Purito Seoul Global Official","is_verified":true,..."username":"purito_official"...';
    expect(parseBadge(html, "purito_official")).toBe(true);
  });

  it("reads false", () => {
    expect(parseBadge('{"username":"biodance_official","is_verified":false}', "biodance_official")).toBe(false);
  });

  it("is unknown when the page doesn't carry the profile", () => {
    expect(parseBadge("<html>Login • Instagram</html>", "x")).toBeNull();
    expect(parseBadge('{"username":"someone_else","is_verified":true}', "x")).toBeNull();
  });
});

describe("bioReachesBrand", () => {
  const domains = ["tirtir.global", "tirtir.co.kr"];

  it("accepts a bio that is the brand's own site", () => {
    expect(bioReachesBrand({ finalUrl: "https://tirtir.global/pages/x", html: "" }, domains, "TIRTIR")).toBe("tirtir.global");
  });

  it("follows a link page to the brand's site", () => {
    const html = '<a href="https://shop.tirtir.global/collections">Shop</a><a href="https://instagram.com/x">IG</a>';
    expect(bioReachesBrand({ finalUrl: "https://linktr.ee/TIRTIRGLOBAL", html }, domains, "TIRTIR")).toBe("tirtir.global");
  });

  it("falls back to a domain carrying the brand's name (@tirtir_global → tirtir.us)", () => {
    const html = '<a href="https://www.amazon.com/x">A</a><a href="https://tirtir.us/">US</a>';
    expect(bioReachesBrand({ finalUrl: "https://linktr.ee/TIRTIRGLOBAL", html }, ["tirtir.co.kr"], "TIRTIR")).toBe("tirtir.us");
  });

  it("prefers a checked site over a brand-named one", () => {
    const html = '<a href="https://tirtir.us/">US</a><a href="https://www.tirtir.co.kr/">KR</a>';
    expect(bioReachesBrand({ finalUrl: "https://linktr.ee/x", html }, ["tirtir.co.kr"], "TIRTIR")).toBe("tirtir.co.kr");
  });

  it("is null when nothing reaches the brand", () => {
    expect(bioReachesBrand({ finalUrl: "https://linktr.ee/x", html: '<a href="https://amazon.com/x">A</a>' }, domains, "TIRTIR")).toBeNull();
  });
});
