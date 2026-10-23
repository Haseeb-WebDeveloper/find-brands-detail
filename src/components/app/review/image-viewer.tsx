"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/design/cn";
import { Icon } from "@/design/icon";
import { CENTRED, MAX_ZOOM, type Framing } from "@/lib/images/framing";
import { fitBox, pan, placeImage, sameFraming, zoomAt } from "@/lib/images/frame-view";

/** `framing`: where it sits in its frame now (null: centred); `size`: its pixels, when research measured them. */
export type ViewerImage = { url: string; caption: string; framing?: Framing | null; size?: { w: number; h: number } | null };

/**
 * The frame the image is shown in on the site: a campaign tile or the cover card (`aspect`, which the
 * DB importer crops to), or the logo's circle (shown, never cropped: the importer leaves logos whole).
 */
export type ViewerFrame = { kind: "box"; aspect: number; label: string } | { kind: "circle"; label: string };

/**
 * The choice to make about the image on screen. "Use this image" makes it the one used, with the
 * framing on screen when the frame can be framed; once it's used, "Save framing" keeps a changed one.
 */
export type ViewerAction = {
  label: string;
  doneLabel: string;
  done: (index: number) => boolean;
  /** Whether this image can be used at all (a rejected one can't); every one when absent. */
  can?: (index: number) => boolean;
  onUse: (index: number, framing: Framing | null | undefined) => void;
  onFrame?: (index: number, framing: Framing | null) => void;
  busy?: boolean;
};

type Size = { w: number; h: number };

/** Space kept round the frame inside the stage, so the dimmed rest of the image shows; less on a phone. */
const gutter = (space: Size) => ({ x: Math.min(48, space.w * 0.05), y: Math.min(40, space.h * 0.05) });
/** One notch of a mouse wheel zooms by about 12%. */
const WHEEL = 0.0012;

/**
 * An image full screen, as the site will show it: in its real frame, cut where the DB importer will
 * cut it, the rest of the picture dimmed around the frame. Drag to move it, scroll or pinch to zoom,
 * "Fill frame" to go back to the centre crop, "Whole image" to see it uncut. The images beside it are
 * a press away (arrows, or ← →), Esc closes. Black round the picture, as contractor-sites' photo
 * viewer: a viewer, not a surface.
 *
 * A framing is only edited where it can be kept: a box frame with an action. Elsewhere the frame is
 * shown as it is.
 */
export function ImageViewer({
  images,
  start,
  onClose,
  action,
  frame,
}: {
  images: ViewerImage[];
  start: number;
  onClose: () => void;
  action?: ViewerAction;
  frame?: ViewerFrame;
}) {
  const [index, setIndex] = useState(Math.min(start, images.length - 1));
  const [mode, setMode] = useState<"frame" | "whole">(frame ? "frame" : "whole");
  // Framings changed on screen and not yet kept, by image.
  const [edits, setEdits] = useState<Record<number, Framing>>({});
  const [natural, setNatural] = useState<Record<number, Size>>({});
  const stage = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState<Size | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const current = images[index];
  const box = frame?.kind === "box" ? frame : null;
  const editable = Boolean(box && action);
  const size = natural[index] ?? current?.size ?? null;
  const framing = edits[index] ?? current?.framing ?? CENTRED;
  const changed = !sameFraming(framing, current?.framing ?? null);
  const used = action?.done(index) ?? false;

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(images.length - 1, i))), [images.length]);
  const setFraming = useCallback((f: Framing) => setEdits((e) => ({ ...e, [index]: f })), [index]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "ArrowRight") go(index + 1);
      if (!editable || !size || !box || mode !== "frame") return;
      if (e.key === "+" || e.key === "=") setFraming(zoomAt(size, box.aspect, framing, framing.zoom * 1.15));
      if (e.key === "-") setFraming(zoomAt(size, box.aspect, framing, framing.zoom / 1.15));
      if (e.key === "0") setFraming(CENTRED);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [box, editable, framing, go, index, mode, onClose, setFraming, size]);

  useEffect(() => {
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = overflow;
    };
  }, []);

  // The stage's size decides the frame's: as large as fits.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setSpace({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode]);

  if (!current) return null;

  const g = space ? gutter(space) : null;
  const frameSize = frame && space && g ? fitBox({ w: Math.max(1, space.w - 2 * g.x), h: Math.max(1, space.h - 2 * g.y) }, box ? box.aspect : 1) : null;
  const placed = box && size && frameSize ? placeImage(size, box.aspect, framing, frameSize.w) : null;

  /** Where a pointer is over the frame, as a fraction of it (for zooming at the pointer). */
  const at = (clientX: number, clientY: number) => {
    const r = stage.current?.querySelector("[data-frame]")?.getBoundingClientRect();
    return r ? { px: Math.min(1, Math.max(0, (clientX - r.left) / r.width)), py: Math.min(1, Math.max(0, (clientY - r.top) / r.height)) } : { px: 0.5, py: 0.5 };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!editable || mode !== "frame") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const last = pointers.current.get(e.pointerId);
    if (!last || !size || !box || !frameSize) return;
    const all = [...pointers.current.entries()];
    if (all.length === 1) {
      setFraming(pan(size, box.aspect, framing, e.clientX - last.x, e.clientY - last.y, frameSize.w));
    } else if (all.length === 2) {
      // Pinch: the distance between the two fingers, before and after this move.
      const other = all.find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(last.x - other.x, last.y - other.y);
        const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        const mid = at((e.clientX + other.x) / 2, (e.clientY + other.y) / 2);
        if (before > 0) setFraming(zoomAt(size, box.aspect, framing, framing.zoom * (after / before), mid.px, mid.py));
      }
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
  };
  const onWheel = (e: ReactWheelEvent) => {
    if (!editable || mode !== "frame" || !size || !box) return;
    const p = at(e.clientX, e.clientY);
    setFraming(zoomAt(size, box.aspect, framing, framing.zoom * Math.exp(-e.deltaY * WHEEL), p.px, p.py));
  };

  const keep = editable ? (changed ? framing : (current.framing ?? null)) : undefined;

  return createPortal(
    <div role="dialog" aria-modal aria-label={current.caption} className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex h-16 shrink-0 items-center gap-2 px-3">
        <button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Close">
          <Icon name="close" className="size-5" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-subhead text-white">{current.caption}</span>
          <span className="truncate text-footnote text-white/60">
            {[images.length > 1 ? `${index + 1} of ${images.length}` : null, size ? `${size.w}×${size.h}` : null, frame && mode === "frame" ? frame.label : null].filter(Boolean).join(" · ")}
          </span>
        </div>
        {frame ? (
          <div className="flex shrink-0 rounded-full bg-white/15 p-0.5 text-footnote font-medium" role="group" aria-label="View">
            {(["frame", "whole"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("flex h-9 items-center gap-1.5 rounded-full px-3", mode === m ? "bg-white text-black" : "text-white/85 hover:text-white")}>
                <Icon name={m === "frame" ? "crop" : "image"} className="size-4" />
                <span className="hidden sm:inline">{m === "frame" ? "In its frame" : "Whole image"}</span>
              </button>
            ))}
          </div>
        ) : null}
        {action && (action.can?.(index) ?? true) ? (
          used ? (
            editable && changed ? (
              <button type="button" disabled={action.busy} onClick={() => action.onFrame?.(index, framing)} className="h-11 shrink-0 rounded-full bg-white px-4 text-subhead font-medium text-black hover:bg-white/90 disabled:opacity-50">
                {action.busy ? "Saving…" : "Save framing"}
              </button>
            ) : (
              <span className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-4 text-subhead font-medium">
                <Icon name="check" className="size-4" />
                {action.doneLabel}
              </span>
            )
          ) : (
            <button type="button" disabled={action.busy} onClick={() => action.onUse(index, keep)} className="h-11 shrink-0 rounded-full bg-white px-4 text-subhead font-medium text-black hover:bg-white/90 disabled:opacity-50">
              {action.busy ? "Saving…" : action.label}
            </button>
          )
        ) : null}
        <a href={current.url} target="_blank" rel="noreferrer" className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Open the original">
          <Icon name="external" className="size-5" />
        </a>
      </div>

      <div
        ref={stage}
        className={cn("relative min-h-0 flex-1 overflow-hidden select-none", editable && mode === "frame" && "cursor-grab touch-none active:cursor-grabbing")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onClick={mode === "whole" && !frame ? onClose : undefined}
      >
        {mode === "frame" && frame && frameSize && space ? (
          <div
            data-frame
            className="absolute"
            style={{ left: (space.w - frameSize.w) / 2, top: (space.h - frameSize.h) / 2, width: frameSize.w, height: frameSize.h }}
          >
            {/* A remote image at its own address: what the export carries. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.url}
              src={current.url}
              alt=""
              referrerPolicy="no-referrer"
              draggable={false}
              onLoad={(e) => {
                const w = e.currentTarget.naturalWidth;
                const h = e.currentTarget.naturalHeight;
                setNatural((n) => (n[index]?.w === w && n[index]?.h === h ? n : { ...n, [index]: { w, h } }));
              }}
              className={cn("pointer-events-none absolute max-w-none", box ? (placed ? "" : "inset-0 size-full object-cover opacity-0") : "inset-0 size-full rounded-full object-cover")}
              style={placed ? { left: placed.left, top: placed.top, width: placed.width, height: placed.height } : undefined}
            />
            {/* The frame's edge; outside it, the rest of the picture dimmed. */}
            <div
              aria-hidden
              className={cn("pointer-events-none absolute inset-0 ring-1 ring-white/85", frame.kind === "circle" ? "rounded-full" : "rounded-lg")}
              style={{ boxShadow: "0 0 0 100vmax rgb(0 0 0 / 0.7)" }}
            />
          </div>
        ) : (
          <div className="flex size-full items-center justify-center px-4 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={current.url} src={current.url} alt="" referrerPolicy="no-referrer" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </div>

      <div className="flex min-h-20 shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-3">
        {images.length > 1 ? (
          <button type="button" disabled={index === 0} onClick={() => go(index - 1)} className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30" aria-label="Previous image">
            <Icon name="chevronLeft" className="size-6" />
          </button>
        ) : null}
        {editable && mode === "frame" && box && size ? (
          <>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFraming(zoomAt(size, box.aspect, framing, framing.zoom / 1.15))} className="grid size-9 place-items-center rounded-full text-white/85 hover:bg-white/15" aria-label="Zoom out">
                <Icon name="zoomOut" className="size-5" />
              </button>
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={framing.zoom}
                onChange={(e) => setFraming(zoomAt(size, box.aspect, framing, Number(e.currentTarget.value)))}
                aria-label="Zoom"
                className="w-36 accent-white sm:w-56"
              />
              <button type="button" onClick={() => setFraming(zoomAt(size, box.aspect, framing, framing.zoom * 1.15))} className="grid size-9 place-items-center rounded-full text-white/85 hover:bg-white/15" aria-label="Zoom in">
                <Icon name="zoomIn" className="size-5" />
              </button>
            </div>
            <button
              type="button"
              disabled={sameFraming(framing, null)}
              onClick={() => setFraming(CENTRED)}
              className="h-9 rounded-full bg-white/15 px-3 text-footnote font-medium hover:bg-white/25 disabled:opacity-40"
            >
              Fill frame
            </button>
            <span className="hidden text-footnote text-white/55 md:inline">Drag to move · scroll or pinch to zoom</span>
          </>
        ) : images.length > 1 ? (
          <div className="flex gap-1.5">
            {images.map((img, i) => (
              <span key={`${img.url}-${i}`} className={cn("size-2 rounded-full", i === index ? "bg-white" : "bg-white/35")} />
            ))}
          </div>
        ) : null}
        {images.length > 1 ? (
          <button type="button" disabled={index === images.length - 1} onClick={() => go(index + 1)} className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30" aria-label="Next image">
            <Icon name="chevronRight" className="size-6" />
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
