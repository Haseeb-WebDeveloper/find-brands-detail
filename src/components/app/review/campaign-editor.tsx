"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog } from "@/design/dialog";
import { TextField } from "@/design/text-field";
import { useToast } from "@/design/toast";
import { cn } from "@/design/cn";
import type { CampaignCard } from "@/lib/brands/scoped";
import { ImageViewer, type ViewerAction, type ViewerFrame, type ViewerImage } from "@/components/app/review/image-viewer";
import { FramedImage } from "@/components/app/review/framed-image";
import { FRAME_ASPECT } from "@/lib/images/framing";
import { FindMoreCampaignsButton } from "@/components/app/research/find-more-button";
import {
  addCampaign,
  addCampaignImage,
  frameCampaignImage,
  reorderCampaigns,
  saveCampaign,
  selectCampaignImage,
  setCampaignStatus,
} from "@/lib/review/actions";

/** The DB importer's limit. */
const MAX = 500;

/** The site's campaign tile: what the DB importer crops a campaign image to. */
const TILE: ViewerFrame = { kind: "box", aspect: FRAME_ASPECT.campaign, label: "Campaign tile, as on the site" };

type Img = CampaignCard["images"][number];
const viewerImage = (i: Img, caption: string): ViewerImage => ({ url: i.url, caption, framing: i.framing, size: i.width && i.height ? { w: i.width, h: i.height } : null });

/** "Use this image" in its framing, and "Save framing" for the one used, for a campaign's images. */
function imageAction(campaignId: string, images: Img[], pending: boolean, run: ReturnType<typeof useRun>[1]): ViewerAction {
  return {
    label: "Use this image",
    doneLabel: "In use",
    busy: pending,
    done: (n) => Boolean(images[n]?.selected),
    onUse: (n, framing) => run(() => selectCampaignImage(campaignId, images[n].id, framing), "Image chosen."),
    onFrame: (n, framing) => run(() => frameCampaignImage(images[n].id, framing), "Framing saved."),
  };
}

function useRun() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string, after?: () => void) =>
    start(async () => {
      const r = await action();
      if (!r.ok) return toast(r.error, { tone: "error" });
      if (done) toast(done);
      after?.();
      router.refresh();
    });
  return [pending, run] as const;
}

/**
 * A drag starts after the pointer moves a few pixels, so a tap or click on a tile still works. No
 * keyboard dragging: its Space/Enter would swallow the keyboard presses of the buttons inside a tile.
 */
function useDragSensors() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
}

/**
 * A list the reviewer reorders by dragging, shown in its new order at once while the server catches up;
 * the server's order takes over whenever the list itself changes (an add, a delete, a refresh).
 */
function useOrder(ids: string[]) {
  const key = ids.join(",");
  const [order, setOrder] = useState({ key, ids });
  if (order.key !== key && order.ids.join(",") !== key) setOrder({ key, ids });
  return [order.key === key || order.ids.join(",") === key ? order.ids : ids, (next: string[]) => setOrder({ key, ids: next })] as const;
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

/** Title, description and images of one campaign, in a dialog over the brand. */
function EditDialog({ c, open, onOpenChange }: { c: CampaignCard; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pending, run] = useRun();
  const [title, setTitle] = useState(c.title);
  const [description, setDescription] = useState(c.description);
  const [imageUrl, setImageUrl] = useState("");
  // The image open full screen, by its place in `images`.
  const [viewing, setViewing] = useState<number | null>(null);
  // The one used, then the others as suggestions to pick from. Rejected images aren't offered.
  const used = c.images.find((i) => i.selected) ?? null;
  const images = c.images.filter((i) => i.score !== "rejected");

  return (
    <Dialog
      open={open}
      // The full-screen viewer sits outside the dialog: a click or Escape there must not close the dialog.
      onOpenChange={(next) => (next || viewing === null ? onOpenChange(next) : undefined)}
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
        {images.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-subhead text-label-secondary">Image — click one to see it full screen</span>
            <div className="flex flex-wrap gap-2">
              {images.map((i, n) => {
                const isUsed = i.id === used?.id;
                return (
                  <div key={i.id} className="flex w-20 shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      title={i.reason}
                      aria-label="View full screen"
                      onClick={() => setViewing(n)}
                      className={cn("block cursor-zoom-in overflow-hidden rounded-md", isUsed && "ring-2 ring-tint")}
                    >
                      <FramedImage src={i.url} aspect={FRAME_ASPECT.campaign} framing={i.framing} size={i.width && i.height ? { w: i.width, h: i.height } : null} className="aspect-[200/236] w-full" />
                    </button>
                    {isUsed ? (
                      <span className="rounded bg-tint py-0.5 text-center text-caption font-medium text-tint-contrast">Used</span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => selectCampaignImage(c.id, i.id))}
                        className="rounded bg-fill py-0.5 text-caption font-medium text-label hover:bg-fill-strong disabled:opacity-50"
                      >
                        Use
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {viewing !== null ? (
              <ImageViewer
                images={images.map((i) => viewerImage(i, c.title))}
                start={viewing}
                onClose={() => setViewing(null)}
                frame={TILE}
                action={imageAction(c.id, images, pending, run)}
              />
            ) : null}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <TextField label="Another image" placeholder="Instagram post link or image address" value={imageUrl} onChange={(e) => setImageUrl(e.currentTarget.value)} className="flex-1" />
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

/**
 * One campaign tile: drag it to reorder, tap the image for full screen, the title to edit, ✓/+ to keep
 * it in or leave it out. The dialog and the viewer render OUTSIDE the draggable element: React passes
 * events up through portals, so a click inside them would otherwise start a drag of the tile.
 */
function Tile({ c, canEdit }: { c: CampaignCard; canEdit: boolean }) {
  const [pending, run] = useRun();
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id, disabled: !canEdit });
  const image = c.images.find((i) => i.selected) ?? null;
  // The image used first, then the others that passed, for the full-screen viewer.
  const gallery = [...c.images.filter((i) => i.selected), ...c.images.filter((i) => !i.selected && i.score !== "rejected")];
  const out = c.status === "removed";
  return (
    <>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={cn("group relative flex touch-none flex-col gap-2", out && "opacity-45", isDragging && "z-10 scale-[1.03] opacity-90", canEdit && "cursor-grab active:cursor-grabbing")}
        {...attributes}
        {...listeners}
      >
        {image ? (
          <button type="button" onClick={() => setViewing(true)} className="cursor-zoom-in" aria-label={`View ${c.title} full screen`}>
            <FramedImage src={image.url} aspect={FRAME_ASPECT.campaign} framing={image.framing} size={image.width && image.height ? { w: image.width, h: image.height } : null} className="aspect-[200/236] w-full rounded-lg" />
          </button>
        ) : (
          <button type="button" disabled={!canEdit} onClick={() => setEditing(true)} className="flex aspect-[200/236] w-full items-center justify-center rounded-lg bg-fill text-footnote text-label-tertiary">
            No image
          </button>
        )}
        <button type="button" disabled={!canEdit} onClick={() => setEditing(true)} className="line-clamp-2 text-left text-callout text-label hover:underline" title={canEdit ? "Edit" : undefined}>
          {c.title}
        </button>
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
      </div>
      {viewing ? (
        <ImageViewer
          images={gallery.map((i) => viewerImage(i, c.title))}
          start={0}
          onClose={() => setViewing(false)}
          frame={TILE}
          action={canEdit ? imageAction(c.id, gallery, pending, run) : undefined}
        />
      ) : null}
      {canEdit ? <EditDialog c={c} open={editing} onOpenChange={setEditing} /> : null}
    </>
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
          <TextField label="Image" placeholder="Instagram post link or image address" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.currentTarget.value })} />
        </div>
      </Dialog>
    </>
  );
}

/**
 * Campaigns as tiles, in the export's order: drag a tile to move it; ✓ in the export, + left out; a
 * tile's title opens it to edit its text and images.
 */
/** `findMore`: offer "Find more campaigns" (research done, not reviewed, a model set up). */
export function CampaignEditor({ brandId, campaigns, canEdit, findMore = false }: { brandId: string; campaigns: CampaignCard[]; canEdit: boolean; findMore?: boolean }) {
  const [, run] = useRun();
  const sensors = useDragSensors();
  const [order, setOrder] = useOrder(campaigns.map((c) => c.id));
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const ordered = order.map((id) => byId.get(id)).filter((c): c is CampaignCard => Boolean(c));
  const included = campaigns.filter((c) => c.status !== "removed").length;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    run(() => reorderCampaigns(brandId, next));
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-baseline gap-2 text-headline text-label">
          Campaigns
          <span className={cn("text-subhead font-normal", included < 3 ? "text-system-orange" : "text-label-secondary")}>{included} in</span>
          {canEdit && campaigns.length > 1 ? <span className="text-footnote font-normal text-label-tertiary">· drag to reorder</span> : null}
        </h2>
        {findMore ? <FindMoreCampaignsButton brandId={brandId} /> : null}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4">
            {ordered.map((c) => (
              <Tile key={c.id} c={c} canEdit={canEdit} />
            ))}
            {canEdit ? <AddTile brandId={brandId} /> : null}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
