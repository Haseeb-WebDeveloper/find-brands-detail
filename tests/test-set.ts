/**
 * The audited brands (2026-10-16), corrected 2026-10-21 after Gemini discovery found official sites
 * the first list missed (each confirmed by being linked from another official site, or by linking
 * the brand's verified Instagram).
 *
 * `hint`     the website the original sheet gave
 * `official` registrable domains of the brand's real sites — choosing any of them is correct
 * `prefer`   the one the tool should pick: global, then US, then Korean (spec §7)
 * `trap`     the hint must never be chosen
 * Empty `official` = no usable official site at audit time.
 */
export type TestBrand = { name: string; hint: string; official: string[]; prefer: string | null; trap?: boolean };

export const TEST_SET: TestBrand[] = [
  { name: "haruharu wonder", hint: "https://haruharu.com/", official: ["haruharuwonder.com", "haruharu.com"], prefer: "haruharuwonder.com" },
  { name: "AXIS-Y", hint: "https://www.axis-y.com/", official: ["axis-y.com"], prefer: "axis-y.com" },
  { name: "numbuzin", hint: "https://numbuzin.com/", official: ["numbuzin.com"], prefer: "numbuzin.com" },
  { name: "SOME BY MI", hint: "https://somebymi.com/", official: ["somebymi.com", "somebymi.co.kr"], prefer: "somebymi.com" },
  {
    name: "Pyunkang Yul",
    hint: "https://pyunkangyul.us/",
    official: ["pyunkangyulglobal.com", "pyunkangyul.com"],
    prefer: "pyunkangyulglobal.com",
    trap: true,
  },
  { name: "Dr. Althea", hint: "https://doctoraltheaglobal.com/", official: ["doctoraltheaglobal.com"], prefer: "doctoraltheaglobal.com" },
  { name: "Biodance", hint: "https://biodance.com/", official: ["biodance.com"], prefer: "biodance.com" },
  { name: "Celimax", hint: "https://celimax.us/", official: ["celimax.com", "celimax.us", "celimax.co.kr"], prefer: "celimax.com" },
  { name: "Purito Seoul", hint: "https://purito.com/", official: ["purito.com"], prefer: "purito.com" },
  { name: "Benton", hint: "https://bentoncosmetic.com/", official: ["bentoncosmetics.com", "bentoncosmetic.com"], prefer: "bentoncosmetics.com" },
  { name: "Round A'Round", hint: "https://roundaround.co.kr/", official: [], prefer: null, trap: true },
  {
    name: "Dear, Klairs",
    hint: "https://www.klairscosmetics.com/",
    official: ["klairscosmetics.com", "klairs.com", "klairs.co.kr"],
    prefer: "klairscosmetics.com",
  },
  { name: "Jumiso", hint: "https://jumiso.com/", official: ["jumiso.us", "jumiso.co.kr"], prefer: "jumiso.us", trap: true },
  { name: "Aestura", hint: "https://www.aestura.com/", official: ["aestura.com"], prefer: "aestura.com" },
  { name: "TIRTIR", hint: "https://www.tirtir.co.kr/", official: ["tirtir.global", "tirtir.co.kr"], prefer: "tirtir.global" },
  { name: "Dr.G", hint: "https://www.dr-g.co.kr/", official: ["dr-g.co.kr"], prefer: "dr-g.co.kr" },
];
