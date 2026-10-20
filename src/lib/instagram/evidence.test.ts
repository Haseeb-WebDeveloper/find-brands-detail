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
    expect(bioReachesBrand({ finalUrl: "https://tirtir.global/pages/x", html: "" }, domains)).toBe("tirtir.global");
  });

  it("follows a link page to the brand's site", () => {
    const html = '<a href="https://shop.tirtir.global/collections">Shop</a><a href="https://instagram.com/x">IG</a>';
    expect(bioReachesBrand({ finalUrl: "https://linktr.ee/TIRTIRGLOBAL", html }, domains)).toBe("tirtir.global");
  });

  it("is null when nothing reaches the brand", () => {
    expect(bioReachesBrand({ finalUrl: "https://linktr.ee/x", html: '<a href="https://amazon.com/x">A</a>' }, domains)).toBeNull();
  });
});
