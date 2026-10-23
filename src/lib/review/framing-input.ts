import { CENTRED, parseFraming, type Framing } from "@/lib/images/framing";

/**
 * A framing sent from the browser, re-read through the CSV's own rules (what the export writes is
 * what the importer accepts). The centre crop is stored as null, so "Fill frame" leaves no trace.
 */
export function cleanFraming(input: unknown): { ok: true; framing: Framing | null } | { ok: false } {
  if (input === null || input === undefined) return { ok: true, framing: null };
  const f = input as Partial<Framing>;
  if (typeof f.zoom !== "number" || typeof f.x !== "number" || typeof f.y !== "number") return { ok: false };
  const parsed = parseFraming(`${f.zoom},${f.x},${f.y}`);
  if (parsed === "invalid" || parsed === null) return { ok: false };
  const centred = Math.abs(parsed.zoom - CENTRED.zoom) < 0.005 && Math.abs(parsed.x - CENTRED.x) < 0.0005 && Math.abs(parsed.y - CENTRED.y) < 0.0005;
  // Kept at the precision the CSV carries, so the page shows exactly what will be exported.
  return { ok: true, framing: centred ? null : { zoom: round(parsed.zoom, 2), x: round(parsed.x, 3), y: round(parsed.y, 3) } };
}

const round = (n: number, places: number) => Number(n.toFixed(places));

/** A stored framing (a JSON column), or null when it isn't one. */
export function storedFraming(value: unknown): Framing | null {
  const c = cleanFraming(value);
  return c.ok ? c.framing : null;
}
