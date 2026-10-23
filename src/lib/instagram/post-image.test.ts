import { describe, expect, it } from "vitest";
import { instagramPostLink, parsePostImages, parsePostOwner } from "@/lib/instagram/post-image";

const cand = (file: string, width: number) => ({ url: `https://instagram.fna.fbcdn.net/v/t51/${file}_n.jpg?stp=s${width}&oe=6AE0CBCB`, width, height: Math.round(width * 1.25) });
const slide = (file: string) => ({ code: `child_${file}`, image_versions2: { candidates: [cand(file, 640), cand(file, 1440), cand(file, 320)] } });

/** The shape of Instagram's crawler page: another post's carousel (the grid), then this post's. */
const CAROUSEL = [
  `<meta property="og:image" content="https://scontent.cdninstagram.com/v/t51/videocover_n.jpg?stp=s640&amp;oe=1">`,
  `<script>{"code":"OTHER1","carousel_media":${JSON.stringify([slide("other_a")])}}`,
  `{"code":"POST1","user":{"pk":"1","username":"BornToStandOut.official"},"taken_at":1,"carousel_media":${JSON.stringify([slide("a"), slide("b"), slide("c")])}}</script>`,
].join("");

const SINGLE = [
  `<meta property="og:image" content="https://scontent.cdninstagram.com/v/t51/own_n.jpg?stp=s640&amp;oe=1">`,
  `<script>{"code":"POST2","user":{"username":"numbuzin_global"},"image_versions2":${JSON.stringify({ candidates: [cand("grid", 1080)] })}}`,
  `{"image_versions2":${JSON.stringify({ candidates: [cand("own", 640), cand("own", 1080)] })}}</script>`,
].join("");

describe("instagramPostLink", () => {
  it("reads the post's code and the slide from the links people paste", () => {
    expect(instagramPostLink("https://www.instagram.com/p/DeyptVvj3Me/")).toEqual({ code: "DeyptVvj3Me", slide: 1 });
    expect(instagramPostLink("https://www.instagram.com/p/DeyptVvj3Me/?img_index=3&igsh=x")).toEqual({ code: "DeyptVvj3Me", slide: 3 });
    expect(instagramPostLink("instagram.com/numbuzin_global/p/C-x_1/")).toEqual({ code: "C-x_1", slide: 1 });
    expect(instagramPostLink("https://www.instagram.com/reel/C9abc/")).toEqual({ code: "C9abc", slide: 1 });
  });

  it("is null for anything that isn't a post", () => {
    expect(instagramPostLink("https://www.instagram.com/numbuzin_global/")).toBeNull();
    expect(instagramPostLink("https://numbuzin.com/p/abc/")).toBeNull();
    expect(instagramPostLink("https://scontent.cdninstagram.com/v/x_n.jpg")).toBeNull();
  });
});

describe("parsePostImages", () => {
  it("reads the post's own carousel, largest size of each slide, in order", () => {
    expect(parsePostImages(CAROUSEL, "POST1").map((i) => [i.url.match(/t51\/(\w+)_n/)?.[1], i.width])).toEqual([
      ["a", 1440],
      ["b", 1440],
      ["c", 1440],
    ]);
  });

  it("reads a single image by the og:image's file, not another post's", () => {
    expect(parsePostImages(SINGLE, "POST2")).toEqual([{ url: cand("own", 1080).url, width: 1080, height: 1350 }]);
  });

  it("falls back to the og:image preview, and is empty without one", () => {
    const og = `<meta property="og:image" content="https://scontent.cdninstagram.com/v/t51/x_n.jpg?a=1&amp;b=2">`;
    expect(parsePostImages(og, "X")).toEqual([{ url: "https://scontent.cdninstagram.com/v/t51/x_n.jpg?a=1&b=2", width: null, height: null }]);
    expect(parsePostImages("<html></html>", "X")).toEqual([]);
  });
});

describe("parsePostOwner", () => {
  it("reads who posted it, after the post's code", () => {
    expect(parsePostOwner(CAROUSEL, "POST1")).toBe("borntostandout.official");
    expect(parsePostOwner(CAROUSEL, "MISSING")).toBeNull();
  });
});
