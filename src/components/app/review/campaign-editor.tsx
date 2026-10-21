"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/design/dialog";
import { TextField } from "@/design/text-field";
import { useToast } from "@/design/toast";
import { cn } from "@/design/cn";
import type { CampaignCard } from "@/lib/brands/scoped";
import { ImageViewer } from "@/components/app/review/image-viewer";
import { addCampaign, addCampaignImage, saveCampaign, selectCampaignImage, setCampaignStatus } from "@/lib/review/actions";

/** The DB importer's limit. */
const MAX = 500;

function useRun() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string, after?: () => void) =>
    start(async () => {
      const r = await action();
      if (!r.ok) return toast(r.error);
      if (done) toast(done);
      after?.();
      router.refresh();
    });
  return [pending, run] as const;
}

function Description({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = value.trim().length;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-subhead text-label-secondary">Description</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        rows={6}
        className="w-full rounded-field border border-transparent bg-fill px-3 py-2 text-callout text-label focus:border-tint focus:bg-surface focus-visible:outline-none"
      />
      <span className={cn("self-end text-footnote tabular-nums", n > MAX ? "text-system-red" : "text-label-secondary")}>
        {n} / {MAX}
      </span>
    </label>
  );
}

/** Title, description and image of one campaign, in a dialog over the brand. */
function EditDialog({ c, open, onOpenChange }: { c: CampaignCard; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pending, run] = useRun();
  const [title, setTitle] = useState(c.title);
  const [description, setDescription] = useState(c.description);
  const [imageUrl, setImageUrl] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit campaign"
      confirm={pending ? "Saving…" : "Save"}
      busy={pending || description.trim().length > MAX}
      closeOnConfirm={false}
      wide
      onConfirm={() => run(() => saveCampaign(c.id, { title, description }), "Saved.", () => onOpenChange(false))}
    >
      <div className="flex flex-col gap-3">
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <Description value={description} onChange={setDescription} />
        {c.images.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-subhead text-label-secondary">Image</span>
            <div className="flex flex-wrap gap-2">
              {c.images.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  disabled={pending || i.score === "rejected"}
                  title={i.reason}
                  onClick={() => run(() => selectCampaignImage(c.id, i.id))}
                  className={cn("overflow-hidden rounded-md", i.selected ? "ring-2 ring-tint" : "opacity-80 hover:opacity-100", i.score === "rejected" && "opacity-30")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[200/236] w-20 bg-fill object-cover" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <TextField label="Another image" placeholder="Image address" value={imageUrl} onChange={(e) => setImageUrl(e.currentTarget.value)} className="flex-1" />
          <button
            type="button"
            disabled={pending || !imageUrl.trim()}
            onClick={() => run(() => addCampaignImage(c.id, imageUrl), "Image added.", () => setImageUrl(""))}
            className="h-(--ds-control-md) shrink-0 rounded-field bg-fill px-3 text-callout text-label disabled:opacity-50"
          >
            Use
          </button>
        </div>
        {c.sources.length > 0 ? (
          <p className="truncate text-footnote text-label-secondary">
            {c.sources.map((u, n) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="mr-2 underline-offset-2 hover:underline">
                {n === 0 ? "Source" : `Source ${n + 1}`}
              </a>
            ))}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

function Tile({ c, canEdit }: { c: CampaignCard; canEdit: boolean }) {
  const [pending, run] = useRun();
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const image = c.images.find((i) => i.selected) ?? null;
  // The chosen image first, then the others that passed, for the full-screen viewer.
  const gallery = [...c.images.filter((i) => i.selected), ...c.images.filter((i) => !i.selected && i.score !== "rejected")];
  const out = c.status === "removed";
  return (
    <div className={cn("group relative flex flex-col gap-2", out && "opacity-45")}>
      {image ? (
        <button type="button" onClick={() => setViewing(true)} className="cursor-zoom-in" aria-label={`View ${c.title} full screen`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[200/236] w-full rounded-lg bg-fill object-cover" />
        </button>
      ) : (
        <button type="button" disabled={!canEdit} onClick={() => setEditing(true)} className="flex aspect-[200/236] w-full items-center justify-center rounded-lg bg-fill text-footnote text-label-tertiary">
          No image
        </button>
      )}
      <button type="button" disabled={!canEdit} onClick={() => setEditing(true)} className="line-clamp-2 text-left text-callout text-label hover:underline" title={canEdit ? "Edit" : undefined}>
        {c.title}
      </button>
      {viewing ? <ImageViewer images={gallery.map((i) => ({ url: i.url, caption: c.title }))} start={0} onClose={() => setViewing(false)} /> : null}
      {canEdit ? (
        <button
          type="button"
          disabled={pending}
          aria-label={out ? `Put ${c.title} back in` : `Leave ${c.title} out`}
          title={out ? "Put back in" : "Leave out"}
          onClick={() => run(() => setCampaignStatus(c.id, out ? "proposed" : "removed"))}
          className={cn(
            "absolute top-2 right-2 flex size-8 items-center justify-center rounded-full text-callout font-semibold shadow-sm",
            out ? "bg-surface text-label-secondary" : "bg-system-green text-white",
          )}
        >
          {out ? "+" : "✓"}
        </button>
      ) : null}
      {canEdit ? <EditDialog c={c} open={editing} onOpenChange={setEditing} /> : null}
    </div>
  );
}

function AddTile({ brandId }: { brandId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, run] = useRun();
  const [form, setForm] = useState({ title: "", description: "", imageUrl: "" });
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex aspect-[200/236] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-separator text-callout text-label-secondary hover:border-tint hover:text-tint-text"
      >
        <span className="text-title-2">+</span>
        Add
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add a campaign"
        confirm={pending ? "Adding…" : "Add"}
        busy={pending}
        closeOnConfirm={false}
        wide
        onConfirm={() =>
          run(() => addCampaign(brandId, form), "Added.", () => {
            setOpen(false);
            setForm({ title: "", description: "", imageUrl: "" });
          })
        }
      >
        <div className="flex flex-col gap-3">
          <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} />
          <Description value={form.description} onChange={(description) => setForm({ ...form, description })} />
          <TextField label="Image address" placeholder="https://…" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.currentTarget.value })} />
        </div>
      </Dialog>
    </>
  );
}

/** Campaigns as tiles: ✓ in the export, + left out; a tile opens to edit its text or image. */
export function CampaignEditor({ brandId, campaigns, canEdit }: { brandId: string; campaigns: CampaignCard[]; canEdit: boolean }) {
  const included = campaigns.filter((c) => c.status !== "removed").length;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline gap-2 text-headline text-label">
        Campaigns
        <span className={cn("text-subhead font-normal", included < 3 ? "text-system-orange" : "text-label-secondary")}>{included} in</span>
      </h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4">
        {campaigns.map((c) => (
          <Tile key={c.id} c={c} canEdit={canEdit} />
        ))}
        {canEdit ? <AddTile brandId={brandId} /> : null}
      </div>
    </section>
  );
}
