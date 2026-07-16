import { describe, expect, it } from "vitest";
import { computeCheckDigit } from "../checkDigit.js";

/**
 * Referentni primer iz ICAO Doc 9303, Part 4, Appendix A (TD3 - pasoš):
 *
 *   P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<
 *   L898902C36UTO7408122F1204159ZE184226B<<<<<10
 *
 * Ime, nacionalnost ("UTO" — fiktivna zemlja iz specifikacije) i broj
 * dokumenta su iz same ICAO specifikacije, ne stvarna osoba.
 */
describe("computeCheckDigit — ICAO 9303 referentni primer (L898902C3...)", () => {
  it("check-digit broja dokumenta 'L898902C3' je 6", () => {
    expect(computeCheckDigit("L898902C3")).toBe(6);
  });

  it("check-digit datuma rođenja '740812' je 2", () => {
    expect(computeCheckDigit("740812")).toBe(2);
  });

  it("check-digit datuma isteka '120415' je 9", () => {
    expect(computeCheckDigit("120415")).toBe(9);
  });

  it("check-digit ličnog broja 'ZE184226B<<<<<' je 1", () => {
    expect(computeCheckDigit("ZE184226B<<<<<")).toBe(1);
  });

  it("kompozitni check-digit celog TD3 zapisa je 0", () => {
    const compositeInput = "L898902C36" + "7408122" + "1204159ZE184226B<<<<<1";
    expect(compositeInput).toHaveLength(39);
    expect(computeCheckDigit(compositeInput)).toBe(0);
  });
});

describe("computeCheckDigit — osnovni slučajevi", () => {
  it("'<' vrednost je uvek 0", () => {
    expect(computeCheckDigit("<<<")).toBe(0);
  });

  it("prazan string daje 0", () => {
    expect(computeCheckDigit("")).toBe(0);
  });

  it("ciklus težina je 7-3-1 (jedna cifra '1' na težini 7)", () => {
    expect(computeCheckDigit("1")).toBe(7);
  });

  it("slovo 'A' (vrednost 10) na težini 3 daje 0 (30 mod 10)", () => {
    expect(computeCheckDigit("<A")).toBe(0);
  });

  it("baca grešku na nevalidan karakter", () => {
    expect(() => computeCheckDigit("a")).toThrow();
  });
});
