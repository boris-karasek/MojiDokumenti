/**
 * documentValidation.ts — čista validaciona logika za manuelni unos (modul 6).
 *
 * Odvojena od ManualEntryScreen.tsx da bude testabilna bez UI-ja/uređaja.
 * Ne baca izuzetke — vraća mapu grešaka po polju, ekran ih prikazuje uz
 * odgovarajuće polje umesto generičkog alert-a (v. CLAUDE.md, modul 6).
 */

import type { DocumentData, DocumentType } from '../types';

/** Sirov unos iz forme — datumi kao Date|null (DateTimePicker vraća Date). */
export interface ManualEntryInput {
  type: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  /** '' ako polje nije popunjeno — opciono polje u DocumentData. */
  nationality: string;
  birthDate: Date | null;
  expiryDate: Date | null;
}

export type ManualEntryField =
  | 'documentNumber'
  | 'firstName'
  | 'lastName'
  | 'birthDate'
  | 'expiryDate';

export type ManualEntryErrors = Partial<Record<ManualEntryField, string>>;

/**
 * Broj cifara koje se čuvaju za platnu karticu — poslednje 4, NIKAD pun broj.
 * Deljeno između validacije i ekrana (maxLength na input polju).
 */
export const CARD_NUMBER_DIGITS = 4;

/**
 * Proverava formu pre čuvanja. `now` je injektovan (podrazumevano trenutno
 * vreme) da bi test za "birthDate ne sme biti u budućnosti" bio determinisan
 * bez oslanjanja na sistemski sat u trenutku izvršavanja testa.
 */
export function validateManualEntry(
  input: ManualEntryInput,
  now: Date = new Date(),
): ManualEntryErrors {
  const errors: ManualEntryErrors = {};

  const documentNumber = input.documentNumber.trim();
  if (documentNumber === '') {
    errors.documentNumber = 'Broj dokumenta je obavezan.';
  } else if (input.type === 'platna_kartica' && !/^\d{4}$/.test(documentNumber)) {
    // Bezbednosna odluka (CLAUDE.md): za platnu karticu se čuvaju SAMO
    // poslednje 4 cifre, nikad pun broj — zato je regex tačno 4 cifre,
    // ne "broj nije prazan".
    errors.documentNumber = `Unesi tačno poslednje ${CARD_NUMBER_DIGITS} cifre kartice.`;
  }

  if (input.firstName.trim() === '') {
    errors.firstName = 'Ime je obavezno.';
  }

  if (input.lastName.trim() === '') {
    errors.lastName = 'Prezime je obavezno.';
  }

  if (input.birthDate != null && input.birthDate.getTime() > now.getTime()) {
    errors.birthDate = 'Datum rođenja ne sme biti u budućnosti.';
  }

  if (input.expiryDate == null || Number.isNaN(input.expiryDate.getTime())) {
    errors.expiryDate = 'Datum isteka je obavezan.';
  }

  return errors;
}

export function hasErrors(errors: ManualEntryErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Mapira validiran unos u DocumentData (types.ts) — isti oblik objekta koji
 * proizvodi ScanScreen, pa ide kroz isti saveDocument. Pozvati TEK nakon što
 * validateManualEntry vrati prazan objekat grešaka (expiryDate je garantovano
 * ispravan Date u tom slučaju).
 */
export function buildDocumentData(input: ManualEntryInput): DocumentData {
  const nationality = input.nationality.trim();
  return {
    type: input.type,
    documentNumber: input.documentNumber.trim(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    nationality: nationality === '' ? undefined : nationality,
    birthDate: input.birthDate != null ? input.birthDate.toISOString() : undefined,
    expiryDate: (input.expiryDate as Date).toISOString(),
    createdAt: Date.now(),
  };
}
