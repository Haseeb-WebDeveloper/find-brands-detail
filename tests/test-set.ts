/**
 * The audited brands (2026-10-16), corrected 2026-10-21 after Gemini discovery found official sites
 * the first list missed (each confirmed by being linked from another official site, or by linking
 * the brand's verified Instagram).
 *
 * `hint`      the website the original sheet gave
 * `official`  registrable domains of the brand's real sites — choosing any of them is correct
 * `prefer`    the one the tool should pick: global, then US, then Korean (spec §7)
 * `trap`      the hint must never be chosen
 * `instagram` the brand's global Instagram account (verified badge at audit time)
 * `igTraps`   accounts that must never be chosen: impostors, squatters, or a regional account
 *             where the global one exists
 * `tiktok`    the brand's TikTok account (2026-10-20: linked from its site or its Instagram bio
 *             page, profile read); absent = not audited, nothing found to check against
 * `ttTraps`   TikTok accounts that must never be chosen (tiny accounts on the brand's name)
 * Empty `official` = no usable official site at audit time.
 */
export type TestBrand = {
  name: string;
  hint: string;
  official: string[];
  prefer: string | null;
  trap?: boolean;
  instagram: string | null;
  igTraps?: string[];
  tiktok?: string;
  ttTraps?: string[];
};

export const TEST_SET: TestBrand[] = [
  {
    name: "haruharu wonder",
    hint: "https://haruharu.com/",
    official: ["haruharuwonder.com", "haruharu.com"],
    prefer: "haruharuwonder.com",
    instagram: "haruharuwonder_official",
    igTraps: ["haruharu_wonder"],
    tiktok: "haruharuwonder_official",
    ttTraps: ["haruharuwonder"],
  },
  { name: "AXIS-Y", hint: "https://www.axis-y.com/", official: ["axis-y.com"], prefer: "axis-y.com", instagram: "axisy_official" },
  {
    name: "numbuzin",
    hint: "https://numbuzin.com/",
    official: ["numbuzin.com"],
    prefer: "numbuzin.com",
    instagram: "numbuzin_global",
    igTraps: ["numbuzin"],
    tiktok: "numbuzin_global",
  },
  {
    name: "SOME BY MI",
    hint: "https://somebymi.com/",
    official: ["somebymi.com", "somebymi.co.kr"],
    prefer: "somebymi.com",
    instagram: "somebymi",
    tiktok: "somebymi.official",
  },
  {
    name: "Pyunkang Yul",
    hint: "https://pyunkangyul.us/",
    official: ["pyunkangyulglobal.com", "pyunkangyul.com"],
    prefer: "pyunkangyulglobal.com",
    trap: true,
    instagram: "pyunkangyul_global",
    tiktok: "pyunkangyul.official",
  },
  {
    name: "Dr. Althea",
    hint: "https://doctoraltheaglobal.com/",
    official: ["doctoraltheaglobal.com"],
    prefer: "doctoraltheaglobal.com",
    instagram: "dr.altheaglobal",
    igTraps: ["doctoralthea"],
    tiktok: "dr.althea_official",
  },
  {
    name: "Biodance",
    hint: "https://biodance.com/",
    official: ["biodance.com"],
    prefer: "biodance.com",
    instagram: "biodance_official",
    igTraps: ["biodance_global"],
    tiktok: "biodance_global",
  },
  {
    name: "Celimax",
    hint: "https://celimax.us/",
    official: ["celimax.com", "celimax.us", "celimax.co.kr"],
    prefer: "celimax.com",
    instagram: "celimax.global",
    igTraps: ["celimax"],
    tiktok: "celimax.global",
  },
  { name: "Purito Seoul", hint: "https://purito.com/", official: ["purito.com"], prefer: "purito.com", instagram: "purito_official", tiktok: "purito_official" },
  {
    name: "Benton",
    hint: "https://bentoncosmetic.com/",
    official: ["bentoncosmetics.com", "bentoncosmetic.com"],
    prefer: "bentoncosmetics.com",
    instagram: "bentoncosmetic",
    tiktok: "bentoncosmetic",
    ttTraps: ["benton_official"],
  },
  { name: "Round A'Round", hint: "https://roundaround.co.kr/", official: [], prefer: null, trap: true, instagram: "roundaround_official", ttTraps: ["roundaround_official"] },
  {
    name: "Dear, Klairs",
    hint: "https://www.klairscosmetics.com/",
    official: ["klairscosmetics.com", "klairs.com", "klairs.co.kr"],
    prefer: "klairscosmetics.com",
    instagram: "klairs.global",
    tiktok: "klairs.global",
  },
  { name: "Jumiso", hint: "https://jumiso.com/", official: ["jumiso.us", "jumiso.co.kr"], prefer: "jumiso.us", trap: true, instagram: "jumiso_global", tiktok: "jumiso_global" },
  { name: "Aestura", hint: "https://www.aestura.com/", official: ["aestura.com"], prefer: "aestura.com", instagram: "aestura.official" },
  {
    name: "TIRTIR",
    hint: "https://www.tirtir.co.kr/",
    official: ["tirtir.global", "tirtir.co.kr"],
    prefer: "tirtir.global",
    instagram: "tirtir_global",
    igTraps: ["tirtir_official"],
    tiktok: "tirtir.official",
    ttTraps: ["tirtir_official"],
  },
  { name: "Dr.G", hint: "https://www.dr-g.co.kr/", official: ["dr-g.co.kr"], prefer: "dr-g.co.kr", instagram: "dr.g_official", ttTraps: ["drg_global"] },
];
