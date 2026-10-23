"use client";

import { useState } from "react";
import { cn } from "@/design/cn";
import { CENTRED, type Framing } from "@/lib/images/framing";
import { placeImage } from "@/lib/images/frame-view";

/**
 * An image as the site will show it: cut to its frame the way the DB importer cuts it (centred, or
 * where the reviewer framed it). The box's shape comes from `className` (`aspect-[200/236]` for a
 * campaign tile, `aspect-[16/11]` for a cover). The image's size is known from research when it was
 * checked; otherwise it's read when it loads, and until then the image is drawn as a plain cover.
 */
export function FramedImage({
  src,
  aspect,
  framing,
  size,
  className,
}: {
  src: string;
  aspect: number;
  framing: Framing | null;
  size?: { w: number; h: number } | null;
  className?: string;
}) {
  const [loaded, setLoaded] = useState<{ w: number; h: number } | null>(null);
  const natural = loaded ?? size ?? null;
  // Percentages of the box, so the placement holds at any width.
  const p = natural ? placeImage(natural, aspect, framing ?? CENTRED, 100) : null;
  return (
    <span className={cn("relative block overflow-hidden bg-fill", className)}>
      {/* A remote image at its own address: what the export carries. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        draggable={false}
        onLoad={(e) => setLoaded({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        className={p ? "absolute max-w-none" : "size-full object-cover"}
        style={p ? { left: `${p.left}%`, top: `${(p.top / 100) * aspect * 100}%`, width: `${p.width}%`, height: `${(p.height / 100) * aspect * 100}%` } : undefined}
      />
    </span>
  );
}
