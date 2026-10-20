/**
 * Website accuracy on the audited brands:  pnpm test-set            (with the sheet's hints)
 *                                          pnpm test-set --no-hints (Gemini discovery only)
 * Makes real requests. A chosen trap is a hard failure (exit 1).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { TEST_SET } from "../tests/test-set";
import { researchWebsite } from "../src/lib/website/research";
import { fetchPage } from "../src/lib/website/fetch-page";
import { latestSnapshot } from "../src/lib/website/archive";
import { findOfficialSites } from "../src/lib/website/discover";
import { registrableDomain } from "../src/lib/website/domain";

const noHints = process.argv.includes("--no-hints");
let right = 0;
let trapChosen = false;

for (const b of TEST_SET) {
  const r = await researchWebsite(b.name, noHints ? null : b.hint, { fetchPage, latestSnapshot, findOfficialSites });
  const got = r.chosen ? registrableDomain(new URL(r.chosen.verdict.siteUrl).hostname) : null;
  const ok = got === b.expect;
  if (ok) right++;
  const hintDomain = registrableDomain(new URL(b.hint).hostname);
  if (b.trap && got === hintDomain && got !== b.expect) trapChosen = true;
  const hintVerdict = r.candidates.find((c) => c.source === "hint")?.verdict;
  console.log(
    `${ok ? "✓" : "✗"} ${b.name.padEnd(16)} expect ${String(b.expect).padEnd(22)} got ${String(got).padEnd(22)}` +
      (hintVerdict ? ` hint: ${hintVerdict.score}/${hintVerdict.kind}` : ""),
  );
}

console.log(`\nWebsite: ${right}/${TEST_SET.length} correct${noHints ? " (no hints)" : ""}.`);
if (trapChosen) {
  console.error("FAIL: a trap site was chosen.");
  process.exit(1);
}
