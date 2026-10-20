/**
 * The audited brands (2026-10-16). `hint` is the website the original sheet gave; `expect` is the
 * registrable domain of the brand's real site; `trap` marks hints that must never be chosen.
 * `null` expect = no usable official site at audit time.
 */
export type TestBrand = { name: string; hint: string; expect: string | null; trap?: boolean };

export const TEST_SET: TestBrand[] = [
  { name: "haruharu wonder", hint: "https://haruharu.com/", expect: "haruharu.com" },
  { name: "AXIS-Y", hint: "https://www.axis-y.com/", expect: "axis-y.com" },
  { name: "numbuzin", hint: "https://numbuzin.com/", expect: "numbuzin.com" },
  { name: "SOME BY MI", hint: "https://somebymi.com/", expect: "somebymi.com" },
  { name: "Pyunkang Yul", hint: "https://pyunkangyul.us/", expect: "pyunkangyul.com", trap: true },
  { name: "Dr. Althea", hint: "https://doctoraltheaglobal.com/", expect: "doctoraltheaglobal.com" },
  { name: "Biodance", hint: "https://biodance.com/", expect: "biodance.com" },
  { name: "Celimax", hint: "https://celimax.us/", expect: "celimax.us" },
  { name: "Purito Seoul", hint: "https://purito.com/", expect: "purito.com" },
  { name: "Benton", hint: "https://bentoncosmetic.com/", expect: "bentoncosmetic.com" },
  { name: "Round A'Round", hint: "https://roundaround.co.kr/", expect: null, trap: true },
  { name: "Dear, Klairs", hint: "https://www.klairscosmetics.com/", expect: "klairscosmetics.com" },
  { name: "Jumiso", hint: "https://jumiso.com/", expect: "jumiso.us", trap: true },
  { name: "Aestura", hint: "https://www.aestura.com/", expect: "aestura.com" },
  { name: "TIRTIR", hint: "https://www.tirtir.co.kr/", expect: "tirtir.co.kr" },
  { name: "Dr.G", hint: "https://www.dr-g.co.kr/", expect: "dr-g.co.kr" },
];
