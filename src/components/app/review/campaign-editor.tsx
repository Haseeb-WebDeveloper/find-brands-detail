"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/button";
import { Dialog } from "@/design/dialog";
import { Pill } from "@/design/list";
import { TextField } from "@/design/text-field";
import { useToast } from "@/design/toast";
import { cn } from "@/design/cn";
import type { CampaignCard } from "@/lib/brands/scoped";
import { addCampaign, addCampaignImage, moveCampaign, saveCampaign, selectCampaignImage, setCampaignStatus } from "@/lib/review/actions";

/** The DB importer's limit; descriptions are asked for at 450 to leave room. */
const MAX = 500;
const SCORE = { proven: "Proven", review: "Needs a look", rejected: "Rejected" } as const;
const STATUS = { proposed: { label: "Proposed", tone: "grey" }, approved: { label: "Approved", tone: "green" }, removed: { label: "Removed", tone: "red" } } as const;

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const month = (date: string | null) =>
  date ? new Date(`${date.length === 4 ? `${date}-01` : date}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : null;

type Run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string) => void;

function useRun(): [boolean, Run] {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run: Run = (action, done) =>
    start(async () => {
      const r = await action();
      if (!r.ok) return toast(r.error);
      if (done) toast(done);
      router.refresh();
    });
  return [pending, run];
}

function Counter({ length }: { length: number }) {
  return (
    <p className={cn("text-footnote tabular-nums", length > MAX ? "text-system-red" : length > 450 ? "text-system-orange" : "text-label-secondary")}>
      {length} / {MAX} characters
    </p>
  );
}

function Description({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-subhead text-label-secondary">Description</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        rows={6}
        className="w-full rounded-field border border-transparent bg-fill px-3 py-2 text-callout text-label focus:border-tint focus:bg-surface focus-visible:outline-none"
      />
      <Counter length={value.trim().length} />
    </label>
  );
}

function Card({ c, first, last, canEdit }: { c: CampaignCard; first: boolean; last: boolean; canEdit: boolean }) {
  const [pending, run] = useRun();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(c.title);
  const [description, setDescription] = useState(c.description);
  const [imageUrl, setImageUrl] = useState("");
  const chosen = c.images.find((i) => i.selected) ?? null;
  const others = c.images.filter((i) => !i.selected);
  const status = STATUS[c.status];

  return (
    <article className={cn("flex gap-3 rounded-card bg-surface p-3", c.status === "removed" && "opacity-60")}>
      <div className="w-28 shrink-0">
        {chosen ? (
          <a href={chosen.url} target="_blank" rel="noreferrer" title={chosen.reason}>
            {/* A remote image at its own address: the reviewer sees exactly what will be exported. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={chosen.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[200/236] w-full rounded-lg bg-fill object-cover" />
          </a>
        ) : (
          <div className="flex aspect-[200/236] w-full items-center justify-center rounded-lg bg-fill p-2 text-center text-footnote text-label-secondary">No usable image</div>
        )}
        {chosen ? (
          <div className="mt-1.5">
            <Pill tone={chosen.score === "proven" ? "green" : chosen.score === "review" ? "orange" : "red"}>
              {chosen.sourceKind === "third_party" ? "Third-party" : SCORE[chosen.score]}
            </Pill>
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-headline text-label">
            <span className="mr-1.5 text-label-tertiary tabular-nums">{c.position}.</span>
            {c.title}
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {month(c.date) ? <span className="text-footnote text-label-secondary">{month(c.date)}</span> : null}
            <Pill tone={status.tone}>{status.label}</Pill>
          </div>
        </div>

        {editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveCampaign(c.id, { title, description }), "Saved.");
              setEditing(false);
            }}
          >
            <TextField label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
            <Description value={description} onChange={setDescription} />
            <div className="flex gap-2">
              <Button kind="filled" size="sm" type="submit" disabled={pending || description.trim().length > MAX}>
                Save
              </Button>
              <Button kind="gray" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-callout text-label">{c.description || <span className="text-label-secondary">No description yet.</span>}</p>
            <Counter length={c.description.length} />
            {c.note ? <p className="text-footnote text-system-orange">{c.note}</p> : null}
          </>
        )}

        {others.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {others.map((i) => (
              <button
                key={i.id}
                type="button"
                disabled={!canEdit || pending || i.score === "rejected"}
                title={`${SCORE[i.score]}: ${i.reason}${canEdit && i.score !== "rejected" ? " — click to use this image" : ""}`}
                onClick={() => run(() => selectCampaignImage(c.id, i.id))}
                className="rounded-md disabled:cursor-default"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.url} alt="" loading="lazy" referrerPolicy="no-referrer" className={cn("size-10 rounded-md bg-fill object-cover", i.score === "rejected" && "opacity-40")} />
              </button>
            ))}
          </div>
        ) : null}

        {c.sources.length > 0 ? (
          <p className="truncate text-footnote text-label-secondary">
            Sources:{" "}
            {c.sources.map((u, n) => (
              <span key={u}>
                {n > 0 ? ", " : ""}
                <a href={u} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                  {host(u)}
                </a>
              </span>
            ))}
          </p>
        ) : null}

        {canEdit ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {c.status !== "approved" ? (
                <Button kind="filled" size="sm" disabled={pending} onClick={() => run(() => setCampaignStatus(c.id, "approved"))}>
                  Approve
                </Button>
              ) : null}
              {c.status !== "removed" ? (
                <Button kind="gray" size="sm" disabled={pending} onClick={() => run(() => setCampaignStatus(c.id, "removed"))}>
                  Remove
                </Button>
              ) : (
                <Button kind="gray" size="sm" disabled={pending} onClick={() => run(() => setCampaignStatus(c.id, "proposed"))}>
                  Restore
                </Button>
              )}
              {!editing ? (
                <Button kind="gray" size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              ) : null}
              <Button kind="gray" size="sm" disabled={pending || first} onClick={() => run(() => moveCampaign(c.id, -1))} aria-label="Move up">
                ↑
              </Button>
              <Button kind="gray" size="sm" disabled={pending || last} onClick={() => run(() => moveCampaign(c.id, 1))} aria-label="Move down">
                ↓
              </Button>
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!imageUrl.trim()) return;
                run(() => addCampaignImage(c.id, imageUrl), "Image checked and chosen.");
                setImageUrl("");
              }}
            >
              <TextField label="Another image" hideLabel placeholder="Image address for this campaign" value={imageUrl} onChange={(e) => setImageUrl(e.currentTarget.value)} className="flex-1" />
              <Button kind="gray" size="sm" type="submit" disabled={pending || !imageUrl.trim()}>
                {pending ? "Checking…" : "Check and use"}
              </Button>
            </form>
          </>
        ) : null}
      </div>
    </article>
  );
}

function AddCampaign({ brandId }: { brandId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, run] = useRun();
  const [form, setForm] = useState({ title: "", description: "", imageUrl: "" });
  return (
    <>
      <div>
        <Button kind="gray" icon="add" onClick={() => setOpen(true)}>
          Add a campaign
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add a campaign"
        confirm={pending ? "Checking…" : "Add campaign"}
        busy={pending}
        closeOnConfirm={false}
        wide
        onConfirm={() =>
          run(async () => {
            const r = await addCampaign(brandId, form);
            if (r.ok) {
              setOpen(false);
              setForm({ title: "", description: "", imageUrl: "" });
            }
            return r;
          }, "Campaign added.")
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

/**
 * The brand's campaigns as the DB will show them: approve the ones to export (3 to 8, in this order),
 * remove the rest, fix titles and descriptions, pick or add images (spec §8).
 */
export function CampaignEditor({ brandId, campaigns, canEdit }: { brandId: string; campaigns: CampaignCard[]; canEdit: boolean }) {
  const approved = campaigns.filter((c) => c.status === "approved").length;
  const proposed = campaigns.filter((c) => c.status === "proposed").length;
  const ordered = [...campaigns.filter((c) => c.status !== "removed"), ...campaigns.filter((c) => c.status === "removed")];
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-headline text-label">Campaigns</h2>
        <p className={cn("text-footnote", approved < 3 || approved > 8 ? "text-system-orange" : "text-label-secondary")}>
          {approved} approved{proposed > 0 ? ` · ${proposed} to decide` : ""} — the DB takes 3 to 8 approved, in this order.
        </p>
      </div>
      {ordered.length === 0 ? <p className="text-callout text-label-secondary">No campaigns found yet. Add them by hand.</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {ordered.map((c, i) => (
          <Card key={c.id} c={c} first={i === 0} last={i === ordered.length - 1} canEdit={canEdit} />
        ))}
      </div>
      {canEdit ? <AddCampaign brandId={brandId} /> : null}
    </section>
  );
}
