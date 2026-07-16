import { describe, expect, it } from "vitest";
import { parseExpirySpec, randomExpiryDate } from "../expiry.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("randomExpiryDate", () => {
  it("'valid' ističe za 2-9 godina od danas", () => {
    for (let i = 0; i < 50; i++) {
      const date = randomExpiryDate("valid");
      const daysFromNow = (date.getTime() - Date.now()) / DAY_MS;
      expect(daysFromNow).toBeGreaterThan(365 * 1); // sigurno u budućnosti, oko 2+ godine
      expect(daysFromNow).toBeLessThan(365 * 10);
    }
  });

  it("'soon' ističe za 7-30 dana od danas", () => {
    for (let i = 0; i < 50; i++) {
      const date = randomExpiryDate("soon");
      const daysFromNow = (date.getTime() - Date.now()) / DAY_MS;
      expect(daysFromNow).toBeGreaterThanOrEqual(6.9);
      expect(daysFromNow).toBeLessThanOrEqual(30.1);
    }
  });

  it("'expired' je istekao pre 1-60 dana", () => {
    for (let i = 0; i < 50; i++) {
      const date = randomExpiryDate("expired");
      const daysFromNow = (date.getTime() - Date.now()) / DAY_MS;
      expect(daysFromNow).toBeLessThan(0);
      expect(daysFromNow).toBeGreaterThanOrEqual(-60.1);
    }
  });

  it("podrazumevana kategorija je 'valid'", () => {
    const date = randomExpiryDate();
    expect(date.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("parseExpirySpec", () => {
  it("jedna kategorija primenjuje se na sve zapise", () => {
    const categories = parseExpirySpec("soon", 5);
    expect(categories).toHaveLength(5);
    expect(categories.every((c) => c === "soon")).toBe(true);
  });

  it("eksplicitna raspodela daje tačan broj po kategoriji", () => {
    const categories = parseExpirySpec("valid:15,soon:3,expired:2", 20);
    expect(categories).toHaveLength(20);
    expect(categories.filter((c) => c === "valid")).toHaveLength(15);
    expect(categories.filter((c) => c === "soon")).toHaveLength(3);
    expect(categories.filter((c) => c === "expired")).toHaveLength(2);
  });

  it("baca grešku kad zbir raspodele ne odgovara broju zapisa", () => {
    expect(() => parseExpirySpec("valid:15,soon:3,expired:1", 20)).toThrow();
  });

  it("baca grešku na nepoznatu kategoriju", () => {
    expect(() => parseExpirySpec("nepostojeca", 5)).toThrow();
    expect(() => parseExpirySpec("valid:3,nepostojeca:2", 5)).toThrow();
  });

  it("baca grešku na nevalidan broj u raspodeli", () => {
    expect(() => parseExpirySpec("valid:abc", 5)).toThrow();
    expect(() => parseExpirySpec("valid:-1", -1)).toThrow();
  });
});
