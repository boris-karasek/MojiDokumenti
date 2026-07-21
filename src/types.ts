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
 *
 * Politika minimizacije podataka: čuva se SAMO ono što aplikaciji
 * funkcionalno treba (podsetnici, prikaz) ili što korisnik svesno unese.
 * JMBG i datum rođenja se odbacuju na izvoru iako ih MRZ zona sadrži —
 * app ih nigde ne koristi (ni za notifikacije ni za prikaz hitnosti).
 * Broj platne kartice se čuva SAMO kao poslednje 4 cifre, nikad pun broj.
 * Vreme unosa (createdAt) NIJE deo ovog objekta — postoji već kao plain
 * kolona u bazi (StoredDocument/DecryptedDocument), pa ne postoji razlog
 * da ista vrednost uđe i u šifrat (v. CLAUDE.md, "Minimizacija podataka").
 */
export interface DocumentData {
  type: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  /** ISO 3166-1 alpha-3, npr. 'SRB' — opciono za dokumenta bez MRZ */
  nationality?: string;
  /** ISO 8601 string — ključno polje za podsetnike */
  expiryDate: string;
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

/** Red iz SQLite baze (`database.ts`) nakon dekripcije — ono sa čim UI radi. */
export interface DecryptedDocument {
  id: string;
  data: DocumentData;
  createdAt: number;
}
