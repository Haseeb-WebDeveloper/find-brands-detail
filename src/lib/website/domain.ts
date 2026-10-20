const TWO_LEVEL_SUFFIXES = new Set([
  "co.kr", "or.kr", "co.uk", "com.au", "co.jp", "com.cn", "com.tw", "com.hk",
  "co.nz", "com.sg", "com.br", "co.id", "com.my", "co.th", "com.vn",
]);

/** eTLD+1, good enough for brand sites: a short list of two-level suffixes, not the full PSL. */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  return TWO_LEVEL_SUFFIXES.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
}

export function compactName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** The compact name, then each word of four or more compact characters ("Dr. Althea" → althea). */
export function nameTokens(brand: string): string[] {
  const words = brand.split(/[\s,.&/'’-]+/).map(compactName).filter((w) => w.length >= 4);
  return [...new Set([compactName(brand), ...words])].filter(Boolean);
}

/** Whether the registrable domain's name part (hyphens dropped) contains any brand token. */
export function domainMatchesBrand(host: string, brand: string): boolean {
  const domain = compactName(registrableDomain(host).split(".")[0] ?? "");
  return nameTokens(brand).some((token) => domain.includes(token));
}
