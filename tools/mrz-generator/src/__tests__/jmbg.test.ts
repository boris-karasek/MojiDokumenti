import { describe, expect, it } from "vitest";
import { computeJMBGControlDigit, generateJMBG } from "../jmbg.js";

/**
 * Javno dostupan primer računa JMBG kontrolne cifre (formula i primer sa
 * opsteobrazovanje.in.rs, v. tools/mrz-generator/README.md za citat) — žena
 * rođena 05.12.1981. u Beogradu: JMBG 0512981717776, kontrolna cifra 6.
 * Generički primer koji ilustruje algoritam, NE prava osoba.
 */
describe("computeJMBGControlDigit — javno dostupan referentni primer", () => {
  it("za prvih 12 cifara '051298171777' kontrolna cifra je 6", () => {
    expect(computeJMBGControlDigit("051298171777")).toBe(6);
  });

  it("baca grešku ako ulaz nema tačno 12 cifara", () => {
    expect(() => computeJMBGControlDigit("123")).toThrow();
    expect(() => computeJMBGControlDigit("12345678901A")).toThrow();
  });
});

describe("generateJMBG", () => {
  it("prvih 7 cifara (DDMMGGG) odgovara prosleđenom datumu rođenja", () => {
    const birthDate = new Date(Date.UTC(1990, 4, 17)); // 17.05.1990
    const jmbg = generateJMBG(birthDate, "M");
    expect(jmbg).toHaveLength(13);
    expect(jmbg.slice(0, 7)).toBe("1705990");
  });

  it("godina 2005 daje GGG='005' (poslednje tri cifre, ne skraćeno)", () => {
    const birthDate = new Date(Date.UTC(2005, 0, 9)); // 09.01.2005
    const jmbg = generateJMBG(birthDate, "F");
    expect(jmbg.slice(0, 7)).toBe("0901005");
  });

  it("redni broj (BBB) prati konvenciju pola: 000-499 M, 500-999 Ž", () => {
    for (let i = 0; i < 50; i++) {
      const jmbg = generateJMBG(new Date(Date.UTC(1990, 0, 1)), "M");
      expect(Number(jmbg.slice(9, 12))).toBeLessThanOrEqual(499);
    }
    for (let i = 0; i < 50; i++) {
      const jmbg = generateJMBG(new Date(Date.UTC(1990, 0, 1)), "F");
      expect(Number(jmbg.slice(9, 12))).toBeGreaterThanOrEqual(500);
    }
  });

  it("regionalna oznaka (RR) je uvek u srpskom opsegu 70-89", () => {
    for (let i = 0; i < 50; i++) {
      const jmbg = generateJMBG(new Date(Date.UTC(1990, 0, 1)), "M");
      const region = Number(jmbg.slice(7, 9));
      expect(region).toBeGreaterThanOrEqual(70);
      expect(region).toBeLessThanOrEqual(89);
    }
  });

  it("kontrolna cifra (13.) je uvek ispravna po JMBG formuli", () => {
    for (let i = 0; i < 50; i++) {
      const jmbg = generateJMBG(new Date(Date.UTC(1985, 6, 23)), "F");
      expect(Number(jmbg[12])).toBe(computeJMBGControlDigit(jmbg.slice(0, 12)));
    }
  });
});
