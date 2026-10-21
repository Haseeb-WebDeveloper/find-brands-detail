import type { CandidateScore } from "@prisma/client";

export const REQUIRED_FIELDS = ["website", "instagram", "tiktok", "logo", "cover"] as const;
export type RequiredField = (typeof REQUIRED_FIELDS)[number];

const LABEL: Record<RequiredField, string> = { website: "website", instagram: "Instagram", tiktok: "TikTok", logo: "logo", cover: "cover" };

/** Spec §6 step 7: a field needs a person when nothing is chosen or the choice isn't proven. */
export function reviewSummary(fields: Record<RequiredField, CandidateScore | null>): { count: number; message: string; level: "good" | "warn" } {
  const open = REQUIRED_FIELDS.filter((f) => fields[f] !== "proven");
  const n = REQUIRED_FIELDS.length;
  if (open.length === 0) return { count: 0, message: `All ${n} fields are proven.`, level: "good" };
  return {
    count: open.length,
    message: `${open.length} of ${n} fields need${open.length === 1 ? "s" : ""} a look: ${open.map((f) => LABEL[f]).join(", ")}.`,
    level: "warn",
  };
}
