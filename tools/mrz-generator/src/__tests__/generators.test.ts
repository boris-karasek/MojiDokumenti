import { parse as parseMRZ } from "mrz";
import { describe, expect, it } from "vitest";
import { corruptLines } from "../corrupt.js";
import { generateRandomIdentity } from "../identity.js";
import type { SyntheticIdentity } from "../identity.js";
import { generateTD1 } from "../td1.js";
import { generateTD3 } from "../td3.js";

/**
 * Fiksan identitet (NE prava osoba) koji namerno testira transliteraciju
 * (Đ→DJ, Š→S) i JMBG ugrađen u lični broj/opciono polje. JMBG "1705990710012"
 * je strukturno validan (v. jmbg.test.ts), ne pripada realnoj osobi.
 */
const FIXED_IDENTITY: SyntheticIdentity = {
  firstName: "MILOŠ",
  lastName: "ĐORĐEVIĆ",
  sex: "M",
  nationality: "SRB",
  documentNumber: "123456789",
  birthDate: new Date(Date.UTC(1990, 4, 17)),
  expiryDate: new Date(Date.UTC(2030, 4, 17)),
  jmbg: "1705990710012",
};

describe("generateTD3 — fiksan primer", () => {
  it("proizvodi tačno očekivane linije koje mrz paket potvrđuje kao validne", () => {
    const { lines } = generateTD3(FIXED_IDENTITY);
    expect(lines).toEqual(["P<SRBDJORDJEVIC<<MILOS<<<<<<<<<<<<<<<<<<<<<<", "1234567897SRB9005178M30051761705990710012<66"]);
    expect(parseMRZ(lines).valid).toBe(true);
  });
});

describe("generateTD1 — fiksan primer", () => {
  it("proizvodi tačno očekivane linije koje mrz paket potvrđuje kao validne", () => {
    const { lines } = generateTD1(FIXED_IDENTITY);
    expect(lines).toEqual(["IDSRB12345678971705990710012<<", "9005178M3005176SRB<<<<<<<<<<<8", "DJORDJEVIC<<MILOS<<<<<<<<<<<<<"]);
    expect(parseMRZ(lines).valid).toBe(true);
  });
});

describe("generateTD3 — nasumični zapisi", () => {
  it("proizvodi dve linije od po 44 karaktera, uvek SRB, uvek validne", () => {
    for (let i = 0; i < 50; i++) {
      const identity = generateRandomIdentity();
      const { lines } = generateTD3(identity);
      expect(lines).toHaveLength(2);
      for (const line of lines) expect(line).toHaveLength(44);
      expect(lines[0]!.slice(0, 5)).toBe("P<SRB");
      expect(/^\d+$/.test(identity.documentNumber)).toBe(true);
      expect(parseMRZ(lines).valid).toBe(true);
    }
  });
});

describe("generateTD1 — nasumični zapisi", () => {
  it("proizvodi tri linije od po 30 karaktera, uvek SRB, uvek validne", () => {
    for (let i = 0; i < 50; i++) {
      const identity = generateRandomIdentity();
      const { lines } = generateTD1(identity);
      expect(lines).toHaveLength(3);
      for (const line of lines) expect(line).toHaveLength(30);
      expect(lines[0]!.slice(0, 5)).toBe("IDSRB");
      expect(parseMRZ(lines).valid).toBe(true);
    }
  });
});

describe("corruptLines", () => {
  it("uvek promeni ulazne linije i (skoro uvek) naruši validnost", () => {
    const { lines } = generateTD3(generateRandomIdentity());
    const corrupt = corruptLines(lines);
    expect(corrupt.lines).not.toEqual(lines);
  });

  it("truncate-line i extend-line uvek naruše dužinu linije (mrz odbija parsiranje)", () => {
    const { lines } = generateTD3(generateRandomIdentity());
    for (const type of ["truncate-line", "extend-line"] as const) {
      let corrupt = corruptLines(lines);
      while (corrupt.corruption !== type) corrupt = corruptLines(lines);
      expect(() => parseMRZ(corrupt.lines)).toThrow();
    }
  });
});
