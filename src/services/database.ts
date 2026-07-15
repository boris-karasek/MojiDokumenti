/**
 * database.ts — repository sloj nad lokalnom bazom (expo-sqlite)
 *
 * Odgovornost: spojiti crypto.ts i SQLite tako da NIGDE drugde u aplikaciji
 * ne postoji ni SQL upit ni pristup šifratu. Ovaj modul je JEDINO mesto koje
 * zna da baza čuva `encrypted` kolonu — pozivaoci vide samo DocumentData /
 * DecryptedDocument (types.ts).
 *
 * Kolona `encrypted` je uvek EncryptedString (nastao u crypto.ts). Dekripcija
 * se dešava SAMO ovde, tik pre vraćanja podataka pozivaocu.
 */

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import crypto from 'react-native-quick-crypto';
import { decryptObject, encryptObject } from './crypto';
import type { DecryptedDocument, DocumentData, DocumentType } from '../types';

const DB_NAME = 'mojidokumenti.db';

const DOCUMENT_TYPES: readonly DocumentType[] = [
  'pasos',
  'licna_karta',
  'vozacka',
  'oruzni_list',
  'platna_kartica',
  'ostalo',
];

/** Red kakav fizički postoji u SQLite tabeli `documents`. */
interface DocumentRow {
  id: string;
  encrypted: string;
  createdAt: number;
}

// Baza se otvara i tabela kreira samo jednom po životu procesa.
let dbPromise: Promise<SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLiteDatabase> {
  if (dbPromise == null) {
    dbPromise = initDatabase();
  }
  return dbPromise;
}

async function initDatabase(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DB_NAME);
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS documents (
       id TEXT PRIMARY KEY NOT NULL,
       encrypted TEXT NOT NULL,
       createdAt INTEGER NOT NULL
     );`,
  );
  return db;
}

// ------------------------------------------------------------- validacija

/**
 * decryptObject vraća `unknown` u praksi (JSON.parse nije proveren) — pre
 * nego što dekriptovan sadržaj napusti ovaj modul kao DocumentData, moramo
 * proveriti da ima očekivana polja. Bez ovoga bi neispravan/oštećen zapis
 * (npr. iz buduće migracije) mogao proći kroz sistem kao validan dokument.
 */
function isDocumentData(value: unknown): value is DocumentData {
  if (typeof value !== 'object' || value == null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === 'string' &&
    (DOCUMENT_TYPES as string[]).includes(v.type) &&
    typeof v.documentNumber === 'string' &&
    typeof v.firstName === 'string' &&
    typeof v.lastName === 'string' &&
    typeof v.expiryDate === 'string' &&
    typeof v.createdAt === 'number' &&
    (v.nationality === undefined || typeof v.nationality === 'string') &&
    (v.birthDate === undefined || typeof v.birthDate === 'string')
  );
}

async function decryptRow(row: DocumentRow): Promise<DecryptedDocument> {
  const decrypted = await decryptObject<unknown>(row.encrypted);
  if (!isDocumentData(decrypted)) {
    throw new Error(`Neispravan sadržaj dekriptovanog dokumenta (id=${row.id}).`);
  }
  return { id: row.id, data: decrypted, createdAt: row.createdAt };
}

// --------------------------------------------------------------- repository

/** Enkriptuje dokument i upisuje ga u bazu. Vraća generisani id. */
export async function saveDocument(data: DocumentData): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const encrypted = await encryptObject(data);

  await db.runAsync(
    'INSERT INTO documents (id, encrypted, createdAt) VALUES (?, ?, ?)',
    id,
    encrypted,
    data.createdAt,
  );
  return id;
}

/**
 * Vraća sve dokumente, dekriptovane, sortirane po createdAt (najnoviji prvi).
 * Neispravan/oštećen red se preskače (uz upozorenje u konzoli) umesto da
 * obori ceo poziv — jedan loš zapis ne sme da učini ostale nedostupnim.
 */
export async function getAllDocuments(): Promise<DecryptedDocument[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DocumentRow>(
    'SELECT id, encrypted, createdAt FROM documents ORDER BY createdAt DESC',
  );

  const results: DecryptedDocument[] = [];
  for (const row of rows) {
    try {
      results.push(await decryptRow(row));
    } catch (err) {
      console.warn(`[database] Preskačem neispravan zapis id=${row.id}:`, err);
    }
  }
  return results;
}

/** Vraća jedan dokument po id-ju, ili null ako ne postoji. */
export async function getDocument(id: string): Promise<DecryptedDocument | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DocumentRow>(
    'SELECT id, encrypted, createdAt FROM documents WHERE id = ?',
    id,
  );
  if (row == null) return null;
  return decryptRow(row);
}

/** Briše dokument po id-ju. Ne baca grešku ako id ne postoji. */
export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM documents WHERE id = ?', id);
}
