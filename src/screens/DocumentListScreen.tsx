/**
 * DocumentListScreen — glavni ekran app-a: lista sačuvanih dokumenata (modul 7).
 *
 * Zamenjuje dosadašnji HomeScreen (razvojni hub) kao 'Home' ruta — ovo je
 * prva stvar koju korisnik vidi. Pristup Crypto testovima (evaluacija na
 * uređaju, v. CLAUDE.md) ostaje kao diskretna stavka na dnu ekrana.
 *
 * Osvežavanje koristi useFocusEffect (@react-navigation/native), NE
 * useEffect: povratak sa ScanScreen-a ili ManualEntryScreen-a (navigation.
 * navigate nazad) ne remontira ovaj ekran, pa običan useEffect ne bi
 * primetio novosačuvan dokument — naučena lekcija ovog modula.
 */

import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { msg } from '../utils/errors';

import { getAllDocuments } from '../services/database';
import { sortByExpiry, getExpiryStatus, type ExpiryStatus } from '../services/documentStatus';
import { DOCUMENT_TYPE_LABELS } from '../services/documentLabels';
import type { DecryptedDocument } from '../types';
import type { ScreenProps } from '../navigation';
import { STATUS_LABELS, STATUS_STYLES } from '../services/documentLabels';


function badgeText(status: ExpiryStatus, daysLeft: number): string {
  if (status === 'istekao') return `Istekao pre ${Math.abs(daysLeft)} d.`;
  if (status === 'istice_uskoro') return daysLeft === 0 ? 'Ističe danas' : `Ističe za ${daysLeft} d.`;
  return STATUS_LABELS.vazeci;
}

export default function DocumentListScreen({ navigation }: ScreenProps<'Home'>) {
  const [documents, setDocuments] = useState<DecryptedDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getAllDocuments()
        .then((all) => {
          if (!active) return;
          setDocuments(sortByExpiry(all));
          setError(null);
        })
        .catch((e: unknown) => {
          if (!active) return;
          setError(msg(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Moji dokumenti</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerButton} onPress={() => navigation.navigate('ScanDocument')}>
            <Text style={styles.headerButtonText}>📷 Skeniraj</Text>
          </Pressable>
          <Pressable style={styles.headerButton} onPress={() => navigation.navigate('ManualEntry')}>
            <Text style={styles.headerButtonText}>✍️ Unesi ručno</Text>
          </Pressable>
        </View>
      </View>

      {loading && documents == null && <ActivityIndicator style={styles.loading} size="large" />}

      {error != null && <Text style={styles.errorText}>Greška pri učitavanju: {error}</Text>}

      {documents != null && documents.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nemaš sačuvanih dokumenata.</Text>
          <Pressable style={styles.button} onPress={() => navigation.navigate('ScanDocument')}>
            <Text style={styles.buttonText}>Skeniraj</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => navigation.navigate('ManualEntry')}
          >
            <Text style={styles.buttonText}>Unesi ručno</Text>
          </Pressable>
        </View>
      )}

      {documents != null && documents.length > 0 && (
        <FlatList
          data={documents}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const { status, daysLeft } = getExpiryStatus(item.data.expiryDate);
            const badge = STATUS_STYLES[status];
            return (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('DocumentDetails', { documentId: item.id })}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowType}>{DOCUMENT_TYPE_LABELS[item.data.type]}</Text>
                  <Text style={styles.rowName}>
                    {item.data.firstName} {item.data.lastName}
                  </Text>
                  <Text style={styles.rowDate}>ističe {item.data.expiryDate.slice(0, 10)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>
                    {badgeText(status, daysLeft)}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable style={styles.evalLink} onPress={() => navigation.navigate('CryptoTest')}>
        <Text style={styles.evalLinkText}>🔐 Crypto testovi (evaluacija)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 32 },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: {
    backgroundColor: '#1f4e79',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  headerButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  loading: { marginTop: 40 },
  errorText: { color: '#a33b2e', paddingHorizontal: 20, marginBottom: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  emptyText: { fontSize: 15, color: '#666', marginBottom: 10 },
  button: {
    backgroundColor: '#1f4e79',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 200,
  },
  buttonSecondary: { backgroundColor: '#555' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  listContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  row: {
    backgroundColor: '#f2f5f9',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowMain: { flex: 1 },
  rowType: { fontSize: 12, fontWeight: '700', color: '#1f4e79', marginBottom: 2 },
  rowName: { fontSize: 16, fontWeight: '600', color: '#111' },
  rowDate: { fontSize: 12, color: '#666', marginTop: 2 },
  badge: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  evalLink: { padding: 16, alignItems: 'center' },
  evalLinkText: { color: '#888', fontSize: 12 },
});
