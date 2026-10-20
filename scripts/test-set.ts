/**
 * Website, Instagram and TikTok accuracy on the audited brands:
 *   pnpm test-set             (with the sheet's hints)
 *   pnpm test-set --no-hints  (Gemini discovery only)
 * Makes real requests. Website: an official site was chosen (or, for a brand with none, nothing
 * was), and the preferred one was. Instagram: the expected account was chosen. TikTok: likewise, on the
 * brands with an audited account. A chosen trap site or trap account is a hard failure (exit 1).
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { TEST_SET } from "../tests/test-set";
import { researchWebsite, siteRegion } from "../src/lib/website/research";
import { fetchPage } from "../src/lib/website/fetch-page";
import { latestSnapshot } from "../src/lib/website/archive";
import { findOfficialSites } from "../src/lib/website/discover";
import { registrableDomain } from "../src/lib/website/domain";
import { researchInstagram } from "../src/lib/instagram/research";
import { lookupBusiness } from "../src/lib/instagram/discovery";
import { fetchBadge } from "../src/lib/instagram/badge";
import { checkBioLink } from "../src/lib/instagram/bio-link";
import { researchTiktok } from "../src/lib/tiktok/research";
import { lookupProfile } from "../src/lib/tiktok/profile";
import { readLinkPage } from "../src/lib/tiktok/link-page";

const noHints = process.argv.includes("--no-hints");
let official = 0;
let preferred = 0;
let trapChosen = false;
let igRight = 0;
let igTrapChosen = false;
let ttRight = 0;
let ttTrapChosen = false;

for (const b of TEST_SET) {
  const r = await researchWebsite(b.name, noHints ? null : b.hint, { fetchPage, latestSnapshot, findOfficialSites });
  const got = r.chosen ? registrableDomain(new URL(r.chosen.verdict.siteUrl).hostname) : null;
  const isOfficial = b.official.length === 0 ? got === null : got !== null && b.official.includes(got);
  const isPreferred = got === b.prefer;
  if (isOfficial) official++;
  if (isPreferred) preferred++;
  if (b.trap && got === registrableDomain(new URL(b.hint).hostname)) trapChosen = true;

  // Instagram, from the pages the website research read (as the job does).
  const brandDomains = [
    ...new Set(r.candidates.filter((c) => c.verdict.score !== "rejected").map((c) => registrableDomain(new URL(c.verdict.siteUrl).hostname))),
  ];
  const igPages = r.candidates.flatMap((c) => (c.facts ? [{ url: c.verdict.siteUrl, region: siteRegion(c), facts: c.facts }] : []));
  const ig = await researchInstagram({ brand: b.name, pages: igPages, brandDomains }, { lookupBusiness, fetchBadge, checkBioLink });
  const igGot = ig.chosen?.handle ?? null;
  if (igGot === b.instagram) igRight++;
  if (igGot && b.igTraps?.includes(igGot)) igTrapChosen = true;
  // Meta could not answer: say so, so a token or limit problem isn't read as a wrong answer.
  const unreachable = ig.scored.find((s) => !s.candidate.discovery.ok && s.candidate.discovery.reason !== "not_business");
  const igNote = unreachable && !unreachable.candidate.discovery.ok ? ` [meta: ${unreachable.candidate.discovery.reason}]` : "";

  const ttInstagram = ig.chosen ? { handle: ig.chosen.handle, website: ig.chosen.discovery.ok ? ig.chosen.discovery.profile.website : null } : null;
  const tt = await researchTiktok({ brand: b.name, pages: igPages, brandDomains, instagram: ttInstagram }, { lookupProfile, readLinkPage, checkBioLink });
  const ttGot = tt.chosen?.handle ?? null;
  if (b.tiktok && ttGot === b.tiktok) ttRight++;
  if (ttGot && b.ttTraps?.includes(ttGot)) ttTrapChosen = true;
  const ttNote = tt.scored.some((s) => !s.candidate.lookup.ok && s.candidate.lookup.reason === "blocked") ? " [tiktok: blocked]" : "";
  const ttWant = b.tiktok ?? "?";

  const hint = r.candidates.find((c) => c.source === "hint")?.verdict;
  const region = r.chosen ? siteRegion(r.chosen) : "-";
  const mark = isPreferred ? "✓" : isOfficial ? "~" : "✗";
  console.log(
    `${mark} ${b.name.padEnd(16)} prefer ${String(b.prefer).padEnd(22)} got ${String(got).padEnd(22)} ${region.padEnd(6)}` +
      (hint ? ` hint: ${hint.score}/${hint.kind}` : "") +
      ` · ${r.candidates.length} checked` +
      ` · ig ${igGot ?? "-"}${igGot === b.instagram ? "" : ` (want ${b.instagram})`}${igNote}` +
      ` · tt ${ttGot ?? "-"}${ttGot === b.tiktok ? "" : ` (want ${ttWant})`}${ttNote}`,
  );
}

const n = TEST_SET.length;
console.log(`\n✓ preferred  ~ official but not preferred  ✗ wrong`);
console.log(`Website${noHints ? " (no hints)" : ""}: official ${official}/${n}, preferred ${preferred}/${n}.`);
console.log(`Instagram: right ${igRight}/${n}.`);
console.log(`TikTok: right ${ttRight}/${TEST_SET.filter((b) => b.tiktok).length} (brands with an audited account).`);
if (ttTrapChosen) {
  console.error("FAIL: a TikTok trap account was chosen.");
  process.exit(1);
}
if (igTrapChosen) {
  console.error("FAIL: an Instagram trap account was chosen.");
  process.exit(1);
}
if (trapChosen) {
  console.error("FAIL: a trap site was chosen.");
  process.exit(1);
}
