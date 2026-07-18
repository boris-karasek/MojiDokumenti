import { checkDigitChar } from "./checkDigit.js";
import { formatMRZDate } from "./dates.js";
import { buildNameField, padField, type MRZResult } from "./fields.js";
import type { SyntheticIdentity } from "./identity.js";

const LINE_LENGTH = 44;

/**
 * TD3 (srpski pasoš) — 2 linije po 44 karaktera. Layout po ICAO 9303 Part 4:
 *
 * Linija 1: "P<SRB" + polje imena(39)
 * Linija 2: broj pasoša(9, numerički) + CD + "SRB" + rođenje(6) + CD
 *           + pol(1) + istek(6) + CD + JMBG(13) + "<" + CD + kompozitni CD
 *
 * Lični broj (personal number) polje je 14 karaktera po ICAO standardu —
 * ovde nosi JMBG (13 cifara) + jedan filler `<`.
 *
 * Kompozitni check-digit se računa nad: broj pasoša+CD (10) + datum
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
  const personalNumber = identity.jmbg + "<";
  const personalNumberCheck = checkDigitChar(personalNumber);

  const compositeInput =
    documentNumber + documentNumberCheck + birthDate + birthDateCheck + expiryDate + expiryDateCheck + personalNumber + personalNumberCheck;
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
    personalNumber,
    personalNumberCheck,
    compositeCheck,
  ].join("");

  return { lines: [line1, line2] };
}
