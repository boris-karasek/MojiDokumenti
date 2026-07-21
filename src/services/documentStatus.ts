/**
 * documentStatus.ts — status hitnosti dokumenta na osnovu datuma isteka.
 *
 * Izdvojeno iz UI-ja jer isti prag (DANI_UPOZORENJA) koristi i modul 8
 * (lokalne notifikacije) — broj dana ne sme da postoji na dva mesta u kodu.
 */

import type { DecryptedDocument } from '../types';

/** Prag (u danima) ispod kog dokument prelazi u "ističe uskoro". */
export const DANI_UPOZORENJA = 30;

export type ExpiryStatus = 'istekao' | 'istice_uskoro' | 'vazeci';

/** Ponoć lokalnog vremena za dati datum — osnova za poređenje po CELIM danima. */
function pocetakDana(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Status i broj preostalih dana do isteka dokumenta.
 *
 * Poređenje je po danima, ne po milisekundama: i expiryDate i "sada" se
 * normalizuju na ponoć lokalnog vremena pre oduzimanja. Bez ovoga bi npr.
 * dokument koji ističe "danas u 00:00" ispao istekao za nekog ko proverava
 * u 09:00 (razlika manja od 24h, ali je ipak isti dan) — test pokrenut u
 * različito doba dana bi davao različit rezultat.
 *
 * Dokument koji ističe DANAS se smatra još važećim (daysLeft = 0) — tek
 * sutradan postaje istekao (daysLeft < 0).
 *
 * @param now opciono "trenutno vreme" — isključivo radi determinističkih
 *   testova (ne koristiti jest.useFakeTimers, prosleđivati eksplicitan Date).
 */
export function getExpiryStatus(
  expiryDate: string,
  now: Date = new Date(),
): { status: ExpiryStatus; daysLeft: number } {
  const danas = pocetakDana(now);
  const istice = pocetakDana(new Date(expiryDate));

  const MS_PO_DANU = 24 * 60 * 60 * 1000;
  const daysLeft = Math.round((istice.getTime() - danas.getTime()) / MS_PO_DANU);

  let status: ExpiryStatus;
  if (daysLeft < 0) {
    status = 'istekao';
  } else if (daysLeft <= DANI_UPOZORENJA) {
    status = 'istice_uskoro';
  } else {
    status = 'vazeci';
  }

  return { status, daysLeft };
}

/** Sortira dokumente od najhitnijeg (najmanji daysLeft, istekli na vrh). */
export function sortByExpiry(docs: DecryptedDocument[]): DecryptedDocument[] {
  return [...docs].sort(
    (a, b) =>
      getExpiryStatus(a.data.expiryDate).daysLeft -
      getExpiryStatus(b.data.expiryDate).daysLeft,
  );
}
