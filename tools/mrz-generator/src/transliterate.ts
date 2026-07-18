/**
 * Transliteracija srpske ćirilice/latinice sa dijakritikom u čist A-Z opseg
 * koji MRZ zahteva. Mapiranje po uobičajenoj ICAO/pasoškoj konvenciji za
 * srpska imena: Č/Ć→C, Đ→DJ, Š→S, Ž→Z (i mala slova istih).
 */
const DIACRITIC_MAP: Record<string, string> = {
  Č: "C",
  Ć: "C",
  Đ: "DJ",
  Š: "S",
  Ž: "Z",
  č: "C",
  ć: "C",
  đ: "DJ",
  š: "S",
  ž: "Z",
};

export function transliterateSerbianName(value: string): string {
  const mapped = [...value].map((char) => DIACRITIC_MAP[char] ?? char).join("");
  return mapped.toUpperCase().replace(/[^A-Z ]/g, "");
}
