// Copied from db-admin src/lib/brands/activation.ts (2026-10-21). Keep in step with the importer.
/**
 * Brand activation rules — the single source of truth for "is this brand
 * complete enough to go live".
 *
 * Two callers share these rules and must never drift:
 *  - the brand detail page, gating the Active toggle on an existing brand
 *  - the CSV bulk importer, warning about rows that will import but never
 *    become activatable
 *
 * Note these are *activation* rules, not *create* rules. `brandCreateSchema`
 * requires a website source but not an Instagram one; activation requires both.
 * The importer therefore treats a missing Instagram source as a warning, not an
 * error — the brand still imports, it just cannot be activated until someone
 * adds one.
 */



export interface ActivationInput {
  description: string;
  campaignCount: number;
  aesthetic: string[];
  industry: string[];
  sources: Array<{ platform: string; url: string }>;
}

interface ActivationRule {
  id: string;
  ok: (input: ActivationInput) => boolean;
  message: (input: ActivationInput) => string;
}

const ACTIVATION_RULES: ActivationRule[] = [
  {
    id: "description",
    ok: (i) => Boolean(i.description.trim()),
    message: () => "Add a brand description",
  },
  {
    id: "campaigns",
    ok: (i) => i.campaignCount >= 3,
    message: (i) => `Add at least 3 campaigns (currently ${i.campaignCount})`,
  },
  {
    id: "aesthetic",
    ok: (i) => i.aesthetic.length > 0,
    message: () => "Add Aesthetic DNA (at least one aesthetic)",
  },
  {
    id: "industry",
    ok: (i) => i.industry.length > 0,
    message: () => "Add at least one industry",
  },
  {
    id: "instagram-source",
    ok: (i) => i.sources.some((s) => s.platform === "instagram"),
    message: () => "Add an Instagram source",
  },
  {
    id: "website-source",
    ok: (i) => i.sources.some((s) => s.platform === "website"),
    message: () => "Add a website source",
  },
];

/** Human-readable reasons the brand cannot be activated; empty = allowed. */
export function activationReasons(input: ActivationInput): string[] {
  return ACTIVATION_RULES.filter((rule) => !rule.ok(input)).map((rule) =>
    rule.message(input),
  );
}

