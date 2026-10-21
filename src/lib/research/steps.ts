export type ResearchStepId = "website" | "crawl" | "instagram" | "tiktok" | "images" | "campaigns" | "details" | "score";

export const RESEARCH_STEPS: readonly { id: ResearchStepId; label: string }[] = [
  { id: "website", label: "Finding the website" },
  { id: "crawl", label: "Reading the brand's sites" },
  { id: "instagram", label: "Checking Instagram" },
  { id: "tiktok", label: "Checking TikTok" },
  { id: "images", label: "Checking logo and cover" },
  { id: "campaigns", label: "Researching campaigns" },
  { id: "details", label: "Drafting brand details" },
  { id: "score", label: "Scoring the results" },
];

export function stepNumber(id: string): number {
  return RESEARCH_STEPS.findIndex((s) => s.id === id) + 1;
}
