import { describe, expect, it } from "vitest";
import { matchPosts } from "@/lib/campaigns/posts";

const posts = [
  { mediaType: "IMAGE", mediaUrl: "https://ig/1.jpg", caption: "Meet our new Red Cushion campaign ❤️ #TIRTIR" },
  { mediaType: "VIDEO", mediaUrl: "https://ig/2.mp4", caption: "Red Cushion in motion" },
  { mediaType: "CAROUSEL_ALBUM", mediaUrl: "https://ig/3.jpg", caption: "TIRTIR world tour, The First Light" },
  { mediaType: "IMAGE", mediaUrl: "https://ig/4.jpg", caption: "TIRTIR everyday glow" },
];

describe("matchPosts", () => {
  it("matches image posts whose caption names the campaign, ignoring the brand's own name", () => {
    expect(matchPosts("Red Cushion Launch", "TIRTIR", posts)).toEqual(["https://ig/1.jpg"]);
    expect(matchPosts("World Tour; The First Light", "TIRTIR", posts)).toEqual(["https://ig/3.jpg"]);
    // "Glow" is a word every beauty caption uses; it doesn't identify a campaign.
    expect(matchPosts("TIRTIR Glow", "TIRTIR", posts)).toEqual([]);
    // Seasons and generic words never match on their own.
    expect(matchPosts("Spring Renewal Campaign", "TIRTIR", [{ mediaType: "IMAGE", mediaUrl: "https://ig/5.jpg", caption: "Spring is here" }])).toEqual([]);
    // One shared word out of four is a coincidence.
    expect(matchPosts("World Tour; The First Light", "TIRTIR", [{ mediaType: "IMAGE", mediaUrl: "https://ig/6.jpg", caption: "First look at our toner" }])).toEqual([]);
  });
});
