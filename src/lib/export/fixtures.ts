import type { ReviewState } from "@/lib/export/row";

/** Test fixture: a brand the DB importer accepts as it stands. */
const camp = (n: number, status: "proposed" | "approved" | "removed" = "approved") => ({
  title: `Campaign ${n}`,
  description: `What campaign ${n} shows.`,
  imageUrl: `https://numbuzin.com/c${n}.jpg`,
  status,
});

export const READY: ReviewState = {
  name: "numbuzin",
  website: "https://us.numbuzin.com/",
  instagram: "numbuzin_global",
  tiktok: "numbuzin_global",
  logo: "https://numbuzin.com/logo.png",
  cover: "https://numbuzin.com/og.jpg",
  text: { description: "Korean skincare by number.", tier: "Masstige", aesthetic: "clean, clinical", industry: "skincare", regions: "Asia|North America" },
  campaigns: [camp(1), camp(2, "removed"), camp(3), camp(4), camp(5, "proposed")],
  rejected: [],
};
