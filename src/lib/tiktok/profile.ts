import http2 from "node:http2";
import * as cheerio from "cheerio";

export type TtProfile = {
  username: string;
  name: string | null;
  verified: boolean;
  bioLink: string | null;
  signature: string | null;
  followers: number;
  private: boolean;
  /** The largest profile picture (1080 px); a signed link that expires. */
  avatar: string | null;
};

export type TtLookup = { ok: true; profile: TtProfile } | { ok: false; reason: "not_found" | "blocked"; message: string };

/** TikTok's "no such account" status in the profile page's data. */
const NOT_FOUND = 10221;
/** Googlebot gets 403 and link-preview bots get a stub; a desktop browser gets the profile data. */
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const PAUSE_MS = 3_000;
const RETRY_PAUSE_MS = 8_000;

const BLOCKED = { ok: false, reason: "blocked", message: "TikTok didn't show the profile, so it couldn't be checked." } as const;

type Detail = {
  statusCode?: number;
  userInfo?: {
    user?: { uniqueId?: string; nickname?: string; verified?: boolean; signature?: string; privateAccount?: boolean; bioLink?: { link?: string }; avatarLarger?: string };
    stats?: { followerCount?: number };
  };
};

/**
 * The public profile page carries the profile as JSON for the app to hydrate. A page without it is
 * a bot check or a changed page: "blocked", never "doesn't exist".
 */
export function parseProfile(html: string, username: string): TtLookup {
  const raw = cheerio.load(html)("script#__UNIVERSAL_DATA_FOR_REHYDRATION__").text();
  if (!raw) return BLOCKED;
  let detail: Detail | undefined;
  try {
    detail = (JSON.parse(raw) as { __DEFAULT_SCOPE__?: Record<string, Detail> }).__DEFAULT_SCOPE__?.["webapp.user-detail"];
  } catch {
    return BLOCKED;
  }
  if (detail?.statusCode === NOT_FOUND) return { ok: false, reason: "not_found", message: "No TikTok account by this name." };
  const user = detail?.userInfo?.user;
  if (!user?.uniqueId || user.uniqueId.toLowerCase() !== username.toLowerCase()) return BLOCKED;
  const link = user.bioLink?.link?.trim() || null;
  return {
    ok: true,
    profile: {
      username: user.uniqueId.toLowerCase(),
      name: user.nickname || null,
      verified: user.verified === true,
      bioLink: link ? (/^https?:\/\//i.test(link) ? link : `https://${link}`) : null,
      signature: user.signature || null,
      followers: detail?.userInfo?.stats?.followerCount ?? 0,
      private: user.privateAccount === true,
      avatar: user.avatarLarger || null,
    },
  };
}

const TIMEOUT_MS = 20_000;
const MAX_BYTES = 2_000_000;

/**
 * One page over HTTP/2. Not `fetch`: TikTok answers Node's fetch (its extra browser-style headers)
 * with a bot-check page, but serves the profile to a plain HTTP/2 request (probed 2026-10-20).
 */
function getPage(path: string): Promise<{ status: number; html: string }> {
  return new Promise((resolve, reject) => {
    const session = http2.connect("https://www.tiktok.com");
    const timer = setTimeout(() => session.destroy(new Error("timeout")), TIMEOUT_MS);
    const done = (fn: () => void) => {
      clearTimeout(timer);
      session.close();
      fn();
    };
    session.on("error", (e) => done(() => reject(e)));
    const req = session.request({ ":path": path, "user-agent": CHROME, "accept-language": "en-US,en;q=0.9", accept: "text/html" });
    let status = 0;
    let html = "";
    req.setEncoding("utf8");
    req.on("response", (headers) => (status = Number(headers[":status"])));
    req.on("data", (chunk: string) => {
      if (html.length < MAX_BYTES) html += chunk;
    });
    req.on("end", () => done(() => resolve({ status, html })));
    req.on("error", (e) => done(() => reject(e)));
    req.end();
  });
}

let last = 0;

/** Paced, one at a time, never throws: any failure is "blocked". A block is tried once more, slower. */
export async function lookupProfile(username: string): Promise<TtLookup> {
  const first = await lookupOnce(username);
  if (first.ok || first.reason !== "blocked") return first;
  await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
  return lookupOnce(username);
}

async function lookupOnce(username: string): Promise<TtLookup> {
  const wait = last + PAUSE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  try {
    const { status, html } = await getPage(`/@${encodeURIComponent(username)}`);
    return status === 200 ? parseProfile(html, username) : BLOCKED;
  } catch {
    return BLOCKED;
  }
}
