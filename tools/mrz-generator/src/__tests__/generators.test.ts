import { parse as parseMRZ } from "mrz";
import { describe, expect, it } from "vitest";
import { corruptLines } from "../corrupt.js";
import { generateRandomIdentity } from "../identity.js";
import { generateTD1 } from "../td1.js";
import { generateTD3 } from "../td3.js";

describe("generateTD3", () => {
  it("proizvodi dve linije od po 44 karaktera koje 'mrz' paket smatra validnim", () => {
    for (let i = 0; i < 50; i++) {
      const { lines } = generateTD3(generateRandomIdentity());
      expect(lines).toHaveLength(2);
      for (const line of lines) expect(line).toHaveLength(44);
      expect(parseMRZ(lines).valid).toBe(true);
    }
  });
});

describe("generateTD1", () => {
  it("proizvodi tri linije od po 30 karaktera koje 'mrz' paket smatra validnim", () => {
    for (let i = 0; i < 50; i++) {
      const { lines } = generateTD1(generateRandomIdentity());
      expect(lines).toHaveLength(3);
      for (const line of lines) expect(line).toHaveLength(30);
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
