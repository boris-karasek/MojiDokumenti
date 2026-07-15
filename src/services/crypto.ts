/**
 * crypto.ts — srž MojiDokumenti aplikacije
 *
 * Odgovornosti:
 *  1. Master ključ: 256 nasumičnih bita, generisan na uređaju,
 *     čuvan u iOS Keychain / Android Keystore preko expo-secure-store.
 *     Ključ NIKAD ne napušta uređaj (izuzetak: eksplicitni QR export, modul 10).
 *  2. Enkripcija/dekripcija objekata: AES-256-GCM sa novim nasumičnim
 *     IV-om (12 B) za svaki zapis. GCM auth tag garantuje integritet —
 *     dekripcija BACA GREŠKU ako je šifrat izmenjen ili ključ pogrešan.
 *
 * Format šifrata (string koji ide u SQLite/Firestore):
 *     "v1:<base64 IV>:<base64 ciphertext>:<base64 authTag>"
 * Prefiks "v1" omogućava buduću migraciju formata bez lomljenja starih zapisa.
 *
 * TS napomena: encryptObject vraća EncryptedString (branded tip iz types.ts).
 * Ovo je JEDINO mesto u aplikaciji gde EncryptedString nastaje — kompajler
 * time garantuje da u bazu ne može ući nešifrovan podatak.
 */

import crypto from 'react-native-quick-crypto';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from '@craftzdog/react-native-buffer';
import type { EncryptedString } from '../types';

// ------------------------------------------------------------------ konstante

const KEY_ALIAS = 'mojidokumenti_master_key_v1'; // ime pod kojim ključ živi u Keystore-u
const KEY_BYTES = 32; // 256 bita
const IV_BYTES = 12; // preporučeno za GCM
const CIPHER_ALG = 'aes-256-gcm';
const FORMAT_VERSION = 'v1';

/** Base64 reprezentacija 256-bitnog master ključa (interni tip). */
export type MasterKeyB64 = string;

// ------------------------------------------------------ upravljanje ključem

/** Da li master ključ postoji na ovom uređaju? */
export async function hasMasterKey(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(KEY_ALIAS);
  return stored != null;
}

/**
 * Vrati postojeći master ključ, ili generiši nov ako ne postoji.
 * Poziva se pri startu app-a.
 */
export async function getOrCreateMasterKey(): Promise<MasterKeyB64> {
  const existing = await SecureStore.getItemAsync(KEY_ALIAS);
  if (existing != null) return existing;

  // crypto.randomBytes = kriptografski CSPRNG (ne Math.random!)
  const keyB64 = Buffer.from(crypto.randomBytes(KEY_BYTES)).toString('base64');

  await SecureStore.setItemAsync(KEY_ALIAS, keyB64, {
    // Ključ dostupan samo kad je uređaj otključan; ne ide u cloud backup
    // (za multi-device koristimo QR prenos, ne backup).
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return keyB64;
}

/**
 * Eksport ključa — koristi se SAMO za QR prenos na drugi uređaj (modul 10).
 */
export async function exportMasterKey(): Promise<MasterKeyB64 | null> {
  return SecureStore.getItemAsync(KEY_ALIAS);
}

/**
 * Import ključa sa drugog uređaja (QR skeniranje na uređaju B).
 * Odbija upis preko postojećeg ključa osim uz force=true,
 * da korisnik slučajno ne izgubi pristup već šifrovanim podacima.
 */
export async function importMasterKey(
  keyB64: MasterKeyB64,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  const buf = Buffer.from(keyB64, 'base64');
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `Neispravan ključ: očekivano ${KEY_BYTES} bajtova, dobijeno ${buf.length}`,
    );
  }
  if (!force && (await hasMasterKey())) {
    throw new Error(
      'Master ključ već postoji na ovom uređaju. Prosledi force=true za zamenu.',
    );
  }
  await SecureStore.setItemAsync(KEY_ALIAS, keyB64, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/** Brisanje ključa — samo za razvoj/testiranje! Podaci postaju nepovratni. */
export async function deleteMasterKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ALIAS);
}

// -------------------------------------------------- enkripcija / dekripcija

/**
 * Šifruje bilo koji JSON-serijalizabilan objekat master ključem uređaja.
 * @returns "v1:iv:ct:tag" — spremno za SQLite/Firestore.
 */
export async function encryptObject(obj: unknown): Promise<EncryptedString> {
  const keyB64 = await getOrCreateMasterKey();
  return encryptObjectWithKey(obj, keyB64);
}

/**
 * Dešifruje string nastao u encryptObject.
 * Baca grešku ako je šifrat izmenjen ili ključ pogrešan (GCM integritet).
 *
 * Generički parametar T je tip koji POZIVALAC očekuje (npr. DocumentData) —
 * runtime ga ne proverava (JSON.parse), pa dekriptovane podatke iz
 * nepoznatih izvora treba validirati u repository sloju.
 */
export async function decryptObject<T = unknown>(
  cipherString: EncryptedString | string,
): Promise<T> {
  const keyB64 = await SecureStore.getItemAsync(KEY_ALIAS);
  if (keyB64 == null) throw new Error('Master ključ ne postoji na ovom uređaju.');
  return decryptObjectWithKey<T>(cipherString, keyB64);
}

// Varijante sa eksplicitnim ključem — koriste se u testovima
// (test pogrešnog ključa) i pri QR prenosu.

export function encryptObjectWithKey(
  obj: unknown,
  keyB64: MasterKeyB64,
): EncryptedString {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== KEY_BYTES) throw new Error('Neispravna dužina ključa.');

  const iv = Buffer.from(crypto.randomBytes(IV_BYTES)); // NOV IV za svaki zapis
  const cipher = crypto.createCipheriv(CIPHER_ALG, key, iv);

  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = Buffer.from(cipher.getAuthTag());

  const out = [
    FORMAT_VERSION,
    iv.toString('base64'),
    ciphertext.toString('base64'),
    authTag.toString('base64'),
  ].join(':');

  // Jedino mesto u aplikaciji gde nastaje EncryptedString:
  return out as EncryptedString;
}

export function decryptObjectWithKey<T = unknown>(
  cipherString: EncryptedString | string,
  keyB64: MasterKeyB64,
): T {
  const parts = String(cipherString).split(':');
  const [version, ivB64, ctB64, tagB64] = parts;
  if (
    parts.length !== 4 ||
    version !== FORMAT_VERSION ||
    ivB64 == null || ctB64 == null || tagB64 == null
  ) {
    throw new Error('Nepoznat format šifrata.');
  }

  const key = Buffer.from(keyB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');

  const decipher = crypto.createDecipheriv(CIPHER_ALG, key, iv);
  decipher.setAuthTag(authTag); // ovde GCM proverava integritet

  // .final() baca grešku ako tag ne odgovara (izmenjen šifrat / pogrešan ključ)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}
