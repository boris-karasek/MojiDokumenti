/**
 * crypto.test.ts — unit testovi crypto modula, pokreću se na LAPTOPU.
 *
 * Pokretanje:  npm test
 *
 * Šta OVI testovi dokazuju: ispravnost logike (format, roundtrip, IV,
 * odbijanje pogrešnog ključa, GCM tamper detekcija, import validacija).
 * Šta NE dokazuju: ponašanje native implementacije na uređaju — za to
 * ostaje CryptoTestScreen. Oba sloja idu u poglavlje evaluacije.
 */

import {
  getOrCreateMasterKey,
  hasMasterKey,
  deleteMasterKey,
  importMasterKey,
  exportMasterKey,
  encryptObject,
  decryptObject,
  encryptObjectWithKey,
  decryptObjectWithKey,
} from '../crypto';
import type { DocumentData } from '../../types';
import { Buffer } from '@craftzdog/react-native-buffer';
import crypto from 'react-native-quick-crypto';

// mock expo-secure-store ima __reset() za čist start svakog testa
// eslint-disable-next-line @typescript-eslint/no-var-requires
const secureStoreMock = require('expo-secure-store') as { __reset: () => void };

const SAMPLE_DOC: DocumentData = {
  type: 'pasos',
  documentNumber: '001234567',
  firstName: 'MARKO',
  lastName: 'PETROVIC',
  nationality: 'SRB',
  expiryDate: '2030-01-01T00:00:00.000Z',
  createdAt: 1720000000000,
};

beforeEach(() => {
  secureStoreMock.__reset();
});

describe('master ključ', () => {
  test('1. generiše se 256-bitni ključ i perzistira', async () => {
    expect(await hasMasterKey()).toBe(false);

    const key = await getOrCreateMasterKey();
    expect(Buffer.from(key, 'base64').length).toBe(32); // 256 bita
    expect(await hasMasterKey()).toBe(true);

    // ponovni poziv vraća ISTI ključ, ne generiše nov
    expect(await getOrCreateMasterKey()).toBe(key);
  });

  test('import odbija ključ pogrešne dužine', async () => {
    const shortKey = Buffer.from(crypto.randomBytes(16)).toString('base64');
    await expect(importMasterKey(shortKey)).rejects.toThrow('Neispravan ključ');
  });

  test('import odbija prepisivanje postojećeg ključa bez force', async () => {
    await getOrCreateMasterKey();
    const newKey = Buffer.from(crypto.randomBytes(32)).toString('base64');

    await expect(importMasterKey(newKey)).rejects.toThrow('već postoji');

    await importMasterKey(newKey, { force: true }); // sa force prolazi
    expect(await exportMasterKey()).toBe(newKey);
  });

  test('brisanje ključa čini podatke nedostupnim', async () => {
    const ct = await encryptObject(SAMPLE_DOC);
    await deleteMasterKey();
    await expect(decryptObject(ct)).rejects.toThrow('ne postoji');
  });
});

describe('enkripcija / dekripcija', () => {
  test('2. roundtrip vraća identičan objekat', async () => {
    const ct = await encryptObject(SAMPLE_DOC);
    const back = await decryptObject<DocumentData>(ct);
    expect(back).toEqual(SAMPLE_DOC);
  });

  test('format šifrata je v1:iv:ct:tag sa ispravnim dužinama', async () => {
    const ct = await encryptObject(SAMPLE_DOC);
    const parts = ct.split(':');

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
    expect(Buffer.from(parts[1]!, 'base64').length).toBe(12); // IV
    expect(Buffer.from(parts[3]!, 'base64').length).toBe(16); // GCM tag
  });

  test('3. isti podatak dvaput → različiti šifrati (nasumičan IV)', async () => {
    const a = await encryptObject(SAMPLE_DOC);
    const b = await encryptObject(SAMPLE_DOC);
    expect(a).not.toBe(b);
    // ali oba se dešifruju u isti objekat
    expect(await decryptObject(a)).toEqual(await decryptObject(b));
  });

  test('4. pogrešan ključ se odbija', async () => {
    const ct = await encryptObject(SAMPLE_DOC);
    const wrongKey = Buffer.from(crypto.randomBytes(32)).toString('base64');
    expect(() => decryptObjectWithKey(ct, wrongKey)).toThrow();
  });

  test('5. izmena šifrata se detektuje (GCM integritet)', async () => {
    const ct = await encryptObject(SAMPLE_DOC);
    const parts = ct.split(':');
    const body = parts[2]!;
    const mid = Math.floor(body.length / 2);
    const flipped =
      body.slice(0, mid) + (body[mid] === 'A' ? 'B' : 'A') + body.slice(mid + 1);
    const tampered = [parts[0], parts[1], flipped, parts[3]].join(':');

    await expect(decryptObject(tampered)).rejects.toThrow();
  });

  test('izmena auth taga se takođe detektuje', async () => {
    const ct = await encryptObject(SAMPLE_DOC);
    const parts = ct.split(':');
    const tag = parts[3]!;
    const flippedTag =
      (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1);
    const tampered = [parts[0], parts[1], parts[2], flippedTag].join(':');

    await expect(decryptObject(tampered)).rejects.toThrow();
  });

  test('nepoznat format se odbija', async () => {
    await getOrCreateMasterKey();
    await expect(decryptObject('nije-sifrat')).rejects.toThrow('format');
    await expect(decryptObject('v9:a:b:c')).rejects.toThrow('format');
  });

  test('6. eksplicitni ključ — enkripcija na jednom "uređaju", dekripcija na drugom', async () => {
    // simulacija QR prenosa: uređaj A ima ključ, uređaj B ga importuje
    const keyA = await getOrCreateMasterKey();
    const ct = encryptObjectWithKey(SAMPLE_DOC, keyA);

    secureStoreMock.__reset(); // "uređaj B" — prazan Keystore
    await importMasterKey(keyA);

    const back = await decryptObject<DocumentData>(ct);
    expect(back.documentNumber).toBe(SAMPLE_DOC.documentNumber);
  });
});
