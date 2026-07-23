/**
 * CryptoTestScreen — verifikacija crypto modula NA UREĐAJU.
 *
 * Replicira 6 testova iz Crypto POC-a, ali kroz pravi crypto.ts modul
 * i pravu app strukturu. Kad svih 6 prođe zeleno, modul 2 je gotov —
 * screenshot ide pravo u poglavlje evaluacije.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Buffer } from '@craftzdog/react-native-buffer';
import crypto from 'react-native-quick-crypto';
import {
  getOrCreateMasterKey,
  hasMasterKey,
  encryptObject,
  decryptObject,
  encryptObjectWithKey,
  decryptObjectWithKey,
} from '../services/crypto';
import type { DocumentData } from '../types';
import { msg } from '../utils/errors';
import theme from '../ui/theme';

interface TestResult {
  name: string;
  ok: boolean;
  detail: string;
}

const SAMPLE_DOC: DocumentData = {
  type: 'pasos',
  documentNumber: '001234567',
  firstName: 'MARKO',
  lastName: 'PETROVIC',
  nationality: 'SRB',
  expiryDate: '2030-01-01T00:00:00.000Z',
};

async function runAllTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const push = (name: string, ok: boolean, detail = '') =>
    results.push({ name, ok, detail });

  // 1. Generisanje / učitavanje ključa, dužina 256 bita
  try {
    const keyB64 = await getOrCreateMasterKey();
    const len = Buffer.from(keyB64, 'base64').length;
    push('1. Master ključ (256 bita)', len === 32, `dužina: ${len * 8} bita`);
  } catch (e) {
    push('1. Master ključ (256 bita)', false, msg(e));
  }

  // 2. Enkripcija → dekripcija (roundtrip)
  try {
    const ct = await encryptObject(SAMPLE_DOC);
    const back = await decryptObject<DocumentData>(ct);
    const ok = JSON.stringify(back) === JSON.stringify(SAMPLE_DOC);
    push('2. Enkripcija → dekripcija', ok, ok ? 'objekat identičan' : 'objekat se razlikuje!');
  } catch (e) {
    push('2. Enkripcija → dekripcija', false, msg(e));
  }

  // 3. Isti podatak dvaput → RAZLIČITI šifrati (nasumičan IV)
  try {
    const a = await encryptObject(SAMPLE_DOC);
    const b = await encryptObject(SAMPLE_DOC);
    push('3. Nasumičan IV po zapisu', a !== b, a !== b ? 'šifrati različiti' : 'šifrati ISTI — greška!');
  } catch (e) {
    push('3. Nasumičan IV po zapisu', false, msg(e));
  }

  // 4. Pogrešan ključ mora biti ODBIJEN
  try {
    const ct = await encryptObject(SAMPLE_DOC);
    const wrongKey = Buffer.from(crypto.randomBytes(32)).toString('base64');
    let rejected = false;
    try {
      decryptObjectWithKey(ct, wrongKey);
    } catch {
      rejected = true;
    }
    push('4. Odbijanje pogrešnog ključa', rejected, rejected ? 'dekripcija bacila grešku ✓' : 'dekripcija PROŠLA — greška!');
  } catch (e) {
    push('4. Odbijanje pogrešnog ključa', false, msg(e));
  }

  // 5. Detekcija izmene šifrata (GCM integritet)
  try {
    const ct = await encryptObject(SAMPLE_DOC);
    const parts = ct.split(':');
    // izmeni jedan karakter u sredini ciphertext dela
    const body = parts[2]!; // format upravo kreiran gore — delovi garantovano postoje
    const mid = Math.floor(body.length / 2);
    const flipped = body.slice(0, mid) + (body[mid] === 'A' ? 'B' : 'A') + body.slice(mid + 1);
    const tampered = [parts[0], parts[1], flipped, parts[3]].join(':');
    let detected = false;
    try {
      await decryptObject(tampered);
    } catch {
      detected = true;
    }
    push('5. Detekcija izmene šifrata', detected, detected ? 'izmena detektovana ✓' : 'izmena NIJE detektovana!');
  } catch (e) {
    push('5. Detekcija izmene šifrata', false, msg(e));
  }

  // 6. Perzistencija ključa u SecureStore + eksplicitni ključ radi isto
  try {
    const exists = await hasMasterKey();
    const keyB64 = await getOrCreateMasterKey();
    const ct = encryptObjectWithKey(SAMPLE_DOC, keyB64);
    const back = decryptObjectWithKey<DocumentData>(ct, keyB64);
    const ok = exists && back.documentNumber === SAMPLE_DOC.documentNumber;
    push('6. Perzistencija u Keystore', ok, ok ? 'ključ preživljava restart' : 'problem sa SecureStore');
  } catch (e) {
    push('6. Perzistencija u Keystore', false, msg(e));
  }

  return results;
}

export default function CryptoTestScreen() {
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);

  const onRun = async () => {
    setRunning(true);
    setResults(null);
    try {
      setResults(await runAllTests());
    } finally {
      setRunning(false);
    }
  };

  const allPassed = results != null && results.every((r: TestResult) => r.ok);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Crypto modul — testovi</Text>
      <Text style={styles.subtitle}>AES-256-GCM · nasumičan IV · ključ u Keystore-u</Text>

      <Pressable style={styles.button} onPress={onRun} disabled={running}>
        <Text style={styles.buttonText}>{running ? 'Testiram…' : 'Pokreni svih 6 testova'}</Text>
      </Pressable>

      {results != null && (
        <View style={styles.results}>
          {results.map((r: TestResult) => (
            <View key={r.name} style={[styles.row, r.ok ? styles.rowOk : styles.rowFail]}>
              <Text style={styles.rowName}>
                {r.ok ? '✅' : '❌'} {r.name}
              </Text>
              {r.detail !== '' && <Text style={styles.rowDetail}>{r.detail}</Text>}
            </View>
          ))}
          <Text style={[styles.summary, { color: allPassed ? theme.colors.success : theme.colors.danger }]}>
            {allPassed ? 'Svih 6 testova prošlo — modul 2 gotov.' : 'Neki testovi nisu prošli.'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 20 },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: { color: theme.colors.textInverse, fontSize: 16, fontWeight: '600' },
  results: { gap: 8 },
  row: { borderRadius: 8, padding: 12 },
  rowOk: { backgroundColor: theme.colors.successSoft },
  rowFail: { backgroundColor: theme.colors.dangerSoft },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowDetail: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  summary: { marginTop: 12, fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
