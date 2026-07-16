import { checkDigitChar } from "./checkDigit.js";
import { formatMRZDate } from "./dates.js";
import { buildNameField, padField, type MRZResult } from "./fields.js";
import type { SyntheticIdentity } from "./identity.js";

const LINE_LENGTH = 30;
const OPTIONAL_1 = "<".repeat(15);
const OPTIONAL_2 = "<".repeat(11);

/**
 * TD1 (lična karta) — 3 linije po 30 karaktera. Layout po ICAO 9303 Part 5:
 *
 * Linija 1: "I<" + zemlja izdavanja(3) + broj dokumenta(9) + CD + opciono polje 1(15)
 * Linija 2: rođenje(6) + CD + pol(1) + istek(6) + CD + nacionalnost(3)
 *           + opciono polje 2(11) + kompozitni CD
 * Linija 3: polje imena(30)
 *
 * Kompozitni check-digit se računa nad: (linija1, pozicije 6-30 tj. broj
 * dokumenta+CD+opciono polje 1 = 25) + (linija2: rođenje+CD = 7) +
 * (linija2: istek+CD = 7) + (linija2: opciono polje 2 = 11) = 50 karaktera.
 */
export function generateTD1(identity: SyntheticIdentity): MRZResult {
  const documentCode = "I<";
  const issuingCountry = identity.nationality;
  const documentNumber = padField(identity.documentNumber, 9);
  const documentNumberCheck = checkDigitChar(documentNumber);
  const line1 = documentCode + issuingCountry + documentNumber + documentNumberCheck + OPTIONAL_1;

  const birthDate = formatMRZDate(identity.birthDate);
  const birthDateCheck = checkDigitChar(birthDate);
  const expiryDate = formatMRZDate(identity.expiryDate);
  const expiryDateCheck = checkDigitChar(expiryDate);

  const compositeInput = line1.slice(5) + birthDate + birthDateCheck + expiryDate + expiryDateCheck + OPTIONAL_2;
  const compositeCheck = checkDigitChar(compositeInput);

  const line2 = [
    birthDate,
    birthDateCheck,
    identity.sex,
    expiryDate,
    expiryDateCheck,
    identity.nationality,
    OPTIONAL_2,
    compositeCheck,
  ].join("");

  const line3 = buildNameField(identity.lastName, identity.firstName, LINE_LENGTH);

  return { lines: [line1, line2, line3] };
}
