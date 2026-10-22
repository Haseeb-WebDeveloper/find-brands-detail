import { describe, expect, it } from "vitest";
import { matchPosts, pageMentions } from "@/lib/campaigns/posts";

const post = (images: string[], caption: string, timestamp = "2026-01-10T10:00:00+0000", mediaType = "IMAGE") => ({ mediaType, images, caption, timestamp, permalink: "" });
const posts = [
  post(["https://ig/1.jpg"], "Meet our new Red Cushion campaign ❤️ #TIRTIR"),
  post([], "Red Cushion in motion", undefined, "VIDEO"),
  post(["https://ig/3a.jpg", "https://ig/3b.jpg"], "TIRTIR world tour, The First Light", undefined, "CAROUSEL_ALBUM"),
  post(["https://ig/4.jpg"], "TIRTIR everyday glow"),
];
const undated = (title: string) => ({ title, date: null });

describe("matchPosts", () => {
  it("matches image posts whose caption names the campaign, ignoring the brand's own name", () => {
    expect(matchPosts(undated("Red Cushion Launch"), "TIRTIR", posts)).toEqual(["https://ig/1.jpg"]);
    // Every slide of a carousel.
    expect(matchPosts(undated("World Tour; The First Light"), "TIRTIR", posts)).toEqual(["https://ig/3a.jpg", "https://ig/3b.jpg"]);
    // "Glow" is a word every beauty caption uses; it doesn't identify a campaign.
    expect(matchPosts(undated("TIRTIR Glow"), "TIRTIR", posts)).toEqual([]);
    // Seasons and generic words never match on their own.
    expect(matchPosts(undated("Spring Renewal Campaign"), "TIRTIR", [post(["https://ig/5.jpg"], "Spring is here")])).toEqual([]);
    // One shared word out of four is a coincidence.
    expect(matchPosts(undated("World Tour; The First Light"), "TIRTIR", [post(["https://ig/6.jpg"], "First look at our toner")])).toEqual([]);
  });

  it("matches a hashtag that runs the title's words together", () => {
    expect(matchPosts(undated("Watermelon Dew"), "Glow Recipe", [post(["https://ig/w.jpg"], "Summer is here 🍉 #watermelondew")])).toEqual(["https://ig/w.jpg"]);
  });

  it("puts posts from the campaign's launch first and leaves out posts years away", () => {
    const launch = post(["https://ig/launch.jpg"], "Red Cushion is here", "2024-03-05T10:00:00+0000");
    const later = post(["https://ig/later.jpg"], "Red Cushion restock", "2025-01-05T10:00:00+0000");
    const years = post(["https://ig/old.jpg"], "Red Cushion throwback", "2021-01-05T10:00:00+0000");
    expect(matchPosts({ title: "Red Cushion", date: "2024-03" }, "TIRTIR", [later, years, launch])).toEqual(["https://ig/launch.jpg", "https://ig/later.jpg"]);
  });
});

describe("pageMentions", () => {
  it("needs the brand's name and a distinctive word of the title", () => {
    expect(pageMentions("TIRTIR named V its global ambassador for V&YOU: Let's Radiate.", "V&YOU: Let's Radiate", "TIRTIR")).toBe(true);
    expect(pageMentions("보도자료 | 뉴스룸 | 무신사 0건의 소식이 있습니다.", "JUMISO x Jujutsu Kaisen Collaboration", "Jumiso")).toBe(false);
    expect(pageMentions("JUMISO launches a new cream.", "JUMISO x Jujutsu Kaisen Collaboration", "Jumiso")).toBe(false);
    expect(pageMentions("", "Anything", "Jumiso")).toBe(false);
  });

  it("accepts a Korean article that names the campaign without the Latin brand name", () => {
    const text = "넘버즈인, NCT WISH와 함께한 '화잘먹' 캠페인 공개";
    expect(pageMentions(text, "NCT WISH ‘화잘먹’ Campaign", "numbuzin")).toBe(true);
    // One shared word without the brand is a coincidence.
    expect(pageMentions("Our wish list for winter", "NCT WISH ‘화잘먹’ Campaign", "numbuzin")).toBe(false);
  });
});
