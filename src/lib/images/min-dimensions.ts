// Copied from db-admin src/lib/images/min-dimensions.ts (2026-10-21). Keep in step with the importer.
/**
 * Minimum accepted pixel dimensions per image slot.
 *
 * These differ on purpose. Instagram profile pictures — the source admins pull
 * brand logos from — are around 320px, so the 800px baseline used for cover and
 * campaign art would reject every logo.
 *
 * 800 matches `MIN_DIMENSION` in `exportCampaignCropImage.ts`, the crispness
 * floor the interactive cropper already upscales to.
 *
 * The failure this catches: `encrypted-tbn0.gstatic.com` thumbnails off Google
 * Images are ~300px and perfectly valid JPEGs. Without a dimension check they
 * pass every "is this an image" test and ship blurry.
 */
export type ImageSlot = "logo" | "cover" | "campaign";

export const MIN_IMAGE_DIMENSION: Record<ImageSlot, number> = {
  logo: 256,
  cover: 800,
  campaign: 800,
};

export const IMAGE_SLOTS: ImageSlot[] = ["logo", "cover", "campaign"];

/** Longest edge must clear the slot's floor. */
export function passesMinDimension(
  slot: ImageSlot,
  width: number,
  height: number,
): boolean {
  return Math.max(width, height) >= MIN_IMAGE_DIMENSION[slot];
}
