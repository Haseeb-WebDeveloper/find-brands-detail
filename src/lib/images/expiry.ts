/** When a signed CDN link stops working: Instagram's `oe` (hex seconds), TikTok's `x-expires` (seconds). */
export function linkExpiry(url: string): Date | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const oe = u.searchParams.get("oe");
  if (oe && /^[0-9a-f]+$/i.test(oe)) return new Date(parseInt(oe, 16) * 1000);
  const xe = u.searchParams.get("x-expires");
  if (xe && /^\d+$/.test(xe)) return new Date(Number(xe) * 1000);
  return null;
}
