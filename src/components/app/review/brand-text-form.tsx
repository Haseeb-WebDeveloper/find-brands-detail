"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Segmented } from "@/design/segmented";
import { useToast } from "@/design/toast";
import { cn } from "@/design/cn";
import { saveBrandText } from "@/lib/review/actions";
import { AESTHETICS, INDUSTRIES, REGIONS } from "@/lib/details/vocab";
import { TagInput } from "@/components/app/review/tag-input";

type Text = { description: string; tier: string; aesthetic: string; industry: string; regions: string };
type Key = keyof Text;

const TIERS = [
  { value: "luxury", label: "Luxury" },
  { value: "premium", label: "Premium" },
  { value: "masstige", label: "Masstige" },
] as const;
const LISTS: Key[] = ["aesthetic", "industry", "regions"];
/** The DB's own words for each list (DB-mvp data); only aesthetics may grow from here. */
const VOCAB = { aesthetic: AESTHETICS, industry: INDUSTRIES, regions: REGIONS } as const;
const words = (list: string) => list.split(/[|,]/).map((w) => w.trim()).filter(Boolean);
const LABEL: Record<Key, string> = { description: "Description", tier: "Tier", aesthetic: "Aesthetic", industry: "Industry", regions: "Regions" };

/** Stored pipe-separated (the importer's form); shown and typed comma-separated. */
const shown = (key: Key, value: string) => (LISTS.includes(key) ? value.split("|").filter(Boolean).join(", ") : value);

/** Reads as text; click and type, it saves when you leave it (or press Enter). */
const FIELD =
  "w-full rounded-field border border-transparent bg-transparent px-2 py-1.5 -mx-2 text-body text-label placeholder:text-label-tertiary hover:bg-fill/60 focus:border-tint focus:bg-surface focus-visible:outline-none";

/** The DB's brand fields, drafted by research, edited where they stand (owner, 2026-10-21: no "Change" step). */
export function BrandTextForm({ brandId, initial, canEdit }: { brandId: string; initial: Text; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState<Text>(() => ({
    description: initial.description,
    tier: initial.tier,
    aesthetic: shown("aesthetic", initial.aesthetic),
    industry: shown("industry", initial.industry),
    regions: shown("regions", initial.regions),
  }));
  const [saved, setSaved] = useState<Text>(text);
  const [, start] = useTransition();

  const save = (next: Text) => {
    if ((Object.keys(next) as Key[]).every((k) => next[k].trim() === saved[k].trim())) return;
    start(async () => {
      const r = await saveBrandText(brandId, next);
      if (!r.ok) return toast(r.error);
      setSaved(next);
      router.refresh();
    });
  };
  const set = (key: Key) => (e: { currentTarget: { value: string } }) => setText({ ...text, [key]: e.currentTarget.value });
  const onEnter = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).blur();
    }
  };

  const row = (key: Key, control: React.ReactNode, first = false) => (
    <div key={key} className={cn("flex items-start gap-4 px-4 py-2.5", !first && "border-t border-separator")}>
      <span className="w-24 shrink-0 pt-2 text-subhead text-label-secondary">{LABEL[key]}</span>
      <div className="min-w-0 flex-1">{control}</div>
    </div>
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-headline text-label">Brand details</h2>
      <div className="flex flex-col rounded-card bg-surface">
        {row(
          "description",
          <textarea
            aria-label="Description"
            value={text.description}
            onChange={set("description")}
            onBlur={() => save(text)}
            onKeyDown={onEnter}
            disabled={!canEdit}
            placeholder="—"
            className={cn(FIELD, "field-sizing-content min-h-9 resize-none")}
          />,
          true,
        )}
        {row(
          "tier",
          <div className="pt-1">
            <Segmented
              label="Tier"
              value={(TIERS.find((t) => t.value === text.tier)?.value ?? "") as (typeof TIERS)[number]["value"]}
              onValueChange={(tier) => {
                if (!canEdit) return;
                const next = { ...text, tier };
                setText(next);
                save(next);
              }}
              options={TIERS}
            />
          </div>,
        )}
        {(["aesthetic", "industry", "regions"] as const).map((key) =>
          row(
            key,
            <TagInput
              label={LABEL[key]}
              value={words(text[key])}
              options={VOCAB[key]}
              allowNew={key === "aesthetic"}
              disabled={!canEdit}
              onChange={(list) => {
                const next = { ...text, [key]: list.join(", ") };
                setText(next);
                save(next);
              }}
            />,
          ),
        )}
      </div>
    </section>
  );
}
