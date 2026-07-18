import { transliterateSerbianName } from "./transliterate.js";

export interface MRZResult {
  lines: string[];
}

/** Popuni string do tražene dužine `<` karakterima (ili ga odseci ako je predugačak). */
export function padField(value: string, length: number): string {
  return value.length >= length ? value.slice(0, length) : value + "<".repeat(length - value.length);
}

/** MRZ polje imena: PREZIME<<IME<DRUGO_IME, popunjeno `<` do tražene dužine. */
export function buildNameField(lastName: string, firstName: string, length: number): string {
  const last = transliterateSerbianName(lastName).replace(/ /g, "");
  const firstParts = transliterateSerbianName(firstName).split(" ").filter(Boolean);
  const raw = `${last}<<${firstParts.join("<")}`;
  return padField(raw, length);
}
