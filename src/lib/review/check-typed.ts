import type { FetchedPage, SiteVerdict } from "@/lib/website/judge";
import type { Discovery } from "@/lib/instagram/discovery";
import type { TtLookup } from "@/lib/tiktok/profile";
import type { ImageCheckResult } from "@/lib/images/check-image";
import { extractInstagramHandle, extractTikTokHandle } from "@/lib/export/importer/brand-create";
import { IG_HANDLE_RE, TT_HANDLE_RE } from "@/lib/export/importer/platforms";
import { linkExpiry } from "@/lib/images/expiry";
import { scoreImage } from "@/lib/images/score";
import type { ReviewField } from "@/lib/export/row";
import { instagramPostLink, type PostImageResult, type PostLink } from "@/lib/instagram/post-image";

export type TypedCheck = { value: string; score: "proven" | "review" | "rejected"; reason: string; evidence: Record<string, unknown> };

/** The checks research uses, injected so this is tested with fakes. */
export type TypedDeps = {
  brand: string;
  fetchPage(url: string): Promise<FetchedPage>;
  judgeSite(page: FetchedPage, brand: string): SiteVerdict;
  lookupBusiness(username: string): Promise<Discovery>;
  lookupProfile(username: string): Promise<TtLookup>;
  checkImage(url: string, slot: "logo" | "cover" | "campaign"): Promise<ImageCheckResult>;
  resolvePost(link: PostLink): Promise<PostImageResult>;
};

const BY = "Typed by a reviewer.";
const bad = (value: string, reason: string): TypedCheck => ({ value, score: "rejected", reason: `${BY} ${reason}`, evidence: {} });

function asUrl(raw: string): string | null {
  if (/\s/.test(raw)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return /^https?:$/.test(u.protocol) && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

/** A reviewer's typed value, checked the way research checks it (spec §8: "checked immediately"). */
export async function checkTyped(field: ReviewField | "campaign", raw: string, deps: TypedDeps, now = new Date()): Promise<TypedCheck> {
  const input = raw.trim();
  if (field === "website") {
    const url = asUrl(input);
    if (!url) return bad(input, "That isn't a web address.");
    const v = deps.judgeSite(await deps.fetchPage(url), deps.brand);
    return { value: `${new URL(v.siteUrl || url).origin}/`, score: v.score, reason: `${BY} ${v.reason}`, evidence: { kind: v.kind } };
  }
  if (field === "instagram") {
    const handle = extractInstagramHandle(input).toLowerCase();
    if (!IG_HANDLE_RE.test(handle)) return bad(input, "That isn't an Instagram handle.");
    const d = await deps.lookupBusiness(handle);
    if (!d.ok) return { value: handle, score: d.reason === "not_business" ? "rejected" : "review", reason: `${BY} ${d.message}`, evidence: {} };
    return {
      value: handle,
      score: "proven",
      reason: `${BY} Business account, ${d.profile.followers.toLocaleString("en-US")} followers.`,
      evidence: { followers: d.profile.followers, name: d.profile.name, website: d.profile.website, profilePictureUrl: d.profile.profilePictureUrl, recentMedia: d.profile.recentMedia },
    };
  }
  if (field === "tiktok") {
    const handle = extractTikTokHandle(input).toLowerCase();
    if (!TT_HANDLE_RE.test(handle)) return bad(input, "That isn't a TikTok handle.");
    const t = await deps.lookupProfile(handle);
    if (!t.ok) return { value: handle, score: t.reason === "not_found" ? "rejected" : "review", reason: `${BY} ${t.message}`, evidence: {} };
    return {
      value: handle,
      score: "proven",
      reason: `${BY} ${t.profile.followers.toLocaleString("en-US")} followers.`,
      evidence: { followers: t.profile.followers, name: t.profile.name, verified: t.profile.verified, avatarUrl: t.profile.avatar },
    };
  }
  // An Instagram post's link stands for its image: the full-size slide it names (post-image.ts).
  const post = instagramPostLink(input);
  let from = "";
  let fromPost: { post: string; owner: string | null } | null = null;
  let url: string | null;
  if (post) {
    const found = await deps.resolvePost(post);
    if (!found.ok) return bad(input, found.error);
    url = found.image.url;
    const who = found.owner ? `@${found.owner}'s` : "an";
    from = `From ${who} Instagram post${found.slides > 1 ? `, image ${found.slide} of ${found.slides}` : ""}. `;
    fromPost = { post: `https://www.instagram.com/p/${post.code}/`, owner: found.owner };
  } else {
    url = /^https?:\/\//i.test(input) ? asUrl(input) : null;
  }
  if (!url) return bad(input, "That isn't an image address. Paste an Instagram post's link, or right-click the image and copy its address.");
  const check = await deps.checkImage(url, field);
  const v = scoreImage({ slot: field, url, source: { kind: "site", label: "the reviewer" }, check, expiresAt: linkExpiry(url) }, now);
  // A typed logo can still need a look (too wide, or a link that expires): the reason says why.
  const reason = v.score === "proven" ? `${BY} ${from}${check.width}×${check.height}.` : `${BY} ${from}${v.reason}`;
  return { value: url, score: v.score, reason, evidence: { kind: "typed", width: check.width ?? null, height: check.height ?? null, ...fromPost } };
}
