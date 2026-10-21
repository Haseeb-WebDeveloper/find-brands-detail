import type { FetchedPage } from "@/lib/website/judge";
import type { ImageCheckResult } from "@/lib/images/check-image";
import { linkExpiry } from "@/lib/images/expiry";
import { chooseImage, scoreImage, type ImageCandidate, type ImageSource, type ImageVerdict } from "@/lib/images/score";
import { domainMatchesBrand, registrableDomain } from "@/lib/website/domain";
import { campaignsPrompt, parseCampaignsAnswer } from "@/lib/campaigns/find";
import { readCampaignPage } from "@/lib/campaigns/page";
import { matchPosts } from "@/lib/campaigns/posts";
import { cutToSentence, DESCRIPTION_MAX, describePrompt, parseDescriptions, shortenPrompt } from "@/lib/campaigns/describe";
import { noLog, type ResearchLog } from "@/lib/research/log-types";

type Post = { mediaUrl: string | null; caption: string | null; mediaType: string };
export type CampaignsInput = { brand: string; site: string | null; brandDomains: string[]; instagram: { handle: string; posts: Post[] } | null };

/** The network and the models, injected so the logic is tested with fakes. */
export type CampaignsDeps = {
  search(prompt: string, log: ResearchLog): Promise<string | null>;
  write(prompt: string): Promise<string | null>;
  fetchPage(url: string): Promise<FetchedPage>;
  checkImage(url: string): Promise<ImageCheckResult>;
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

const MAX_CHECKS = 5;
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

export async function researchCampaigns(input: CampaignsInput, deps: CampaignsDeps, log: ResearchLog = noLog, now = new Date()): Promise<ResearchedCampaign[]> {
  const text = await deps.search(campaignsPrompt({ brand: input.brand, site: input.site, instagram: input.instagram?.handle ?? null }), log);
  const found = text ? parseCampaignsAnswer(text) : [];
  if (found.length === 0) {
    await log("No campaigns found. Add them by hand during review.", "warn");
    return [];
  }
  await log(`Found ${found.length} possible campaign${found.length === 1 ? "" : "s"}: ${found.map((c) => c.title).join(", ")}.`);

  const owned = (url: string) => {
    const h = new URL(url).hostname;
    return input.brandDomains.includes(registrableDomain(h)) || domainMatchesBrand(h, input.brand);
  };
  const kept: (Omit<ResearchedCampaign, "description" | "descriptionNote"> & { text: string })[] = [];
  for (const c of found) {
    // Every source is fetched: the model sometimes names pages that don't exist.
    const pages: { url: string; images: string[]; text: string }[] = [];
    for (const url of c.sources) {
      const p = await deps.fetchPage(url);
      if (p.ok) pages.push({ url, ...readCampaignPage(p.html, p.finalUrl ?? url) });
    }
    const posts = input.instagram ? matchPosts(c.title, input.brand, input.instagram.posts) : [];
    if (pages.length === 0 && posts.length === 0) {
      await log(`Dropped "${c.title}": none of its source pages loaded.`, "warn");
      continue;
    }

    // Brand-owned images first (spec §3), then third-party pages.
    const leads: { url: string; source: ImageSource }[] = [];
    for (const p of [...pages].sort((a, b) => Number(owned(b.url)) - Number(owned(a.url)))) {
      const source: ImageSource = { kind: owned(p.url) ? "site" : "third_party", label: host(p.url) };
      for (const u of p.images) leads.push({ url: u, source });
    }
    for (const u of posts) leads.push({ url: u, source: { kind: "instagram", label: `a @${input.instagram?.handle} post` } });
    const images: ResearchedCampaign["images"] = [];
    // One at a time: politeness to each host (Global Constraints).
    for (const lead of leads.filter((l, i, all) => all.findIndex((x) => x.url === l.url) === i).slice(0, MAX_CHECKS)) {
      const check = await deps.checkImage(lead.url);
      const candidate: ImageCandidate = { slot: "campaign", url: lead.url, source: lead.source, check, expiresAt: linkExpiry(lead.url) };
      images.push({ candidate, verdict: scoreImage(candidate, now) });
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
      text: pages.map((p) => p.text).join("\n\n") || `An Instagram post by @${input.instagram?.handle} mentions ${c.title}.`,
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
