import type { FetchedPage } from "@/lib/website/judge";
import type { ImageCheckResult } from "@/lib/images/check-image";
import { linkExpiry } from "@/lib/images/expiry";
import { chooseImage, scoreImage, type ImageCandidate, type ImageSource, type ImageVerdict } from "@/lib/images/score";
import { domainMatchesBrand, registrableDomain } from "@/lib/website/domain";
import { campaignsPrompt, parseCampaignsAnswer } from "@/lib/campaigns/find";
import { readCampaignPage } from "@/lib/campaigns/page";
import { distinctiveWords, matchPosts, pageMentions } from "@/lib/campaigns/posts";
import type { IgPost } from "@/lib/instagram/history";
import { rankHits, type ImageHit } from "@/lib/images/search";
import { cutToSentence, DESCRIPTION_MAX, describePrompt, parseDescriptions, shortenPrompt } from "@/lib/campaigns/describe";
import { noLog, type ResearchLog } from "@/lib/research/log-types";

export type CampaignsInput = { brand: string; site: string | null; brandDomains: string[]; instagram: { handle: string } | null };

/** The network and the models, injected so the logic is tested with fakes. */
export type CampaignsDeps = {
  search(prompt: string, log: ResearchLog): Promise<string | null>;
  write(prompt: string): Promise<string | null>;
  fetchPage(url: string): Promise<FetchedPage>;
  checkImage(url: string): Promise<ImageCheckResult>;
  /** The brand's Instagram posts back to `since` (null: the latest ones). */
  loadPosts(since: Date | null): Promise<{ posts: IgPost[]; error: string | null }>;
  /** Free image search (lib/images/search.ts), for a campaign the brand's own images don't cover. */
  searchImages(query: string): Promise<{ hits: ImageHit[]; engine: string | null }>;
};

export type ResearchedCampaign = {
  title: string;
  date: string | null;
  description: string;
  /** Set when the description needs a closer look: cut to fit, or nothing to write it from. */
  descriptionNote: string | null;
  sources: string[];
  images: { candidate: ImageCandidate; verdict: ImageVerdict }[];
  chosen: ImageCandidate | null;
};

/** Images checked per campaign: a download each. */
const MAX_CHECKS = 8;
/** Image-search results checked per campaign: the best few by the rules in rankHits. */
const SEARCH_CHECKS = 4;
/** A campaign date: "2024-03", or "2024" (read as its January). */
const DATE = /^(\d{4})(?:-(\d{2}))?$/;

/** Where to read Instagram back to: a month before the oldest dated campaign; null when none is dated. */
export function postsSince(found: { date: string | null }[]): Date | null {
  const months = found.flatMap((c) => {
    const m = DATE.exec(c.date ?? "");
    return m ? [Date.UTC(Number(m[1]), Number(m[2] ?? 1) - 2, 1)] : [];
  });
  return months.length > 0 ? new Date(Math.min(...months)) : null;
}
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

export async function researchCampaigns(input: CampaignsInput, deps: CampaignsDeps, log: ResearchLog = noLog, now = new Date()): Promise<ResearchedCampaign[]> {
  const text = await deps.search(campaignsPrompt({ brand: input.brand, site: input.site, instagram: input.instagram?.handle ?? null }), log);
  const found = text ? parseCampaignsAnswer(text) : [];
  if (found.length === 0) {
    await log("No campaigns found. Add them by hand during review.", "warn");
    return [];
  }
  await log(`Found ${found.length} possible campaign${found.length === 1 ? "" : "s"}: ${found.map((c) => c.title).join(", ")}.`);

  let posts: IgPost[] = [];
  if (input.instagram) {
    const since = postsSince(found);
    const history = await deps.loadPosts(since);
    posts = history.posts;
    const oldest = posts.at(-1)?.timestamp.slice(0, 7);
    await log(
      history.error && posts.length === 0
        ? `Couldn't read @${input.instagram.handle}'s posts: ${history.error}`
        : `Read ${posts.length} @${input.instagram.handle} posts${oldest ? ` back to ${oldest}` : ""} to find campaign images${history.error ? ` (${history.error})` : ""}.`,
      history.error && posts.length === 0 ? "warn" : "info",
    );
  }

  const owned = (url: string) => {
    let h: string;
    try {
      h = new URL(url).hostname;
    } catch {
      return false;
    }
    return input.brandDomains.includes(registrableDomain(h)) || domainMatchesBrand(h, input.brand);
  };
  const kept: (Omit<ResearchedCampaign, "description" | "descriptionNote"> & { text: string })[] = [];
  for (const c of found) {
    // Every source is fetched: the model sometimes names pages that don't exist.
    const pages: { url: string; images: string[]; text: string }[] = [];
    let loaded = 0;
    for (const url of c.sources) {
      const p = await deps.fetchPage(url);
      if (!p.ok) continue;
      loaded++;
      const read = readCampaignPage(p.html, p.finalUrl ?? url, distinctiveWords(c.title, input.brand));
      if (pageMentions(read.text, c.title, input.brand)) pages.push({ url, ...read });
    }
    const fromPosts = input.instagram ? matchPosts(c, input.brand, posts) : [];
    // Posts only add images: a caption match alone is too weak to prove a campaign exists.
    if (pages.length === 0) {
      await log(`Dropped "${c.title}": ${loaded === 0 ? "none of its source pages loaded" : "its source pages don't mention it"}.`, "warn");
      continue;
    }

    const images: ResearchedCampaign["images"] = [];
    const checked = new Set<string>();
    // One at a time: politeness to each host (Global Constraints).
    const check = async (leads: { url: string; source: ImageSource }[], max: number) => {
      for (const lead of leads.filter((l) => !checked.has(l.url)).slice(0, max)) {
        checked.add(lead.url);
        const result = await deps.checkImage(lead.url);
        const candidate: ImageCandidate = { slot: "campaign", url: lead.url, source: lead.source, check: result, expiresAt: linkExpiry(lead.url) };
        images.push({ candidate, verdict: scoreImage(candidate, now) });
      }
    };

    // Brand-owned images first (spec §3): the brand's pages, then its Instagram posts (its own
    // campaign visuals, in the portrait shape the DB shows).
    const brandLeads: { url: string; source: ImageSource }[] = [];
    for (const p of pages.filter((x) => owned(x.url))) for (const u of p.images) brandLeads.push({ url: u, source: { kind: "site", label: host(p.url) } });
    for (const u of fromPosts) brandLeads.push({ url: u, source: { kind: "instagram", label: `a @${input.instagram?.handle} post` } });
    await check(brandLeads, MAX_CHECKS);

    // Nothing usable from the brand: an image search (free, no AI), then the press pages' images.
    if (!images.some((i) => i.verdict.score !== "rejected")) {
      const words = distinctiveWords(c.title, input.brand);
      const { hits, engine } = await deps.searchImages(`${input.brand} ${c.title} campaign`);
      const ranked = rankHits(hits, words, owned, SEARCH_CHECKS);
      await log(
        engine
          ? `Searched ${engine} images for "${c.title}": ${ranked.length} of ${hits.length} result${hits.length === 1 ? "" : "s"} name it.`
          : `Couldn't search images for "${c.title}".`,
        engine ? "info" : "warn",
      );
      const otherLeads: { url: string; source: ImageSource }[] = ranked.map((h) => ({ url: h.url, source: { kind: owned(h.page) ? "site" : "third_party", label: host(h.page) } }));
      for (const p of pages.filter((x) => !owned(x.url))) for (const u of p.images) otherLeads.push({ url: u, source: { kind: "third_party", label: host(p.url) } });
      await check(otherLeads, MAX_CHECKS);
    }
    const chosen = chooseImage(images);
    const verdict = images.find((i) => i.candidate === chosen)?.verdict;
    await log(
      `"${c.title}"${c.date ? ` (${c.date})` : ""}: ${chosen && verdict ? `image ${verdict.reason}` : "no usable image yet."}`,
      verdict?.score === "proven" ? "good" : "warn",
    );
    kept.push({
      title: c.title,
      date: c.date,
      sources: pages.map((p) => p.url),
      images,
      chosen,
      text: pages.map((p) => p.text).join("\n\n"),
    });
  }
  if (kept.length === 0) return [];

  await log("Writing the campaign descriptions…");
  const written = parseDescriptions((await deps.write(describePrompt(input.brand, kept))) ?? "", kept.length);
  // The model sometimes skips one: ask once more for just those.
  const missing = kept.map((c, i) => ({ c, i })).filter(({ i }) => !written[i]);
  if (missing.length > 0) {
    const again = parseDescriptions((await deps.write(describePrompt(input.brand, missing.map(({ c }) => c)))) ?? "", missing.length);
    missing.forEach(({ i }, n) => (written[i] = again[n]));
  }
  const out: ResearchedCampaign[] = [];
  for (const [i, { text: _text, ...c }] of kept.entries()) {
    let description = written[i] ?? "";
    let descriptionNote: string | null = description ? null : "Nothing to write from yet. Write it during review.";
    if (description.length > DESCRIPTION_MAX) {
      // Spec §7: over the limit is re-requested shorter before review.
      const shorter = (await deps.write(shortenPrompt(input.brand, c.title, description)))?.trim() ?? "";
      if (shorter && shorter.length <= DESCRIPTION_MAX) {
        description = shorter;
      } else {
        description = cutToSentence(shorter || description);
        descriptionNote = "Shortened to fit 500 characters; check the ending.";
      }
    }
    out.push({ ...c, description, descriptionNote });
  }
  // Most recent first (spec §3); undated last, keeping the order they were found.
  return out
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (b.c.date ?? "").localeCompare(a.c.date ?? "") || a.i - b.i)
    .map(({ c }) => c);
}
