import { describe, expect, it } from "vitest";
import { metaUsage, parseMediaPage } from "@/lib/instagram/history";

describe("parseMediaPage", () => {
  it("reads photos, every carousel image, no video, and the next-page cursor", () => {
    const page = parseMediaPage({
      business_discovery: {
        media: {
          data: [
            { media_type: "IMAGE", media_url: "https://ig/1.jpg", caption: "One", timestamp: "2026-10-19T10:00:00+0000", permalink: "p1" },
            {
              media_type: "CAROUSEL_ALBUM",
              media_url: "https://ig/2.jpg",
              caption: "Two",
              timestamp: "2026-10-18T10:00:00+0000",
              children: { data: [{ media_type: "IMAGE", media_url: "https://ig/2a.jpg" }, { media_type: "VIDEO", media_url: "https://ig/2b.mp4" }, { media_type: "IMAGE", media_url: "https://ig/2c.jpg" }] },
            },
            { media_type: "VIDEO", media_url: "https://ig/3.mp4", caption: "Three", timestamp: "2026-10-17T10:00:00+0000" },
          ],
          paging: { cursors: { after: "abc" } },
        },
      },
    });
    expect(page.posts.map((p) => p.images)).toEqual([["https://ig/1.jpg"], ["https://ig/2a.jpg", "https://ig/2c.jpg"], []]);
    expect(page.after).toBe("abc");
    expect(page.error).toBeNull();
  });

  it("reports Meta's error", () => {
    expect(parseMediaPage({ error: { message: "Application request limit reached" } })).toEqual({ posts: [], after: null, error: "Application request limit reached" });
  });
});

describe("metaUsage", () => {
  it("takes the highest of Meta's hourly figures", () => {
    expect(metaUsage('{"call_count":5,"total_cputime":0,"total_time":24}')).toBe(24);
    expect(metaUsage(null)).toBe(0);
    expect(metaUsage("not json")).toBe(0);
  });
});
