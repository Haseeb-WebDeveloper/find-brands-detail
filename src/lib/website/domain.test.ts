import { describe, expect, it } from "vitest";
import { compactName, domainMatchesBrand, nameTokens, registrableDomain } from "@/lib/website/domain";

describe("registrableDomain", () => {
  it("keeps two labels for ordinary domains", () => {
    expect(registrableDomain("www.tirtir.global")).toBe("tirtir.global");
    expect(registrableDomain("us.numbuzin.com")).toBe("numbuzin.com");
  });

  it("keeps three labels for two-level suffixes", () => {
    expect(registrableDomain("www.dr-g.co.kr")).toBe("dr-g.co.kr");
    expect(registrableDomain("shop.brand.co.uk")).toBe("brand.co.uk");
  });
});

describe("names", () => {
  it("compacts accents and punctuation", () => {
    expect(compactName("L'Oréal Paris")).toBe("lorealparis");
    expect(compactName("AXIS-Y")).toBe("axisy");
  });

  it("tokens are the compact name plus long words", () => {
    expect(nameTokens("Dr. Althea")).toEqual(["dralthea", "althea"]);
    expect(nameTokens("Dr.G")).toEqual(["drg"]);
    expect(nameTokens("Dear, Klairs")).toEqual(["dearklairs", "dear", "klairs"]);
  });
});

describe("domainMatchesBrand", () => {
  it("matches brand domains", () => {
    expect(domainMatchesBrand("doctoraltheaglobal.com", "Dr. Althea")).toBe(true);
    expect(domainMatchesBrand("www.axis-y.com", "AXIS-Y")).toBe(true);
    expect(domainMatchesBrand("dr-g.co.kr", "Dr.G")).toBe(true);
    expect(domainMatchesBrand("klairscosmetics.com", "Dear, Klairs")).toBe(true);
  });

  it("rejects unrelated domains (the pyunkangyul.us hijack)", () => {
    expect(domainMatchesBrand("xoilaclivettbdu.tv", "Pyunkang Yul")).toBe(false);
  });
});
