// Ported from db-admin src/server/images/check-image.ts (2026-10-21). Keep in step with the importer.
import "server-only";

import { imageSize } from "image-size";

import { fetchRemoteImage } from "@/lib/images/fetch-remote";
import {
  MIN_IMAGE_DIMENSION,
  passesMinDimension,
  type ImageSlot,
} from "@/lib/images/min-dimensions";
/** What an image URL actually is (db-admin `src/types/brand-import.ts`). */
export interface ImageCheckResult {
  url: string;
  slot: ImageSlot;
  ok: boolean;
  status: number;
  width?: number;
  height?: number;
  bytes?: number;
  contentType?: string;
  format?: string;
  passesMin: boolean;
  minDimension: number;
  reason?: string;
}

function notAnImageReason(contentType: string | undefined): string {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (type === "text/html" || type === "application/xhtml+xml") {
    return "This is a web page, not an image — right-click the image itself and choose \"Copy image address\"";
  }
  if (type.startsWith("text/") || type === "application/json") {
    return `The URL returned ${type}, not an image — copy the image's own address`;
  }
  return "Fetched, but the bytes are not a readable image";
}

/**
 * Fetch a remote image and report what it actually is: real dimensions, byte
 * size, content type. Nothing is persisted.
 *
 * Shared by the Tools image checker and the CSV import dry run so both report
 * a URL identically — the checker's verdict is a promise the importer keeps.
 */
export async function checkImageUrl(
  url: string,
  slot: ImageSlot,
): Promise<ImageCheckResult> {
  const minDimension = MIN_IMAGE_DIMENSION[slot];
  const result = await fetchRemoteImage(url, { refererStrategy: "origin" });

  if (!result.ok || !result.buffer) {
    return {
      url,
      slot,
      ok: false,
      status: result.status,
      passesMin: false,
      minDimension,
      reason: result.error ?? "Could not fetch image",
    };
  }

  let width: number | undefined;
  let height: number | undefined;
  let format: string | undefined;
  try {
    const dim = imageSize(new Uint8Array(result.buffer));
    width = dim.width;
    height = dim.height;
    format = dim.type;
  } catch {
    return {
      url,
      slot,
      ok: false,
      status: result.status,
      bytes: result.bytes,
      contentType: result.contentType,
      passesMin: false,
      minDimension,
      // Overwhelmingly this means a page URL was pasted instead of the image's
      // own address — say so, rather than reporting unreadable bytes.
      reason: notAnImageReason(result.contentType),
    };
  }

  if (!width || !height) {
    return {
      url,
      slot,
      ok: false,
      status: result.status,
      bytes: result.bytes,
      contentType: result.contentType,
      format,
      passesMin: false,
      minDimension,
      reason: "Could not read image dimensions",
    };
  }

  const passesMin = passesMinDimension(slot, width, height);

  return {
    url,
    slot,
    ok: true,
    status: result.status,
    width,
    height,
    bytes: result.bytes,
    contentType: result.contentType,
    format,
    passesMin,
    minDimension,
    ...(passesMin
      ? {}
      : {
          reason: `${width}×${height} — below the ${minDimension}px minimum for a ${slot} image`,
        }),
  };
}
