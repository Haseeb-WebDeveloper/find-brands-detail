import { describe, expect, it } from "vitest";
import { parseEmbed, parseProfile } from "@/lib/tiktok/profile";

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
      profile: { username: "celimax.global", name: "celimax.global", verified: false, bioLink: "https://linktr.ee/celimax", signature: "Honest skin", followers: 229100, private: false, avatar: null },
    });
  });

  it("reads the large profile picture", () => {
    const html = page({ statusCode: 0, userInfo: { user: { uniqueId: "a", avatarLarger: "https://p16.tiktokcdn.com/a.jpeg" }, stats: { followerCount: 1 } } });
    expect(parseProfile(html, "a")).toMatchObject({ ok: true, profile: { avatar: "https://p16.tiktokcdn.com/a.jpeg" } });
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

/** The embed page's data, shaped as TikTok served it on 2026-10-22. */
const embed = (username: string, entry: unknown) =>
  `<html><script id="__FRONTITY_CONNECT_STATE__" type="application/json">${JSON.stringify({ source: { url: "", data: { [`/embed/@${username}`]: entry } } })}</script></html>`;

describe("parseEmbed", () => {
  it("reads a found profile, without a bio link", () => {
    const html = embed("numbuzin_global", {
      isReady: true,
      userInfo: { uniqueId: "numbuzin_global", verified: true, followerCount: 140600, signature: "NAD+ Skin Care", privateAccount: false, nickname: "numbuzin", avatarThumbUrl: "https://p16.tiktokcdn.com/t.jpeg", code: 200 },
    });
    expect(parseEmbed(html, "numbuzin_global")).toEqual({
      ok: true,
      profile: { username: "numbuzin_global", name: "numbuzin", verified: true, bioLink: null, signature: "NAD+ Skin Care", followers: 140600, private: false, avatar: "https://p16.tiktokcdn.com/t.jpeg" },
    });
  });

  it("says when the account does not exist", () => {
    const html = embed("zz_none", { errorCode: 10221, errorStatus: 400, isError: true, userInfo: { uniqueId: "zz_none" } });
    expect(parseEmbed(html, "zz_none")).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("treats the busy page and other errors as blocked", () => {
    expect(parseEmbed("overload-protect triggered", "a")).toMatchObject({ ok: false, reason: "blocked" });
    expect(parseEmbed(embed("a", { errorCode: 10000, userInfo: { uniqueId: "a" } }), "a")).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("never reads another account's data", () => {
    const html = embed("someone_else", { userInfo: { uniqueId: "someone_else", followerCount: 5 } });
    expect(parseEmbed(html, "x")).toMatchObject({ ok: false, reason: "blocked" });
  });
});
