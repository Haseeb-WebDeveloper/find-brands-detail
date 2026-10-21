"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { Segmented } from "@/design/segmented";
import { TextField } from "@/design/text-field";
import { useToast } from "@/design/toast";
import { cn } from "@/design/cn";
import { saveBrandText } from "@/lib/review/actions";

type Text = { description: string; tier: string; aesthetic: string; industry: string; regions: string };
const TIERS = [
  { value: "luxury", label: "Luxury" },
  { value: "premium", label: "Premium" },
  { value: "masstige", label: "Masstige" },
] as const;
/** Stored pipe-separated (the importer's form); shown comma-separated, as people type lists. */
const shown = (list: string) => list.split("|").filter(Boolean).join(", ");

/** The DB's brand fields the research doesn't fill yet: typed by the reviewer (AI drafts come in the next spec). */
export function BrandTextForm({ brandId, initial, canEdit }: { brandId: string; initial: Text; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState<Text>({ ...initial, aesthetic: shown(initial.aesthetic), industry: shown(initial.industry), regions: shown(initial.regions) });
  const [pending, start] = useTransition();
  const filled = [initial.description, initial.tier, initial.aesthetic, initial.industry, initial.regions].filter((v) => v.trim()).length;
  const set = (key: keyof Text) => (e: { currentTarget: { value: string } }) => setText({ ...text, [key]: e.currentTarget.value });
  return (
    <details className="group rounded-card bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-label-secondary transition-transform group-open:rotate-90">›</span>
        <span className="text-headline text-label">Brand details</span>
        <span className="text-subhead text-label-secondary">{filled} of 5 filled</span>
      </summary>
      <form
        className="flex flex-col gap-4 border-t border-separator p-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveBrandText(brandId, text);
            if (!r.ok) return toast(r.error);
            toast("Saved.");
            router.refresh();
          });
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-subhead text-label-secondary">Description</span>
          <textarea
            value={text.description}
            onChange={set("description")}
            disabled={!canEdit}
            rows={4}
            placeholder=""
            className={cn(
              "w-full rounded-field border border-transparent bg-fill px-3 py-2 text-body text-label placeholder:text-label-secondary",
              "focus:border-tint focus:bg-surface focus-visible:outline-none",
            )}
          />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-subhead text-label-secondary">Tier</span>
          <Segmented
            label="Tier"
            value={(TIERS.find((t) => t.value === text.tier)?.value ?? "") as (typeof TIERS)[number]["value"]}
            onValueChange={(tier) => canEdit && setText({ ...text, tier })}
            options={TIERS}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Aesthetic" placeholder="clean, minimal" value={text.aesthetic} onChange={set("aesthetic")} disabled={!canEdit} />
          <TextField label="Industry" placeholder="skincare" value={text.industry} onChange={set("industry")} disabled={!canEdit} />
          <TextField label="Regions" placeholder="Asia, North America" value={text.regions} onChange={set("regions")} disabled={!canEdit} />
        </div>
        {canEdit ? (
          <div>
            <Button kind="filled" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save details"}
            </Button>
          </div>
        ) : null}
      </form>
    </details>
  );
}
