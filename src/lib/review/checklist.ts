import type { ReviewField } from "@/lib/export/row";

type Score = "proven" | "review" | "rejected" | null;
export type CheckStatus = "done" | "warn" | "todo" | "optional";
export type CheckItem = { key: string; label: string; status: CheckStatus; detail: string; anchor: string };

export type ChecklistInput = {
  fields: Record<ReviewField, Score>;
  text: { description: string; tier: string; aesthetic: string; industry: string; regions: string };
  campaigns: { approved: number; proposed: number };
};

const LABEL: Record<ReviewField, string> = { website: "Website", instagram: "Instagram", tiktok: "TikTok", logo: "Logo", cover: "Cover" };
/** The DB importer needs these; Instagram is needed only to make the brand live, TikTok never. */
const REQUIRED: Record<ReviewField, "required" | "live" | "optional"> = { website: "required", instagram: "live", tiktok: "optional", logo: "required", cover: "required" };
const MIN_CAMPAIGNS = 3;
const MAX_CAMPAIGNS = 8;

function field(f: ReviewField, score: Score): CheckItem {
  const base = { key: f, label: LABEL[f], anchor: f };
  if (score === "proven") return { ...base, status: "done", detail: "Proven" };
  if (score === "review") return { ...base, status: "warn", detail: "Chosen, needs a look" };
  if (score === "rejected") return { ...base, status: "todo", detail: "The chosen one failed its check" };
  if (REQUIRED[f] === "optional") return { ...base, status: "optional", detail: "None found (optional)" };
  if (REQUIRED[f] === "live") return { ...base, status: "warn", detail: "None: the DB needs one to make the brand live" };
  return { ...base, status: "todo", detail: "Missing" };
}

/**
 * The brand page's checklist: one line per thing the reviewer looks after, in page order. It guides;
 * approval itself is decided by the importer's rules (`approvalBlockers`).
 */
export function buildChecklist(input: ChecklistInput): CheckItem[] {
  const fields = (["website", "instagram", "tiktok", "logo", "cover"] as const).map((f) => field(f, input.fields[f]));
  const t = input.text;
  const missing = [
    t.description.trim() ? null : "description",
    t.tier.trim() ? null : "tier",
    t.aesthetic.trim() ? null : "aesthetic",
    t.industry.trim() ? null : "industry",
    t.regions.trim() ? null : "regions",
  ].filter(Boolean);
  const details: CheckItem = {
    key: "details",
    label: "Brand details",
    anchor: "details",
    status: missing.length === 0 ? "done" : "todo",
    detail: missing.length === 0 ? "Filled in" : `Missing ${missing.join(", ")}`,
  };
  const { approved, proposed } = input.campaigns;
  const campaigns: CheckItem = {
    key: "campaigns",
    label: "Campaigns",
    anchor: "campaigns",
    status: approved >= MIN_CAMPAIGNS && approved <= MAX_CAMPAIGNS ? (proposed > 0 ? "warn" : "done") : "todo",
    detail:
      approved > MAX_CAMPAIGNS
        ? `${approved} approved; the DB takes at most ${MAX_CAMPAIGNS}`
        : approved < MIN_CAMPAIGNS
          ? `${approved} of ${MIN_CAMPAIGNS} approved`
          : `${approved} approved${proposed > 0 ? ` · ${proposed} still to decide` : ""}`,
  };
  return [...fields, details, campaigns];
}
