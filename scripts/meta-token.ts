/**
 * Swap a short Graph API Explorer token for a 60-day one:
 *   1. Explorer → app "Roofing" → permissions instagram_basic, instagram_manage_insights,
 *      pages_show_list, pages_read_engagement, business_management → Generate Access Token.
 *   2. Paste it into .env.local as META_TEST_USER_TOKEN=...
 *   3. pnpm meta:token
 * Writes META_ACCESS_TOKEN, META_IG_USER_ID and META_TOKEN_EXPIRES_AT into .env.local. Prints no secret.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const V = process.env.META_API_VERSION ?? "v26.0";
const { META_APP_ID: appId, META_APP_SECRET: secret, META_TEST_USER_TOKEN: short } = process.env;
if (!appId || !secret || !short) {
  console.error("Set META_APP_ID, META_APP_SECRET and META_TEST_USER_TOKEN in .env.local first.");
  process.exit(1);
}

async function graph(path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${V}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const body = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (body.error) throw new Error(`${path}: ${body.error.message ?? "Graph API error"}`);
  return body;
}

const exchanged = await graph("oauth/access_token", {
  grant_type: "fb_exchange_token",
  client_id: appId,
  client_secret: secret,
  fb_exchange_token: short,
});
const token = String(exchanged.access_token);
const expiresIn = Number(exchanged.expires_in ?? 60 * 24 * 60 * 60);
const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

// The Instagram business account: through the person's Pages, or a Business Manager's pages.
type Page = { instagram_business_account?: { id: string; username: string } };
const pages = (await graph("me/accounts", { fields: "instagram_business_account{id,username}", access_token: token })).data as Page[];
let ig = pages.find((p) => p.instagram_business_account)?.instagram_business_account;
if (!ig) {
  type Biz = { owned_pages?: { data: Page[] } };
  const biz = (await graph("me/businesses", { fields: "owned_pages{instagram_business_account{id,username}}", access_token: token })).data as Biz[];
  ig = biz.flatMap((b) => b.owned_pages?.data ?? []).find((p) => p.instagram_business_account)?.instagram_business_account;
}
if (!ig) {
  console.error("This token can't see an Instagram business account. Tick the Page and the Instagram account when generating it.");
  process.exit(1);
}

const set = (src: string, key: string, value: string) =>
  new RegExp(`^${key}=.*$`, "m").test(src) ? src.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`) : `${src.trimEnd()}\n${key}=${value}\n`;
let env = readFileSync(".env.local", "utf8");
env = set(env, "META_ACCESS_TOKEN", token);
env = set(env, "META_IG_USER_ID", ig.id);
env = set(env, "META_TOKEN_EXPIRES_AT", expiresAt);
writeFileSync(".env.local", env);
console.log(`Saved a long-lived token for @${ig.username}. It expires ${expiresAt.slice(0, 10)}.`);
