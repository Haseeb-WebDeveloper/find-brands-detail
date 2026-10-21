// Copied from db-admin src/server/images/fetch-remote.ts (2026-10-21). Keep in step with the importer.
import "server-only";

import dns from "node:dns";
import type { LookupOptions } from "node:dns";
import { Resolver } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * Server-side remote-image fetcher.
 *
 * Extracted from `app/api/image-proxy/route.ts` so the image-proxy route, the
 * admin image checker, and the CSV brand importer all reach upstream hosts the
 * same way. That shared path is the point: if the checker can render a URL, the
 * importer can ingest it. A browser `<img src>` would prove nothing — browsers
 * send cookies and a Referer that this process does not.
 *
 * The Meta/TikTok CDN handling below (DoH, IPv6 literals, node:https fallback,
 * alternate-host retry) is load-bearing. Attempt ordering must not change.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const IMAGE_ACCEPT =
  "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";

/** Shorter than default — IPv6-only Meta POPs often hang until timeout on broken v6 routes. */
export const DEFAULT_TIMEOUT_MS = 12_000;

export const DEFAULT_MAX_BYTES = 15_000_000;

const MAX_REDIRECTS = 10;

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/**
 * Referer selection.
 *
 * `meta-default` reproduces the original image-proxy behavior, which sent an
 * instagram.com Referer to *every* unknown host. That is correct for the Meta
 * CDNs it was written for and harmless for the pipeline's own stored URLs.
 *
 * `origin` sends the image's own origin instead, which is what an arbitrary
 * host (a brand's site, Google's thumbnail CDN) expects to see. Known Meta and
 * TikTok hosts keep their special-cased Referer under both strategies.
 */
export type RefererStrategy = "meta-default" | "origin";

export interface FetchRemoteImageOptions {
  maxBytes?: number;
  timeoutMs?: number;
  refererStrategy?: RefererStrategy;
}

export interface RemoteImageResult {
  ok: boolean;
  status: number;
  buffer?: Buffer;
  contentType?: string;
  bytes?: number;
  finalUrl?: string;
  error?: string;
}

// ─── SSRF guards ─────────────────────────────────────────────────────────────

/**
 * Blocks loopback, private, link-local, ULA, multicast and reserved space.
 * `169.254.169.254` (cloud instance metadata) falls under the link-local /16.
 *
 * The importer fetches URLs typed into a spreadsheet, so this runs on every
 * resolved address and every redirect hop — not just on the URL as written.
 */
export function isPrivateAddress(address: string): boolean {
  const addr = address.trim().replace(/^\[|\]$/g, "").split("%")[0] ?? "";
  if (!addr) return true;

  if (net.isIPv4(addr)) return isPrivateIpv4(addr);
  if (net.isIPv6(addr)) return isPrivateIpv6(addr);
  return true; // not a literal address — caller must resolve first
}

function isPrivateIpv4(addr: string): boolean {
  const parts = addr.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmark
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function isPrivateIpv6(addr: string): boolean {
  const lower = addr.toLowerCase();
  if (lower === "::" || lower === "::1") return true;

  // IPv4-mapped (::ffff:1.2.3.4) — judge by the embedded v4 address.
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]);

  const head = lower.split(":")[0] ?? "";
  if (!head) return false; // e.g. "::abcd" — global unicast beyond the cases above
  const group = parseInt(head.padEnd(4, "0"), 16);
  if (Number.isNaN(group)) return true;

  if ((group & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((group & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((group & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

function privateAddressError(host: string, address: string): Error {
  return new Error(`Blocked non-public address for ${host}: ${address}`);
}

/**
 * Browsers use DNS-over-HTTPS while Node uses the OS resolver. Names like
 * `*.fna.fbcdn.net` then return ENOTFOUND in Node even when Chrome loads the URL.
 *
 * Bounded: a host that blocks outbound UDP 53 would otherwise stall every
 * lookup for the resolver's default retry budget.
 */
const publicDnsResolver = new Resolver({ timeout: 3_000, tries: 1 });
publicDnsResolver.setServers(["8.8.8.8", "1.1.1.1"]);

function enotFoundError(): NodeJS.ErrnoException {
  const e = new Error("getaddrinfo ENOTFOUND") as NodeJS.ErrnoException;
  e.code = "ENOTFOUND";
  e.syscall = "getaddrinfo";
  return e;
}

/**
 * Resolve a hostname and reject it if any answer points into non-public space.
 * A literal IP in the URL is checked directly.
 *
 * Residual risk: the plain `fetch()` path re-resolves internally after this
 * check, so a DNS-rebinding attacker could in principle swap the answer. The
 * node:https path is immune (it connects to the address validated here). Both
 * paths are behind an admin role check.
 */
async function assertPublicHostname(hostname: string): Promise<void> {
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(bare)) {
    if (isPrivateAddress(bare)) throw privateAddressError(hostname, bare);
    return;
  }

  const addresses: string[] = [];

  // The OS resolver first, because that is what `fetch` itself will use — we
  // want to validate the answer the request will actually connect to. It is
  // also the fast path; the public resolvers below only exist for names the OS
  // resolver cannot see (`*.fna.fbcdn.net`), and reaching them costs a UDP
  // round trip that some hosts block outright.
  try {
    const resolved = await dns.promises.lookup(bare, { all: true, verbatim: true });
    addresses.push(...resolved.map((r) => r.address));
  } catch {
    /* fall through to the public resolvers */
  }

  if (addresses.length === 0) {
    try {
      addresses.push(...(await publicDnsResolver.resolve4(bare)));
    } catch {
      /* no A record */
    }
    try {
      addresses.push(...(await publicDnsResolver.resolve6(bare)));
    } catch {
      /* no AAAA record */
    }
  }

  if (addresses.length === 0) throw enotFoundError();

  for (const address of addresses) {
    if (isPrivateAddress(address)) throw privateAddressError(hostname, address);
  }
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | Array<{ address: string; family: number }>,
  family?: number,
) => void;

function lookupPublicDnsFirst(
  hostname: string,
  options: LookupOptions,
  callback: LookupCallback,
): void {
  const guard = (
    err: NodeJS.ErrnoException | null,
    address: string,
    family: number,
  ) => {
    if (err) {
      callback(err, "", 0);
      return;
    }
    if (isPrivateAddress(address)) {
      callback(privateAddressError(hostname, address) as NodeJS.ErrnoException, "", 0);
      return;
    }
    // Honour the custom-lookup contract: with `all`, the callback takes an
    // array and no family argument. Node tolerates the scalar form; Bun sorts
    // the first argument and throws on a string.
    if (options?.all) {
      callback(null, [{ address, family }]);
      return;
    }
    callback(null, address, family);
  };

  // A literal address needs no DNS query — resolving it would just burn the
  // resolver timeout before failing.
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(bare)) {
    guard(null, bare, net.isIPv6(bare) ? 6 : 4);
    return;
  }

  publicDnsResolver
    .resolve4(hostname)
    .then((addrs) => {
      const a = addrs[0];
      if (typeof a === "string" && a.length > 0) {
        guard(null, a, 4);
        return;
      }
      throw new Error("empty A");
    })
    .catch(() => {
      publicDnsResolver
        .resolve6(hostname)
        .then((addrs) => {
          const a = addrs[0];
          if (typeof a === "string" && a.length > 0) {
            guard(null, a, 6);
            return;
          }
          throw new Error("empty AAAA");
        })
        .catch(() => {
          dns.lookup(hostname, { verbatim: true, family: 0 }, (err, address, family) => {
            if (err) {
              guard(err, "", 0);
              return;
            }
            if (typeof address !== "string" || address.length === 0) {
              guard(enotFoundError(), "", 0);
              return;
            }
            guard(null, address, family);
          });
        });
    });
}

const metaHttpsAgent = new https.Agent({
  keepAlive: true,
  lookup: lookupPublicDnsFirst as unknown as net.LookupFunction,
});

// ─── Referer / URL shaping ───────────────────────────────────────────────────

function isTikTokHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.includes("tiktokcdn") || h.includes("tiktokv.com") || h === "www.tiktok.com"
  );
}

function isMetaHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.includes("fbcdn") ||
    h.includes("instagram") ||
    h.includes("cdninstagram") ||
    h.includes("facebook.com")
  );
}

function refererForUpstream(hostname: string, strategy: RefererStrategy): string {
  if (isTikTokHost(hostname)) return "https://www.tiktok.com/";
  if (isMetaHost(hostname)) return "https://www.instagram.com/";
  if (strategy === "origin") return `https://${hostname}/`;
  return "https://www.instagram.com/";
}

function altRefererForMeta(hostname: string): string {
  const h = hostname.toLowerCase();
  if (h.includes("tiktok")) return "https://www.tiktok.com/";
  return "https://www.facebook.com/";
}

/**
 * Pipelines sometimes store Meta CDN URLs with duplicate query keys (e.g. `_nc_ohc`
 * twice). Some stacks reject that; `URLSearchParams.set` keeps the last value per key.
 */
function dedupeUrlQueryString(href: string): string {
  try {
    const u = new URL(href);
    const next = new URL(u.toString());
    const p = new URLSearchParams();
    u.searchParams.forEach((value, key) => {
      p.set(key, value);
    });
    next.search = p.toString();
    return next.toString();
  } catch {
    return href;
  }
}

/** Dedupe query string for Meta CDN URLs only. */
function prepareMetaImageUrl(href: string): string {
  try {
    const h = new URL(href).hostname.toLowerCase();
    if (h.includes("fbcdn") || h.includes("instagram") || h.includes("facebook.com")) {
      return dedupeUrlQueryString(href);
    }
  } catch {
    /* ignore */
  }
  return href;
}

/**
 * `instagram.*.fna.fbcdn.net` is often IPv6-only; many networks time out on v6.
 * The same asset path frequently works on `scontent.*` (dual-stack / IPv4).
 */
function alternateMetaFnaFbcdnUrl(href: string): string | null {
  try {
    const u = new URL(href);
    const h = u.hostname.toLowerCase();
    if (!h.endsWith(".fna.fbcdn.net")) return null;
    if (h.startsWith("instagram.")) {
      u.hostname = `scontent.${h.slice("instagram.".length)}`;
    } else if (h.startsWith("scontent.")) {
      u.hostname = `instagram.${h.slice("scontent.".length)}`;
    } else {
      return null;
    }
    if (u.searchParams.has("_nc_ht")) {
      u.searchParams.set("_nc_ht", u.hostname);
    }
    return u.toString();
  } catch {
    return null;
  }
}

function upstreamRequestHeaders(referer: string): Record<string, string> {
  return {
    "User-Agent": BROWSER_UA,
    Accept: IMAGE_ACCEPT,
    "Accept-Language": "en-US,en;q=0.9",
    Referer: referer,
  };
}

function timeoutSignal(timeoutMs: number): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(timeoutMs)
    : undefined;
}

// ─── DoH resolution ──────────────────────────────────────────────────────────

function normalizeIpv6FromDoh(data: string): string | null {
  const t = data.trim().replace(/\.$/, "").split("%")[0] ?? "";
  if (!t.includes(":") || IPV4_RE.test(t)) return null;
  return t;
}

type ResolvedConnect = { address: string; family: 4 | 6 };

/** Reject a DoH answer that points at non-public space. */
function guardResolved(hostname: string, resolved: ResolvedConnect): ResolvedConnect | null {
  if (isPrivateAddress(resolved.address)) {
    console.warn("[fetchRemoteImage] blocked non-public DoH answer", {
      hostname,
      address: resolved.address,
    });
    return null;
  }
  return resolved;
}

/**
 * Some Meta CDN hosts are IPv6-only (AAAA, no A). Browsers use Happy Eyeballs;
 * Node must resolve AAAA and connect with bracketed literal + correct SNI.
 * DoH covers blocked UDP DNS; type 28 covers v6-only names.
 */
async function resolveIpViaDoh(hostname: string): Promise<ResolvedConnect | null> {
  const baseOpts = () => {
    const signal = timeoutSignal(10_000);
    return { cache: "no-store" as const, ...(signal ? { signal } : {}) };
  };

  async function google(type: number): Promise<Array<{ type: number; data: string }> | null> {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=${type}`,
      { headers: { Accept: "application/json" }, ...baseOpts() },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      Status: number;
      Answer?: Array<{ type: number; data: string }>;
    };
    if (j.Status !== 0 || !j.Answer?.length) return null;
    return j.Answer;
  }

  try {
    const aAns = await google(1);
    const a = aAns?.find((x) => x.type === 1)?.data?.trim();
    if (a && IPV4_RE.test(a)) return guardResolved(hostname, { address: a, family: 4 });
  } catch {
    /* fall through */
  }

  try {
    const aaaaAns = await google(28);
    const raw = aaaaAns?.find((x) => x.type === 28)?.data?.trim();
    const v6 = raw ? normalizeIpv6FromDoh(raw) : null;
    if (v6) return guardResolved(hostname, { address: v6, family: 6 });
  } catch {
    /* try Cloudflare */
  }

  try {
    const c = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
      { headers: { Accept: "application/dns-json" }, ...baseOpts() },
    );
    if (c.ok) {
      const j = (await c.json()) as { Answer?: Array<{ type: number; data: string }> };
      const data = j.Answer?.find((a) => a.type === 1)?.data?.trim();
      if (data && IPV4_RE.test(data)) {
        return guardResolved(hostname, { address: data, family: 4 });
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const c = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=AAAA`,
      { headers: { Accept: "application/dns-json" }, ...baseOpts() },
    );
    if (c.ok) {
      const j = (await c.json()) as { Answer?: Array<{ type: number; data: string }> };
      const raw = j.Answer?.find((a) => a.type === 28)?.data?.trim();
      const v6 = raw ? normalizeIpv6FromDoh(raw) : null;
      if (v6) return guardResolved(hostname, { address: v6, family: 6 });
    }
  } catch {
    /* ignore */
  }

  return null;
}

function isEnotfound(err: unknown): boolean {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "ENOTFOUND"
  ) {
    return true;
  }
  if (err instanceof AggregateError) {
    return err.errors.some((e) => isEnotfound(e));
  }
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("ENOTFOUND") || msg.includes("getaddrinfo ENOTFOUND");
}

/** Lookup bug / v6-only edge cases can throw before a clean ENOTFOUND. */
function shouldRetryWithDoh(err: unknown): boolean {
  if (isEnotfound(err)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Invalid IP address");
}

/** Undici fetch often fails these hosts before node:https; skip to save ~12s each. */
function likelyUndiciFetchFails(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.includes("fbcdn.net") || h.includes("cdninstagram.com");
}

// ─── Transport: node:https ───────────────────────────────────────────────────

function nodeHttpRawRequest(
  u: URL,
  headerObj: Record<string, string>,
  isHttps: boolean,
  timeoutMs: number,
  maxBytes: number,
  connect?: ResolvedConnect,
): Promise<{ statusCode: number; inh: http.IncomingHttpHeaders; body: Buffer }> {
  const port = u.port ? Number(u.port) : isHttps ? 443 : 80;
  const pathWithQuery = u.pathname + u.search;
  const outHeaders = { ...headerObj, Host: u.hostname };

  return new Promise((resolve, reject) => {
    const opts: http.RequestOptions = {
      method: "GET",
      path: pathWithQuery,
      headers: outHeaders,
    };

    if (connect) {
      if (!connect.address?.trim()) {
        reject(new Error("Invalid IP address: undefined"));
        return;
      }
      if (isPrivateAddress(connect.address)) {
        reject(privateAddressError(u.hostname, connect.address));
        return;
      }
      const bare = connect.address.replace(/^\[|\]$/g, "");
      const v6 = connect.family === 6 || net.isIPv6(bare);
      opts.hostname = v6 ? `[${bare}]` : bare;
      opts.port = port;
      opts.agent = false;
      if (isHttps) {
        (opts as https.RequestOptions).servername = u.hostname;
      }
    } else {
      opts.hostname = u.hostname;
      opts.port = port;
      opts.lookup = lookupPublicDnsFirst as unknown as net.LookupFunction;
      if (isHttps) {
        (opts as https.RequestOptions).agent = metaHttpsAgent;
      }
    }

    // `req.destroy()` does not stop an already-queued `end` from firing, so a
    // truncated body would otherwise resolve as a successful 200.
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const lib = isHttps ? https : http;
    const req = lib.request(opts, (incoming) => {
      const declared = Number(incoming.headers["content-length"] ?? "0");
      if (declared > maxBytes) {
        const err = new Error(`Image exceeds ${maxBytes} byte limit`);
        incoming.destroy();
        req.destroy(err);
        settle(() => reject(err));
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;
      incoming.on("data", (chunk) => {
        if (settled) return;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buf.length;
        if (total > maxBytes) {
          const err = new Error(`Image exceeds ${maxBytes} byte limit`);
          incoming.destroy();
          req.destroy(err);
          settle(() => reject(err));
          return;
        }
        chunks.push(buf);
      });
      incoming.on("end", () => {
        settle(() =>
          resolve({
            statusCode: incoming.statusCode ?? 0,
            inh: incoming.headers,
            body: Buffer.concat(chunks),
          }),
        );
      });
      incoming.on("error", (err) => settle(() => reject(err)));
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (err) => settle(() => reject(err)));
    req.end();
  });
}

async function nodeHttpRawRequestWithDohFallback(
  u: URL,
  headerObj: Record<string, string>,
  isHttps: boolean,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ statusCode: number; inh: http.IncomingHttpHeaders; body: Buffer }> {
  try {
    return await nodeHttpRawRequest(u, headerObj, isHttps, timeoutMs, maxBytes);
  } catch (err) {
    if (!isHttps || !shouldRetryWithDoh(err)) throw err;
    const resolved = await resolveIpViaDoh(u.hostname);
    if (
      !resolved ||
      !resolved.address?.trim() ||
      (resolved.family === 4 && !IPV4_RE.test(resolved.address)) ||
      (resolved.family === 6 && !net.isIPv6(resolved.address.replace(/^\[|\]$/g, "")))
    ) {
      throw err;
    }
    return nodeHttpRawRequest(u, headerObj, isHttps, timeoutMs, maxBytes, resolved);
  }
}

/**
 * When global `fetch` throws `fetch failed` (common on Windows + Meta CDNs),
 * the same request via `node:https` with IPv4 often succeeds.
 */
async function fetchUpstreamViaNode(
  imageUrl: string,
  referer: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ status: number; buffer: Buffer; contentType: string; finalUrl: string }> {
  const headers = upstreamRequestHeaders(referer);
  let current = imageUrl;

  for (let r = 0; r <= MAX_REDIRECTS; r++) {
    const u = new URL(current);
    const isHttps = u.protocol === "https:";
    if (!isHttps && u.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }

    const { statusCode, inh, body } = await nodeHttpRawRequestWithDohFallback(
      u,
      headers,
      isHttps,
      timeoutMs,
      maxBytes,
    );

    if (REDIRECT_STATUS.has(statusCode) && inh.location) {
      const loc = Array.isArray(inh.location) ? inh.location[0] : inh.location;
      current = new URL(loc, current).href;
      const nu = new URL(current);
      if (nu.protocol !== "https:" && nu.protocol !== "http:") {
        throw new Error("invalid redirect");
      }
      continue;
    }

    const ctRaw = inh["content-type"];
    const ct = typeof ctRaw === "string" ? ctRaw : ctRaw?.[0] ?? "image/jpeg";

    return { status: statusCode, buffer: body, contentType: ct, finalUrl: current };
  }

  throw new Error("too many redirects");
}

// ─── Transport: undici fetch ─────────────────────────────────────────────────

async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw new Error(`Image exceeds ${maxBytes} byte limit`);
  }
  if (!res.body) {
    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) throw new Error(`Image exceeds ${maxBytes} byte limit`);
    return Buffer.from(ab);
  }

  const chunks: Buffer[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error(`Image exceeds ${maxBytes} byte limit`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/**
 * Redirects are followed manually so every hop can be re-validated against the
 * SSRF guard. `redirect: "follow"` would let a public host bounce us into
 * private space without a hook.
 */
async function fetchUpstreamViaFetch(
  imageUrl: string,
  referer: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ status: number; buffer: Buffer; contentType: string; finalUrl: string }> {
  let current = imageUrl;

  for (let r = 0; r <= MAX_REDIRECTS; r++) {
    const u = new URL(current);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
    await assertPublicHostname(u.hostname);

    const signal = timeoutSignal(timeoutMs);
    const res = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      ...(signal ? { signal } : {}),
      headers: upstreamRequestHeaders(referer),
    });

    if (REDIRECT_STATUS.has(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) {
        return {
          status: res.status,
          buffer: Buffer.alloc(0),
          contentType: "image/jpeg",
          finalUrl: current,
        };
      }
      current = new URL(loc, current).href;
      continue;
    }

    if (!res.ok) {
      return {
        status: res.status,
        buffer: Buffer.alloc(0),
        contentType: res.headers.get("content-type") ?? "image/jpeg",
        finalUrl: current,
      };
    }

    return {
      status: res.status,
      buffer: await readCapped(res, maxBytes),
      contentType: res.headers.get("content-type") ?? "image/jpeg",
      finalUrl: current,
    };
  }

  throw new Error("too many redirects");
}

// ─── Orchestration ───────────────────────────────────────────────────────────

type Attempt = { status: number; buffer: Buffer; contentType: string; finalUrl: string };

/**
 * Fetch a remote image with the browser-shaped headers and CDN fallbacks that
 * Meta and TikTok hosts demand. Never throws — failures surface as
 * `{ ok: false, error }` so callers can report per-URL rather than per-batch.
 */
export async function fetchRemoteImage(
  url: string,
  opts: FetchRemoteImageOptions = {},
): Promise<RemoteImageResult> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const strategy = opts.refererStrategy ?? "meta-default";

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, status: 400, error: "Invalid URL" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, status: 400, error: "Only http/https URLs are allowed" };
  }

  const host = parsed.hostname.toLowerCase();

  // Reject non-public targets before any transport runs. Both transports
  // re-check every redirect hop; this catches the URL as written without
  // paying two resolver timeouts first.
  try {
    await assertPublicHostname(parsed.hostname);
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: err instanceof Error ? err.message : "Blocked address",
    };
  }

  const primaryReferer = refererForUpstream(host, strategy);

  let activeUrl = prepareMetaImageUrl(url);
  let lastError: string | undefined;

  async function attempt(referer: string): Promise<Attempt | null> {
    try {
      return await fetchUpstreamViaFetch(activeUrl, referer, timeoutMs, maxBytes);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error("[fetchRemoteImage] fetch error", {
        host: safeHost(activeUrl),
        message: lastError,
      });
      return null;
    }
  }

  async function attemptNode(referer: string): Promise<Attempt | null> {
    try {
      return await fetchUpstreamViaNode(activeUrl, referer, timeoutMs, maxBytes);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error("[fetchRemoteImage] node https error", {
        host: safeHost(activeUrl),
        message: lastError,
      });
      return null;
    }
  }

  try {
    let res: Attempt | null = null;

    if (!likelyUndiciFetchFails(safeHost(activeUrl))) {
      res = await attempt(primaryReferer);
    }

    if (res === null) {
      res = await attemptNode(primaryReferer);
    }

    if (res === null) {
      const swapped = alternateMetaFnaFbcdnUrl(activeUrl);
      if (swapped) {
        activeUrl = prepareMetaImageUrl(swapped);
        if (process.env.NODE_ENV === "development") {
          console.info("[fetchRemoteImage] retry alternate host", {
            host: safeHost(activeUrl),
          });
        }
        if (!likelyUndiciFetchFails(safeHost(activeUrl))) {
          res = await attempt(primaryReferer);
        }
        if (res === null) {
          res = await attemptNode(primaryReferer);
        }
      }
    }

    if (res === null) {
      return { ok: false, status: 502, error: lastError ?? "Failed to fetch image" };
    }

    // Some Meta shards accept only an alternate Referer.
    if (res.status === 403 || res.status === 401) {
      const alt = altRefererForMeta(host);
      if (alt !== primaryReferer) {
        let second = await attempt(alt);
        if (second === null || second.status < 200 || second.status >= 300) {
          second = await attemptNode(alt);
        }
        if (second && second.status >= 200 && second.status < 300) {
          res = second;
        }
      }
    }

    if (res.status < 200 || res.status >= 300) {
      return {
        ok: false,
        status: res.status,
        error: `Upstream returned ${res.status}`,
        finalUrl: res.finalUrl,
      };
    }

    return {
      ok: true,
      status: res.status,
      buffer: res.buffer,
      contentType: res.contentType,
      bytes: res.buffer.byteLength,
      finalUrl: res.finalUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fetchRemoteImage]", err);
    return { ok: false, status: 502, error: message };
  }
}

function safeHost(href: string): string {
  try {
    return new URL(href).hostname;
  } catch {
    return "";
  }
}
