"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { Segmented } from "@/design/segmented";
import { TextField } from "@/design/text-field";
import { useToast } from "@/design/toast";
import { cn } from "@/design/cn";
import { saveBrandText } from "@/lib/review/actions";
import { ANCHOR } from "@/components/app/review/anchor";

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
  const set = (key: keyof Text) => (e: { currentTarget: { value: string } }) => setText({ ...text, [key]: e.currentTarget.value });
  return (
    <section id="details" className={cn("flex flex-col gap-3", ANCHOR)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-title-3 text-label">Brand details</h2>
        <p className="text-subhead text-label-secondary">The DB needs all five. Research doesn&apos;t fill these yet.</p>
      </div>
      <form
        className="flex flex-col gap-4 rounded-card bg-surface p-5"
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
            placeholder="What the brand is and what it stands for, as the DB shows it."
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
        <p className="text-footnote text-label-secondary">Separate several with commas.</p>
        {canEdit ? (
          <div>
            <Button kind="filled" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save details"}
            </Button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
