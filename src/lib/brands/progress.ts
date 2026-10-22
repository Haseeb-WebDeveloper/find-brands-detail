import { RESEARCH_STEPS, stepNumber } from "@/lib/research/steps";
import type { BrandRow } from "@/lib/batches/scoped";

type Progress = Pick<BrandRow, "status" | "currentStep" | "reviewCount" | "error"> & { stuck?: boolean };

export function progressText(row: Progress): string {
  if (row.error) return row.error;
  if (row.stuck) return "Stuck: research stopped without finishing";
  switch (row.status) {
    case "queued":
      return "Waiting to start";
    case "researching": {
      const step = RESEARCH_STEPS.find((s) => s.id === row.currentStep);
      return step ? `${step.label} (step ${stepNumber(step.id)} of ${RESEARCH_STEPS.length})` : "Starting";
    }
    case "needs_review":
      return row.reviewCount > 0 ? `Ready for review · ${row.reviewCount} need you` : "Ready for review";
    case "approved":
      return "Approved";
    case "exported":
      return "Exported";
  }
}

export function progressTone(row: Progress): "blue" | "green" | "orange" | "red" | "grey" {
  if (row.error || row.stuck) return "red";
  switch (row.status) {
    case "queued":
      return "grey";
    case "researching":
      return "blue";
    case "needs_review":
      return "orange";
    case "approved":
    case "exported":
      return "green";
  }
}
