/**
 * documentStatus.test.ts — unit testovi statusa hitnosti (modul 7).
 *
 * `now` se uvek prosleđuje eksplicitno (v. documentStatus.ts) — bez
 * jest.useFakeTimers(), radi determinizma i čitljivosti test slučajeva.
 */

import { getExpiryStatus, sortByExpiry, DANI_UPOZORENJA } from '../documentStatus';
import type { DecryptedDocument } from '../../types';

const NOW = new Date(2026, 6, 21); // 2026-07-21, lokalna ponoć

function isoNDaysFrom(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return d.toISOString();
}

describe('getExpiryStatus', () => {
  test('istekao juče → istekao, daysLeft = -1', () => {
    const result = getExpiryStatus(isoNDaysFrom(NOW, -1), NOW);
    expect(result.status).toBe('istekao');
    expect(result.daysLeft).toBe(-1);
  });

  test('ističe danas → još vazeci (istice_uskoro), daysLeft = 0', () => {
    const result = getExpiryStatus(isoNDaysFrom(NOW, 0), NOW);
    expect(result.status).toBe('istice_uskoro');
    expect(result.daysLeft).toBe(0);
  });

  test('ističe sutra → istice_uskoro, daysLeft = 1', () => {
    const result = getExpiryStatus(isoNDaysFrom(NOW, 1), NOW);
    expect(result.status).toBe('istice_uskoro');
    expect(result.daysLeft).toBe(1);
  });

  test(`na tačno ${DANI_UPOZORENJA} dana → istice_uskoro (granica uključena)`, () => {
    const result = getExpiryStatus(isoNDaysFrom(NOW, DANI_UPOZORENJA), NOW);
    expect(result.status).toBe('istice_uskoro');
    expect(result.daysLeft).toBe(DANI_UPOZORENJA);
  });

  test(`na ${DANI_UPOZORENJA + 1} dan → vazeci`, () => {
    const result = getExpiryStatus(isoNDaysFrom(NOW, DANI_UPOZORENJA + 1), NOW);
    expect(result.status).toBe('vazeci');
    expect(result.daysLeft).toBe(DANI_UPOZORENJA + 1);
  });

  test('daleko u budućnosti → vazeci', () => {
    const result = getExpiryStatus(isoNDaysFrom(NOW, 3650), NOW);
    expect(result.status).toBe('vazeci');
    expect(result.daysLeft).toBe(3650);
  });
});

function makeDoc(id: string, expiryDate: string): DecryptedDocument {
  return {
    id,
    createdAt: 0,
    data: {
      type: 'licna_karta',
      documentNumber: '000000000',
      firstName: 'MARKO',
      lastName: 'PETROVIC',
      expiryDate,
    },
  };
}

describe('sortByExpiry', () => {
  test('uobičajen slučaj — najhitniji (istekli) prvi', () => {
    const daleko = makeDoc('daleko', isoNDaysFrom(NOW, 400));
    const uskoro = makeDoc('uskoro', isoNDaysFrom(NOW, 10));
    const istekao = makeDoc('istekao', isoNDaysFrom(NOW, -5));

    const sorted = sortByExpiry([daleko, uskoro, istekao]);
    expect(sorted.map((d) => d.id)).toEqual(['istekao', 'uskoro', 'daleko']);
  });

  test('prazna lista', () => {
    expect(sortByExpiry([])).toEqual([]);
  });

  test('dva dokumenta sa istim datumom — oba ostaju, redosled stabilan po ulazu', () => {
    const a = makeDoc('a', isoNDaysFrom(NOW, 5));
    const b = makeDoc('b', isoNDaysFrom(NOW, 5));

    const sorted = sortByExpiry([a, b]);
    expect(sorted).toHaveLength(2);
    expect(sorted.map((d) => d.id).sort()).toEqual(['a', 'b']);
  });
});
