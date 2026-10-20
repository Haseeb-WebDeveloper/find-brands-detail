/**
 * Website accuracy on the audited brands:  pnpm test-set            (with the sheet's hints)
 *                                          pnpm test-set --no-hints (Gemini discovery only)
 * Makes real requests. Two scores: an official site was chosen (or, for a brand with none,
 * nothing was), and the preferred one was. A chosen trap is a hard failure (exit 1).
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { TEST_SET } from "../tests/test-set";
import { researchWebsite, siteRegion } from "../src/lib/website/research";
import { fetchPage } from "../src/lib/website/fetch-page";
import { latestSnapshot } from "../src/lib/website/archive";
import { findOfficialSites } from "../src/lib/website/discover";
import { registrableDomain } from "../src/lib/website/domain";

const noHints = process.argv.includes("--no-hints");
let official = 0;
let preferred = 0;
let trapChosen = false;

for (const b of TEST_SET) {
  const r = await researchWebsite(b.name, noHints ? null : b.hint, { fetchPage, latestSnapshot, findOfficialSites });
  const got = r.chosen ? registrableDomain(new URL(r.chosen.verdict.siteUrl).hostname) : null;
  const isOfficial = b.official.length === 0 ? got === null : got !== null && b.official.includes(got);
  const isPreferred = got === b.prefer;
  if (isOfficial) official++;
  if (isPreferred) preferred++;
  if (b.trap && got === registrableDomain(new URL(b.hint).hostname)) trapChosen = true;

  const hint = r.candidates.find((c) => c.source === "hint")?.verdict;
  const region = r.chosen ? siteRegion(r.chosen) : "-";
  const mark = isPreferred ? "✓" : isOfficial ? "~" : "✗";
  console.log(
    `${mark} ${b.name.padEnd(16)} prefer ${String(b.prefer).padEnd(22)} got ${String(got).padEnd(22)} ${region.padEnd(6)}` +
      (hint ? ` hint: ${hint.score}/${hint.kind}` : "") +
      ` · ${r.candidates.length} checked`,
  );
}

const n = TEST_SET.length;
console.log(`\n✓ preferred  ~ official but not preferred  ✗ wrong`);
console.log(`Website${noHints ? " (no hints)" : ""}: official ${official}/${n}, preferred ${preferred}/${n}.`);
if (trapChosen) {
  console.error("FAIL: a trap site was chosen.");
  process.exit(1);
}
