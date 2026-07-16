import type { ExpiryCategory } from "./expiry.js";
import { randomExpiryDate } from "./expiry.js";
import { randomBirthDate, randomDocumentNumber, randomItem } from "./random.js";

export type Sex = "M" | "F";

export interface SyntheticIdentity {
  firstName: string;
  lastName: string;
  sex: Sex;
  /** ISO 3166-1 alpha-3 kod (npr. SRB); koristi se i kao nacionalnost i kao izdavalac dokumenta. */
  nationality: string;
  documentNumber: string;
  birthDate: Date;
  expiryDate: Date;
}

/**
 * Očigledno izmišljena imena — NIKAD prave osobe (v. CLAUDE.md, "Posebni zahtevi").
 */
const FIRST_NAMES: Record<Sex, readonly string[]> = {
  M: ["MARKO", "NIKOLA", "STEFAN", "ALEKSANDAR", "MILOS", "DUSAN", "IGOR", "VLADIMIR", "PETAR", "LAZAR"],
  F: ["ANA", "JELENA", "MILICA", "TEODORA", "IVANA", "MARIJA", "KATARINA", "SOFIJA", "JOVANA", "TAMARA"],
};

const LAST_NAMES = [
  "PETROVIC",
  "JOVANOVIC",
  "NIKOLIC",
  "STOJANOVIC",
  "MARKOVIC",
  "DJORDJEVIC",
  "IVANOVIC",
  "POPOVIC",
  "ILIC",
  "PAVLOVIC",
] as const;

/** Realni ISO 3166-1 alpha-3 kodovi — namerno mala, proverena lista da izbegnemo nevalidne kodove. */
const NATIONALITIES = ["SRB", "HRV", "BIH", "MNE", "MKD", "SVN", "DEU", "AUT"] as const;

export function generateRandomIdentity(expiryCategory: ExpiryCategory = "valid"): SyntheticIdentity {
  const sex = randomItem<Sex>(["M", "F"]);
  return {
    firstName: randomItem(FIRST_NAMES[sex]),
    lastName: randomItem(LAST_NAMES),
    sex,
    nationality: randomItem(NATIONALITIES),
    documentNumber: randomDocumentNumber(),
    birthDate: randomBirthDate(),
    expiryDate: randomExpiryDate(expiryCategory),
  };
}
