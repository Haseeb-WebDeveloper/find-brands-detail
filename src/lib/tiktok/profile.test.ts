import { describe, expect, it } from "vitest";
import { parseProfile } from "@/lib/tiktok/profile";

const page = (detail: unknown) =>
  `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { "webapp.user-detail": detail } })}</script></html>`;

describe("parseProfile", () => {
  it("reads a found profile", () => {
    const html = page({
      statusCode: 0,
      userInfo: {
        user: { uniqueId: "celimax.global", nickname: "celimax.global", verified: false, signature: "Honest skin", privateAccount: false, bioLink: { link: "linktr.ee/celimax" } },
        stats: { followerCount: 229100 },
      },
    });
    expect(parseProfile(html, "celimax.global")).toEqual({
      ok: true,
      profile: { username: "celimax.global", name: "celimax.global", verified: false, bioLink: "https://linktr.ee/celimax", signature: "Honest skin", followers: 229100, private: false },
    });
  });

  it("says when the account does not exist", () => {
    expect(parseProfile(page({ statusCode: 10221 }), "nope")).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("treats a page without the profile data as blocked, not missing", () => {
    expect(parseProfile("<html>verify you are human</html>", "x")).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("never reads another account's data", () => {
    const html = page({ statusCode: 0, userInfo: { user: { uniqueId: "someone_else" }, stats: { followerCount: 5 } } });
    expect(parseProfile(html, "x")).toMatchObject({ ok: false, reason: "blocked" });
  });
});
