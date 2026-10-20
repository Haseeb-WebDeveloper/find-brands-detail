import { describe, expect, it } from "vitest";
import { parseDiscovery } from "@/lib/instagram/discovery";

describe("parseDiscovery", () => {
  it("reads a business profile", () => {
    const json = {
      business_discovery: {
        username: "tirtir_global",
        name: "TIRTIR Global Official",
        biography: "Redefine Your Radiance.",
        website: "https://linktr.ee/TIRTIRGLOBAL",
        followers_count: 810543,
        media_count: 892,
        profile_picture_url: "https://cdn/p.jpg",
        media: { data: [{ media_type: "IMAGE", media_url: "https://cdn/1.jpg", permalink: "https://ig/p/1", caption: "New", timestamp: "2026-10-14T00:00:00+0000" }] },
      },
      id: "17841447593921597",
    };
    expect(parseDiscovery(json)).toEqual({
      ok: true,
      profile: {
        username: "tirtir_global",
        name: "TIRTIR Global Official",
        biography: "Redefine Your Radiance.",
        website: "https://linktr.ee/TIRTIRGLOBAL",
        followers: 810543,
        mediaCount: 892,
        profilePictureUrl: "https://cdn/p.jpg",
        recentMedia: [{ mediaType: "IMAGE", mediaUrl: "https://cdn/1.jpg", permalink: "https://ig/p/1", caption: "New", timestamp: "2026-10-14T00:00:00+0000" }],
      },
    });
  });

  it("treats 'Invalid user id' as not a business account (the impostor case)", () => {
    expect(parseDiscovery({ error: { message: "Invalid user id", code: 110 } })).toEqual({
      ok: false,
      reason: "not_business",
      message: "Not a business or creator account, or it doesn't exist.",
    });
  });

  it("names token and rate-limit problems", () => {
    expect(parseDiscovery({ error: { message: "Error validating access token", code: 190 } })).toMatchObject({ ok: false, reason: "token" });
    expect(parseDiscovery({ error: { message: "Application request limit reached", code: 4 } })).toMatchObject({ ok: false, reason: "rate_limited" });
    expect(parseDiscovery({ error: { message: "boom", code: 1 } })).toMatchObject({ ok: false, reason: "error" });
  });
});
