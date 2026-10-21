import { CAMPAIGN_DESCRIPTION_MAX } from "@/lib/export/importer/brand-create";

/** What the DB importer will refuse in a campaign, said before the reviewer saves it. */
export function validateCampaignInput({ title, description }: { title: string; description: string }): string | null {
  if (!title.trim()) return "Give the campaign a title.";
  if (!description.trim()) return "Write a description.";
  const n = description.trim().length;
  if (n > CAMPAIGN_DESCRIPTION_MAX) return `The description is ${n} characters; the DB takes at most ${CAMPAIGN_DESCRIPTION_MAX}.`;
  return null;
}
