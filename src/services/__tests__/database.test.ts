/**
 * database.test.ts — unit testovi repository sloja, pokreću se na LAPTOPU.
 *
 * Pokretanje: npm test
 *
 * Baza je mockovana in-memory (__mocks__/expo-sqlite.js), master ključ
 * takođe (__mocks__/expo-secure-store.js) — isti princip kao crypto.test.ts.
 * Cilj ovih testova: dokazati da repository sloj NIKAD ne vraća/upisuje
 * plaintext, i da su save/get/getAll/delete operacije ispravne.
 */

import { saveDocument, getAllDocuments, getDocument, deleteDocument } from '../database';
import { openDatabaseAsync } from 'expo-sqlite';
import type { DocumentData } from '../../types';

interface DocumentRow {
  id: string;
  encrypted: string;
  createdAt: number;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const secureStoreMock = require('expo-secure-store') as { __reset: () => void };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqliteMock = require('expo-sqlite') as { __reset: () => void };

const SAMPLE_DOC: DocumentData = {
  type: 'pasos',
  documentNumber: '001234567',
  firstName: 'MARKO',
  lastName: 'PETROVIC',
  nationality: 'SRB',
  birthDate: '1985-01-01T00:00:00.000Z',
  expiryDate: '2030-01-01T00:00:00.000Z',
  createdAt: 1720000000000,
};

const OTHER_DOC: DocumentData = {
  type: 'licna_karta',
  documentNumber: '998877665',
  firstName: 'ANA',
  lastName: 'JOVANOVIC',
  expiryDate: '2028-06-01T00:00:00.000Z',
  createdAt: 1730000000000, // kasnije od SAMPLE_DOC
};

beforeEach(() => {
  secureStoreMock.__reset();
  sqliteMock.__reset();
});

describe('saveDocument / getDocument', () => {
  test('roundtrip vraća identičan DocumentData', async () => {
    const id = await saveDocument(SAMPLE_DOC);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    const doc = await getDocument(id);
    expect(doc).not.toBeNull();
    expect(doc!.id).toBe(id);
    expect(doc!.createdAt).toBe(SAMPLE_DOC.createdAt);
    expect(doc!.data).toEqual(SAMPLE_DOC);
  });

  test('nepostojeći id vraća null', async () => {
    expect(await getDocument('ne-postoji')).toBeNull();
  });
});

describe('getAllDocuments', () => {
  test('vraća sve dokumente sortirane po createdAt (najnoviji prvi)', async () => {
    const id1 = await saveDocument(SAMPLE_DOC); // stariji
    const id2 = await saveDocument(OTHER_DOC); // noviji

    const all = await getAllDocuments();
    expect(all).toHaveLength(2);
    expect(all[0]!.id).toBe(id2);
    expect(all[1]!.id).toBe(id1);
    expect(all[0]!.data).toEqual(OTHER_DOC);
    expect(all[1]!.data).toEqual(SAMPLE_DOC);
  });

  test('prazna baza vraća prazan niz', async () => {
    expect(await getAllDocuments()).toEqual([]);
  });

  test('preskače neispravan red umesto da obori ceo poziv', async () => {
    const goodId = await saveDocument(SAMPLE_DOC);

    // Direktan upis "pokvarenog" reda mimo repo sloja — simulira oštećen/
    // nepotpun zapis (npr. iz buduće migracije).
    const db = await openDatabaseAsync('mojidokumenti.db');
    await db.runAsync(
      'INSERT INTO documents (id, encrypted, createdAt) VALUES (?, ?, ?)',
      'losi-id',
      'v1:aaaa:bbbb:cccc', // nedekriptabilan šifrat (pogrešan format/ključ)
      Date.now(),
    );

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const all = await getAllDocuments();
    warnSpy.mockRestore();

    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(goodId);
  });
});

describe('deleteDocument', () => {
  test('briše dokument, ostali ostaju', async () => {
    const id1 = await saveDocument(SAMPLE_DOC);
    const id2 = await saveDocument(OTHER_DOC);

    await deleteDocument(id1);

    expect(await getDocument(id1)).toBeNull();
    const all = await getAllDocuments();
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(id2);
  });

  test('brisanje nepostojećeg id-ja ne baca grešku', async () => {
    await expect(deleteDocument('ne-postoji')).resolves.toBeUndefined();
  });
});

describe('šifrovanje u bazi', () => {
  test('kolona encrypted je v1:iv:ct:tag format, ne plaintext', async () => {
    const id = await saveDocument(SAMPLE_DOC);

    const db = await openDatabaseAsync('mojidokumenti.db');
    const row = await db.getFirstAsync<DocumentRow>(
      'SELECT id, encrypted, createdAt FROM documents WHERE id = ?',
      id,
    );

    expect(row).not.toBeNull();
    const parts = row!.encrypted.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');

    // Ni jedno osetljivo polje ne sme se pojaviti kao plain tekst u šifratu.
    expect(row!.encrypted).not.toContain(SAMPLE_DOC.documentNumber);
    expect(row!.encrypted).not.toContain(SAMPLE_DOC.firstName);
    expect(row!.encrypted).not.toContain(SAMPLE_DOC.lastName);
  });
});
