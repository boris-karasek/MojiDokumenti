import type { Sex } from "./identity.js";
import { randomInt } from "./random.js";

/**
 * JMBG (Jedinstveni matični broj građana) — 13 cifara: DDMMGGG + RR + BBB + K
 *
 *  - DDMMGGG (7) — datum rođenja: dan, mesec, poslednje 3 cifre godine
 *    (npr. 1958 → 958)
 *  - RR (2)      — regionalna oznaka mesta rođenja; 70-79 je centralna
 *    Srbija (71=Beograd, 72=Šumadija, 73=Niš, ...), 80-89 je Vojvodina
 *    (80=Novi Sad, 81=Sombor, 82=Subotica, ...) — obe su unutar Srbije
 *  - BBB (3)     — redni broj rođenja u regionu istog dana; po konvenciji
 *    000-499 muški, 500-999 ženski
 *  - K (1)       — kontrolna cifra, poseban mod-11 algoritam NAD PRVIH 12
 *    CIFARA (nije isto što i ICAO MRZ check-digit iz checkDigit.ts)
 *
 * Kontrolna cifra: uparuje se 1. i 7, 2. i 8, 3. i 9, 4. i 10, 5. i 11, 6. i
 * 12. cifra; svaki par se množi težinom 7,6,5,4,3,2 redom, sabere, i
 * K = 11 - (suma mod 11); ako je K >= 10 (suma mod 11 je 0 ili 1), K = 0.
 *
 * Algoritam i primer verifikovani preko javno dostupnog objašnjenja JMBG
 * formule (v. tools/mrz-generator/README.md za izvor i primer računa).
 */

const PAIR_WEIGHTS = [7, 6, 5, 4, 3, 2] as const;

export function computeJMBGControlDigit(first12Digits: string): number {
  if (!/^\d{12}$/.test(first12Digits)) {
    throw new Error(`computeJMBGControlDigit očekuje tačno 12 cifara, dobijeno: "${first12Digits}"`);
  }
  const digit = (i: number): number => Number(first12Digits[i]);

  let sum = 0;
  for (let i = 0; i < PAIR_WEIGHTS.length; i++) {
    sum += PAIR_WEIGHTS[i]! * (digit(i) + digit(i + 6));
  }

  const remainder = sum % 11;
  const control = 11 - remainder;
  return control >= 10 ? 0 : control;
}

/** Regionalne oznake (RR) koje pripadaju Srbiji: 70-79 centralna Srbija, 80-89 Vojvodina. */
function randomRegionCode(): string {
  return String(randomInt(70, 89)).padStart(2, "0");
}

/** Redni broj (BBB) po konvenciji: 000-499 muški, 500-999 ženski. */
function randomSequenceNumber(sex: Sex): string {
  const value = sex === "M" ? randomInt(0, 499) : randomInt(500, 999);
  return String(value).padStart(3, "0");
}

export function generateJMBG(birthDate: Date, sex: Sex): string {
  const dd = String(birthDate.getUTCDate()).padStart(2, "0");
  const mm = String(birthDate.getUTCMonth() + 1).padStart(2, "0");
  const ggg = String(birthDate.getUTCFullYear() % 1000).padStart(3, "0");

  const first12 = dd + mm + ggg + randomRegionCode() + randomSequenceNumber(sex);
  return first12 + String(computeJMBGControlDigit(first12));
}
