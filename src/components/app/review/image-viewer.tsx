"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/design/cn";
import { Icon } from "@/design/icon";

export type ViewerImage = { url: string; caption: string };

/** A choice to make about the image on screen ("Use this image"); `done` when it is already made. */
export type ViewerAction = { label: string; doneLabel: string; done: (index: number) => boolean; onPress: (index: number) => void; busy?: boolean };

/**
 * An image full screen, the ones beside it a press away (arrows, or ← →), Esc to close. Black round
 * the picture, as contractor-sites' photo viewer: a viewer, not a surface.
 */
export function ImageViewer({ images, start, onClose, action }: { images: ViewerImage[]; start: number; onClose: () => void; action?: ViewerAction }) {
  const [index, setIndex] = useState(Math.min(start, images.length - 1));
  const current = images[index];

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener("keydown", key);
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.documentElement.style.overflow = overflow;
    };
  }, [images.length, onClose]);

  if (!current) return null;
  return createPortal(
    <div role="dialog" aria-modal className="fixed inset-0 z-[60] flex flex-col bg-black text-white" onClick={onClose}>
      <div className="flex h-16 shrink-0 items-center gap-3 px-3" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Close">
          <Icon name="close" className="size-5" />
        </button>
        <span className="min-w-0 flex-1 truncate text-subhead text-white/80">{current.caption}</span>
        {action ? (
          action.done(index) ? (
            <span className="rounded-full bg-white/15 px-4 py-2 text-subhead font-medium">{action.doneLabel}</span>
          ) : (
            <button type="button" disabled={action.busy} onClick={() => action.onPress(index)} className="rounded-full bg-white px-4 py-2 text-subhead font-medium text-black hover:bg-white/90 disabled:opacity-50">
              {action.label}
            </button>
          )
        ) : null}
        <a href={current.url} target="_blank" rel="noreferrer" className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Open the original">
          <Icon name="external" className="size-5" />
        </a>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        {/* A remote image at its own address: what the export will carry. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt="" referrerPolicy="no-referrer" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      </div>
      {images.length > 1 ? (
        <div className="flex h-20 shrink-0 items-center justify-between gap-3 px-4" onClick={(e) => e.stopPropagation()}>
          <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="grid size-12 place-items-center rounded-full bg-white/15 disabled:opacity-30" aria-label="Previous image">
            <Icon name="chevronLeft" className="size-6" />
          </button>
          <div className="flex gap-1.5">
            {images.map((img, i) => (
              <span key={img.url} className={cn("size-2 rounded-full", i === index ? "bg-white" : "bg-white/35")} />
            ))}
          </div>
          <button type="button" disabled={index === images.length - 1} onClick={() => setIndex(index + 1)} className="grid size-12 place-items-center rounded-full bg-white/15 disabled:opacity-30" aria-label="Next image">
            <Icon name="chevronRight" className="size-6" />
          </button>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
