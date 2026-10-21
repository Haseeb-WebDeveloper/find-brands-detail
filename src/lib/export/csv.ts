import type { RawImportRow } from "@/lib/export/importer/brand-import";

const cell = (value: string | undefined) => {
  const v = value ?? "";
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

/** RFC 4180 CSV with CRLF rows, the shape the importer's CSV parser reads. */
export function toCsv(headers: string[], rows: RawImportRow[]): string {
  return [headers, ...rows.map((r) => headers.map((h) => r[h]))].map((cells) => cells.map(cell).join(",")).join("\r\n") + "\r\n";
}
