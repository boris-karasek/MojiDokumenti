import { checkDigitChar } from "./checkDigit.js";
import { formatMRZDate } from "./dates.js";
import { buildNameField, padField, type MRZResult } from "./fields.js";
import type { SyntheticIdentity } from "./identity.js";

const LINE_LENGTH = 44;
const PERSONAL_NUMBER = "<".repeat(14);

/**
 * TD3 (pasoš) — 2 linije po 44 karaktera. Layout po ICAO 9303 Part 4:
 *
 * Linija 1: "P<" + zemlja izdavanja(3) + polje imena(39)
 * Linija 2: broj dokumenta(9) + CD + nacionalnost(3) + rođenje(6) + CD
 *           + pol(1) + istek(6) + CD + lični broj(14) + CD + kompozitni CD
 *
 * Kompozitni check-digit se računa nad: broj dokumenta+CD (10) + datum
 * rođenja+CD (7) + datum isteka+CD+lični broj+CD (22) = 39 karaktera.
 */
export function generateTD3(identity: SyntheticIdentity): MRZResult {
  const documentCode = "P<";
  const issuingCountry = identity.nationality;
  const nameField = buildNameField(
    identity.lastName,
    identity.firstName,
    LINE_LENGTH - documentCode.length - issuingCountry.length,
  );
  const line1 = documentCode + issuingCountry + nameField;

  const documentNumber = padField(identity.documentNumber, 9);
  const documentNumberCheck = checkDigitChar(documentNumber);
  const nationality = identity.nationality;
  const birthDate = formatMRZDate(identity.birthDate);
  const birthDateCheck = checkDigitChar(birthDate);
  const expiryDate = formatMRZDate(identity.expiryDate);
  const expiryDateCheck = checkDigitChar(expiryDate);
  const personalNumberCheck = checkDigitChar(PERSONAL_NUMBER);

  const compositeInput =
    documentNumber + documentNumberCheck + birthDate + birthDateCheck + expiryDate + expiryDateCheck + PERSONAL_NUMBER + personalNumberCheck;
  const compositeCheck = checkDigitChar(compositeInput);

  const line2 = [
    documentNumber,
    documentNumberCheck,
    nationality,
    birthDate,
    birthDateCheck,
    identity.sex,
    expiryDate,
    expiryDateCheck,
    PERSONAL_NUMBER,
    personalNumberCheck,
    compositeCheck,
  ].join("");

  return { lines: [line1, line2] };
}
