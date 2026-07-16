export interface MRZResult {
  lines: string[];
}

/** Popuni string do tražene dužine `<` karakterima (ili ga odseci ako je predugačak). */
export function padField(value: string, length: number): string {
  return value.length >= length ? value.slice(0, length) : value + "<".repeat(length - value.length);
}

/** MRZ polje imena: PREZIME<<IME<DRUGO_IME, popunjeno `<` do tražene dužine. */
export function buildNameField(lastName: string, firstName: string, length: number): string {
  const last = lastName.toUpperCase().replace(/[^A-Z]/g, "");
  const firstParts = firstName
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .split(" ")
    .filter(Boolean);
  const raw = `${last}<<${firstParts.join("<")}`;
  return padField(raw, length);
}
