import type { ExpiryCategory } from "./expiry.js";
import { randomExpiryDate } from "./expiry.js";
import { generateJMBG } from "./jmbg.js";
import { randomBirthDate, randomItem, randomNumericString } from "./random.js";

export type Sex = "M" | "F";

/** Generator proizvodi ISKLJUČIVO srpska dokumenta (v. CLAUDE.md, "Posebni zahtevi"). */
export const NATIONALITY = "SRB";

export interface SyntheticIdentity {
  firstName: string;
  lastName: string;
  sex: Sex;
  nationality: typeof NATIONALITY;
  /** 9 cifara — čisto numerički (izbegava OCR 0/O dvosmislenost). */
  documentNumber: string;
  birthDate: Date;
  expiryDate: Date;
  /** 13 cifara, strukturno validan (v. jmbg.ts) — DDMMGGG odgovara birthDate. */
  jmbg: string;
}

/**
 * Očigledno izmišljena imena — NIKAD prave osobe (v. CLAUDE.md, "Posebni zahtevi").
 * Namerno uključuju srpsku dijakritiku (Č, Ć, Đ, Š, Ž) da bi se testirala
 * transliteracija u MRZ polje imena (v. transliterate.ts).
 */
const FIRST_NAMES: Record<Sex, readonly string[]> = {
  M: ["MARKO", "NIKOLA", "STEFAN", "ALEKSANDAR", "MILOŠ", "DUŠAN", "IGOR", "VLADIMIR", "PETAR", "LAZAR"],
  F: ["ANA", "JELENA", "MILICA", "TEODORA", "IVANA", "MARIJA", "KATARINA", "SOFIJA", "JOVANA", "SNEŽANA"],
};

const LAST_NAMES = [
  "PETROVIĆ",
  "JOVANOVIĆ",
  "NIKOLIĆ",
  "STOJANOVIĆ",
  "MARKOVIĆ",
  "ĐORĐEVIĆ",
  "IVANOVIĆ",
  "POPOVIĆ",
  "ILIĆ",
  "PAVLOVIĆ",
  "VUČKOVIĆ",
] as const;

export function generateRandomIdentity(expiryCategory: ExpiryCategory = "valid"): SyntheticIdentity {
  const sex = randomItem<Sex>(["M", "F"]);
  const birthDate = randomBirthDate();
  return {
    firstName: randomItem(FIRST_NAMES[sex]),
    lastName: randomItem(LAST_NAMES),
    sex,
    nationality: NATIONALITY,
    documentNumber: randomNumericString(9),
    birthDate,
    expiryDate: randomExpiryDate(expiryCategory),
    jmbg: generateJMBG(birthDate, sex),
  };
}
