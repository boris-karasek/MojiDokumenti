/**
 * DocumentDetailScreen — prikaz svih polja jednog dokumenta (modul 7).
 *
 * Učitava dokument preko getDocument(id) — dešifrovanje se dešava u
 * database.ts, ovaj ekran vidi samo DecryptedDocument. Osvežava se pri
 * svakom fokusiranju (useFocusEffect), ne samo pri montiranju: povratak sa
 * izmene (ManualEntryScreen) mora da pokaže sveže vrednosti bez remontiranja
 * celog stack-a (ista lekcija kao DocumentListScreen).
 *
 * nationality se prikazuje SAMO ako je postavljena — polje je opciono
 * (dokumenti bez MRZ zone ga često nemaju), ali kad postoji MORA biti
 * vidljivo: to je jedini razlog zašto je polje preživelo reviziju
 * minimizacije podataka (v. CLAUDE.md).
 */

import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { msg } from '../utils/errors';

import { getDocument, deleteDocument } from '../services/database';
import { getExpiryStatus, type ExpiryStatus } from '../services/documentStatus';
import { DOCUMENT_TYPE_LABELS } from '../services/documentLabels';
import type { DecryptedDocument } from '../types';
import type { ScreenProps } from '../navigation';


const STATUS_LABELS: Record<ExpiryStatus, string> = {
  istekao: 'Istekao',
  istice_uskoro: 'Ističe uskoro',
  vazeci: 'Važeći',
};

const STATUS_STYLES: Record<ExpiryStatus, { bg: string; text: string }> = {
  istekao: { bg: '#fdecea', text: '#a33b2e' },
  istice_uskoro: { bg: '#fff4e0', text: '#b8720a' },
  vazeci: { bg: '#e6f4ea', text: '#2e7d32' },
};

export default function DocumentDetailScreen({ navigation, route }: ScreenProps<'DocumentDetails'>) {
  const { documentId } = route.params;

  const [doc, setDoc] = useState<DecryptedDocument | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDocument(documentId)
        .then((d) => {
          if (active) setDoc(d);
        })
        .catch((e: unknown) => {
          if (active) setError(msg(e));
        });
      return () => {
        active = false;
      };
    }, [documentId]),
  );

  const handleDelete = useCallback(() => {
    Alert.alert('Obrisati dokument?', 'Ova radnja je nepovratna.', [
      { text: 'Otkaži', style: 'cancel' },
      {
        text: 'Obriši',
        style: 'destructive',
        onPress: () => {
          deleteDocument(documentId)
            .then(() => navigation.goBack())
            .catch((e: unknown) => setError(msg(e)));
        },
      },
    ]);
  }, [documentId, navigation]);

  if (error != null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Greška: {error}</Text>
      </View>
    );
  }

  if (doc === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (doc === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Dokument nije pronađen (možda je već obrisan).</Text>
      </View>
    );
  }

  const { status, daysLeft } = getExpiryStatus(doc.data.expiryDate);
  const badge = STATUS_STYLES[status];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.badgeText, { color: badge.text }]}>
          {STATUS_LABELS[status]}
          {status !== 'vazeci' ? ` · ${Math.abs(daysLeft)} d.` : ''}
        </Text>
      </View>

      <Field label="Tip dokumenta" value={DOCUMENT_TYPE_LABELS[doc.data.type]} />
      <Field label="Ime" value={doc.data.firstName} />
      <Field label="Prezime" value={doc.data.lastName} />
      <Field label="Broj dokumenta" value={doc.data.documentNumber} />
      {doc.data.nationality != null && (
        <Field label="Državljanstvo" value={doc.data.nationality} />
      )}
      <Field label="Datum isteka" value={doc.data.expiryDate.slice(0, 10)} />

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('ManualEntry', { documentId: doc.id })}
      >
        <Text style={styles.buttonText}>Izmeni</Text>
      </Pressable>

      <Pressable style={[styles.button, styles.buttonDanger]} onPress={handleDelete}>
        <Text style={styles.buttonText}>Obriši</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  errorText: { color: '#a33b2e', fontSize: 14, textAlign: 'center' },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 20 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: '#666', marginBottom: 4, fontWeight: '600' },
  fieldValue: { fontSize: 16, color: '#111' },
  button: {
    backgroundColor: '#1f4e79',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDanger: { backgroundColor: '#a33b2e' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
