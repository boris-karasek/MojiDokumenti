/**
 * DatabaseTestScreen — privremena verifikacija repository sloja NA UREĐAJU.
 *
 * Cilj: ručno potvrditi da saveDocument/getAllDocuments/deleteDocument rade
 * na pravom expo-sqlite (Jest testovi to dokazuju na mock bazi, ovaj ekran
 * na pravom uređaju/emulatoru) i, što je najvažnije, da podaci PREŽIVE
 * restart app-a. Dugme "Učitaj postojeće" postoji baš zbog toga: prekinuti proces app,
 * pokrenuti ponovo, otvoriti ovaj ekran i pritisnuti SAMO njega (bez Save) —
 * ako se test dokumenti i dalje pojave, baza je perzistentna.
 *
 * Ovaj ekran nestaje kad modul 7 (lista/detalji) zameni HomeScreen hub.
 * Podaci su izmišljeni (TEST/TESTOVIC) — nikad prava lična imena.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { saveDocument, getAllDocuments, deleteDocument } from '../services/database';
import type { DecryptedDocument, DocumentData } from '../types';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Nov izmišljen test dokument svaki put — sufiks razlikuje zapise u listi. */
function makeTestDocument(): DocumentData {
  const suffix = Math.floor(Math.random() * 100000);
  return {
    type: 'licna_karta',
    documentNumber: `TEST${suffix}`,
    firstName: 'TEST',
    lastName: 'TESTOVIC',
    nationality: 'XXX',
    birthDate: '1990-01-01T00:00:00.000Z',
    expiryDate: '2031-01-01T00:00:00.000Z',
    createdAt: Date.now(),
  };
}

export default function DatabaseTestScreen() {
  const [documents, setDocuments] = useState<DecryptedDocument[] | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const runBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setStatus(`Greška: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const onSave = () =>
    runBusy(async () => {
      const doc = makeTestDocument();
      const id = await saveDocument(doc);
      setStatus(`Sačuvano: ${doc.documentNumber} (id=${id})`);
    });

  const onListAll = () =>
    runBusy(async () => {
      const all = await getAllDocuments();
      setDocuments(all);
      setStatus(`Izlistano ${all.length} dokument(a).`);
    });

  const onLoadExisting = () =>
    runBusy(async () => {
      const all = await getAllDocuments();
      setDocuments(all);
      setStatus(
        `Test perzistencije: učitano ${all.length} dokument(a) iz baze (bez prethodnog Save-a u ovoj sesiji ako je app upravo restartovan).`,
      );
    });

  const onDeleteAll = () =>
    runBusy(async () => {
      if (documents == null || documents.length === 0) {
        setStatus('Nema učitanih dokumenata za brisanje — prvo pritisni "Izlistaj sve".');
        return;
      }
      for (const doc of documents) {
        await deleteDocument(doc.id);
      }
      const count = documents.length;
      setDocuments([]);
      setStatus(`Obrisano ${count} dokument(a).`);
    });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Lokalna baza — test</Text>
      <Text style={styles.subtitle}>expo-sqlite · repository sloj · isključivo test podaci</Text>

      <Pressable style={styles.button} onPress={onSave} disabled={busy}>
        <Text style={styles.buttonText}>Sačuvaj test dokument</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={onListAll} disabled={busy}>
        <Text style={styles.buttonText}>Izlistaj sve</Text>
      </Pressable>

      <Pressable style={[styles.button, styles.buttonDanger]} onPress={onDeleteAll} disabled={busy}>
        <Text style={styles.buttonText}>Obriši sve</Text>
      </Pressable>

      <Pressable style={[styles.button, styles.buttonSecondary]} onPress={onLoadExisting} disabled={busy}>
        <Text style={styles.buttonText}>Učitaj postojeće (test restarta)</Text>
      </Pressable>

      {status !== '' && <Text style={styles.status}>{status}</Text>}

      {documents != null && (
        <View style={styles.results}>
          {documents.length === 0 ? (
            <Text style={styles.empty}>Baza je prazna.</Text>
          ) : (
            documents.map((d) => (
              <View key={d.id} style={styles.row}>
                <Text style={styles.rowName}>
                  {d.data.firstName} {d.data.lastName} · {d.data.documentNumber}
                </Text>
                <Text style={styles.rowDetail}>
                  {d.data.type} · ističe {d.data.expiryDate.slice(0, 10)} · id={d.id.slice(0, 8)}…
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 20 },
  button: {
    backgroundColor: '#1f4e79',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonSecondary: { backgroundColor: '#555' },
  buttonDanger: { backgroundColor: '#a33b2e' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  status: { marginTop: 10, marginBottom: 10, fontSize: 13, color: '#333' },
  results: { gap: 8, marginTop: 10 },
  empty: { fontSize: 14, color: '#777', textAlign: 'center' },
  row: { backgroundColor: '#f2f5f9', borderRadius: 8, padding: 12 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowDetail: { fontSize: 12, color: '#555', marginTop: 2 },
});
