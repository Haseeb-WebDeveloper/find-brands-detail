import { describe, expect, it } from "vitest";
import { linkExpiry } from "@/lib/images/expiry";

describe("linkExpiry", () => {
  it("reads Instagram's hex oe= and TikTok's x-expires=", () => {
    expect(linkExpiry("https://scontent.cdninstagram.com/v/x.jpg?_nc_ht=a&oe=6716A1B0")?.toISOString()).toBe(new Date(0x6716a1b0 * 1000).toISOString());
    expect(linkExpiry("https://p16-common-sign.tiktokcdn.com/a.jpeg?x-expires=1792500000&x-signature=z")?.toISOString()).toBe(new Date(1792500000 * 1000).toISOString());
  });

  it("is null for links that don't expire", () => {
    expect(linkExpiry("https://jumiso.us/cdn/shop/files/logo.png?v=1")).toBeNull();
    expect(linkExpiry("not a url")).toBeNull();
  });
});
