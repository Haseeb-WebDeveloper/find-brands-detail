export const MAX_BRANDS_PER_BATCH = 50;

export type ParsedBrand = { name: string; websiteHint: string | null };

/** A hostname with at least one dot and no spaces, optionally with scheme and path. */
const LOOKS_LIKE_WEBSITE = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i;

function toUrl(hint: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(hint) ? hint : `https://${hint}`).toString();
  } catch {
    return null;
  }
}

/** Brand names can contain commas ("Dear, Klairs"); only a trailing website counts as a hint. */
function splitLine(line: string): ParsedBrand {
  const lastComma = line.lastIndexOf(",");
  if (lastComma > 0) {
    const tail = line.slice(lastComma + 1).trim();
    const url = LOOKS_LIKE_WEBSITE.test(tail) ? toUrl(tail) : null;
    if (url) return { name: line.slice(0, lastComma).trim(), websiteHint: url };
  }
  return { name: line.trim(), websiteHint: null };
}

export function parseBatchInput(text: string): { brands: ParsedBrand[]; errors: string[] } {
  const brands: ParsedBrand[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const brand = splitLine(line);
    const key = brand.name.toLowerCase();
    if (seen.has(key)) {
      errors.push(`Line ${i + 1}: "${brand.name}" is already in this batch.`);
      return;
    }
    seen.add(key);
    brands.push(brand);
  });

  if (brands.length > MAX_BRANDS_PER_BATCH) {
    return { brands: [], errors: [`At most ${MAX_BRANDS_PER_BATCH} brands per batch.`] };
  }
  return { brands, errors };
}
