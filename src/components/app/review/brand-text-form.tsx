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
type Key = keyof Text;

const ROWS: { key: Key; label: string }[] = [
  { key: "description", label: "Description" },
  { key: "tier", label: "Tier" },
  { key: "aesthetic", label: "Aesthetic" },
  { key: "industry", label: "Industry" },
  { key: "regions", label: "Regions" },
];
const TIERS = [
  { value: "luxury", label: "Luxury" },
  { value: "premium", label: "Premium" },
  { value: "masstige", label: "Masstige" },
] as const;
const LISTS = new Set<Key>(["aesthetic", "industry", "regions"]);

/** Stored pipe-separated (the importer's form); shown and typed comma-separated. */
const shown = (key: Key, value: string) => (LISTS.has(key) ? value.split("|").filter(Boolean).join(", ") : value);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One detail: its value at a glance, "Change" edits it in place. */
function Row({ brandId, field, label, text, canEdit, first }: { brandId: string; field: Key; label: string; text: Text; canEdit: boolean; first: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(shown(field, text[field]));
  const [pending, start] = useTransition();
  const current = shown(field, text[field]);

  const save = (next: string) =>
    start(async () => {
      const r = await saveBrandText(brandId, { ...text, [field]: next });
      if (!r.ok) return toast(r.error);
      setEditing(false);
      router.refresh();
    });

  return (
    <div className={cn("flex flex-col gap-2 px-4 py-3", !first && "border-t border-separator")}>
      <div className="flex items-start gap-4">
        <span className="w-24 shrink-0 pt-0.5 text-subhead text-label-secondary">{label}</span>
        <div className="min-w-0 flex-1">
          {editing ? null : current ? (
            <p className={cn("text-body text-label", field !== "description" && "truncate")}>{field === "tier" ? capital(current) : current}</p>
          ) : (
            <span className="text-body text-label-tertiary">—</span>
          )}
        </div>
        {canEdit && !editing ? (
          <button
            type="button"
            onClick={() => {
              setValue(current);
              setEditing(true);
            }}
            className="shrink-0 text-subhead text-tint-text hover:underline"
          >
            {current ? "Change" : "Add"}
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2 sm:pl-28">
          {field === "tier" ? (
            <Segmented label="Tier" value={(TIERS.find((t) => t.value === value)?.value ?? "") as (typeof TIERS)[number]["value"]} onValueChange={(tier) => save(tier)} options={TIERS} />
          ) : field === "description" ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
              rows={4}
              autoFocus
              className="w-full rounded-field border border-transparent bg-fill px-3 py-2 text-body text-label focus:border-tint focus:bg-surface focus-visible:outline-none"
            />
          ) : (
            <TextField label={label} hideLabel autoFocus placeholder="Separate with commas" value={value} onChange={(e) => setValue(e.currentTarget.value)} />
          )}
          <div className="flex gap-2">
            {field !== "tier" ? (
              <Button kind="filled" size="sm" disabled={pending} onClick={() => save(value)}>
                {pending ? "Saving…" : "Save"}
              </Button>
            ) : null}
            <Button kind="gray" size="sm" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The DB's brand fields, drafted by research, laid out like the facts above: one row each. */
export function BrandTextForm({ brandId, initial, canEdit }: { brandId: string; initial: Text; canEdit: boolean }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-headline text-label">Brand details</h2>
      <div className="flex flex-col rounded-card bg-surface">
        {ROWS.map((r, i) => (
          <Row key={r.key} brandId={brandId} field={r.key} label={r.label} text={initial} canEdit={canEdit} first={i === 0} />
        ))}
      </div>
    </section>
  );
}
