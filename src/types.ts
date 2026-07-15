/**
 * types.ts — centralni model podataka MojiDokumenti aplikacije.
 *
 * Ovo je JEDINO mesto gde je definisano šta je "dokument".
 * Svi moduli (MRZ parser, crypto, baza, UI) uvoze tipove odavde,
 * pa se svaka izmena modela širi kroz kompajler, a ne kroz runtime greške.
 */

// ---------------------------------------------------------------- dokumenti

/** Vrste dokumenata koje aplikacija prati. */
export type DocumentType =
  | 'pasos'
  | 'licna_karta'
  | 'vozacka'
  | 'oruzni_list'
  | 'platna_kartica'
  | 'ostalo';

/**
 * Strukturirani podaci JEDNOG dokumenta — tačno ono što se šifruje.
 * VAŽNO: datumi su ISO stringovi, ne Date objekti!
 * (JSON.parse ne vraća Date — naučena lekcija iz POC faze.)
 */
export interface DocumentData {
  type: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  /** ISO 3166-1 alpha-3, npr. 'SRB' — opciono za dokumenta bez MRZ */
  nationality?: string;
  /** ISO 8601 string, npr. '1985-01-01T00:00:00.000Z' */
  birthDate?: string;
  /** ISO 8601 string — ključno polje za podsetnike */
  expiryDate: string;
  /** epoch ms */
  createdAt: number;
}

// ------------------------------------------------------------- kriptografija

/**
 * "Branded" tip: u runtime-u običan string, ali ga kompajler razlikuje
 * od svih ostalih stringova. Time je NEMOGUĆE slučajno:
 *  - upisati nešifrovan string u bazu (baza prima samo EncryptedString),
 *  - prikazati šifrat u UI-ju gde se očekuje plain podatak.
 * Jedini način da nastane EncryptedString je kroz encryptObject().
 */
export type EncryptedString = string & { readonly __brand: 'EncryptedString' };

// ------------------------------------------------------------------- storage

/** Red u lokalnoj bazi / dokument u Firestore-u. Osetljivo je SAMO u `encrypted`. */
export interface StoredDocument {
  /** UUID generisan pri kreiranju */
  id: string;
  /** svi DocumentData podaci, šifrovani — jedini sadržajni deo zapisa */
  encrypted: EncryptedString;
  /** epoch ms — plain, nije osetljivo, služi za sortiranje/sync */
  createdAt: number;
  /** Firebase Auth UID — plain, potreban za Firestore security rules */
  userId?: string;
}

/** StoredDocument nakon dekripcije — ono sa čim UI radi. */
export interface DecryptedDocument {
  id: string;
  data: DocumentData;
  createdAt: number;
}
