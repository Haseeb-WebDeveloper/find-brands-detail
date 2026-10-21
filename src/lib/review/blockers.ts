import { validateImportRow } from "@/lib/export/importer/brand-import";
import { buildImportRow, type ReviewField, type ReviewState } from "@/lib/export/row";

/** Importer column → the name the reviewer sees on the brand page. */
const SECTION: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^name$/, () => "Name"],
  [/^description$/, () => "Description"],
  [/^tier$/, () => "Tier"],
  [/^brand_aesthetic$/, () => "Aesthetic"],
  [/^brand_industry$/, () => "Industry"],
  [/^profile_/, () => "Regions"],
  [/^source_website$/, () => "Website"],
  [/^source_instagram$/, () => "Instagram"],
  [/^source_tiktok$/, () => "TikTok"],
  [/^logo_url$/, () => "Logo"],
  [/^cover_image_url$/, () => "Cover"],
  // The importer reports a shortfall of campaigns on the first slot's title.
  [/^campaign_1_title$/, () => "Campaigns"],
  [/^campaign_(\d+)_/, (m) => `Campaign ${m[1]}`],
];
const LABEL: Record<ReviewField, string> = { website: "Website", instagram: "Instagram", tiktok: "TikTok", logo: "Logo", cover: "Cover" };

function section(column: string, message: string): string {
  // A campaign-1 error that isn't the shortfall belongs to campaign 1 itself.
  if (column === "campaign_1_title" && !/campaigns are required/.test(message)) return "Campaign 1";
  for (const [re, name] of SECTION) {
    const m = column.match(re);
    if (m) return name(m);
  }
  return column;
}

/** Spec §8: approve only when the DB importer would take the brand and nothing chosen is red. */
export function approvalBlockers(state: ReviewState): { errors: string[]; warnings: string[] } {
  const v = validateImportRow(buildImportRow(state));
  const errors = v.ok ? [] : v.errors.map((e) => `${section(e.column, e.message)}: ${e.message}`);
  for (const f of state.rejected) errors.push(`${LABEL[f]}: the chosen ${f === "logo" || f === "cover" ? "image" : "value"} failed its check. Choose another.`);
  return { errors, warnings: v.warnings.map((w) => `${section(w.column, w.message)}: ${w.message}`) };
}
