/**
 * HomeScreen — privremeni "hub" tokom razvoja.
 * Svaki završen modul dobija svoje dugme ovde; na kraju ovaj ekran
 * postaje prava lista dokumenata (modul 7).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ScreenProps, RootStackParamList } from '../navigation';

interface ModuleEntry {
  title: string;
  route: keyof RootStackParamList | null;
  ready: boolean;
}

const MODULES: ModuleEntry[] = [
  { title: '🔐 Crypto testovi (modul 2)', route: 'CryptoTest', ready: true },
  { title: '🗄️ Lokalna baza (modul 3)', route: 'DatabaseTest', ready: true },
  { title: '🧬 MRZ generator (modul 4)', route: null, ready: false },
  { title: '📷 MRZ skeniranje (modul 5)', route: null, ready: false },
];

export default function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Moji Dokumenti</Text>
      <Text style={styles.subtitle}>razvojni hub — moduli</Text>

      {MODULES.map((m) => (
        <Pressable
          key={m.title}
          style={[styles.card, !m.ready && styles.cardDisabled]}
          disabled={!m.ready}
          onPress={() => m.route != null && navigation.navigate(m.route)}
        >
          <Text style={[styles.cardText, !m.ready && styles.cardTextDisabled]}>
            {m.title}
            {!m.ready ? '  (uskoro)' : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 32 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 24 },
  card: {
    backgroundColor: '#f2f5f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardDisabled: { opacity: 0.45 },
  cardText: { fontSize: 16, fontWeight: '600', color: '#1f4e79' },
  cardTextDisabled: { color: '#777' },
});
