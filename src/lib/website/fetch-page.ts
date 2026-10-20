import "server-only";
import type { FetchedPage } from "@/lib/website/judge";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000;

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, MAX_BYTES));
}

async function once(url: string): Promise<{ res: Response; html: string }> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { res, html: await readCapped(res) };
}

/** The one place the research job fetches a web page. Never throws: failures come back as data. */
export async function fetchPage(url: string): Promise<FetchedPage> {
  const started = Date.now();
  try {
    let { res, html } = await once(url);
    // One hop of <meta http-equiv="refresh" content="0; url=...">, which fetch does not follow.
    const refresh = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"'>]+)/i)?.[1];
    if (refresh) {
      const next = new URL(refresh.trim(), res.url).toString();
      ({ res, html } = await once(next));
    }
    return { requestedUrl: url, ok: res.ok, status: res.status, finalUrl: res.url, html, error: null, elapsedMs: Date.now() - started };
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause?.code;
    const message = cause ?? (error instanceof Error ? error.name : "fetch failed");
    return { requestedUrl: url, ok: false, status: null, finalUrl: null, html: "", error: message, elapsedMs: Date.now() - started };
  }
}
