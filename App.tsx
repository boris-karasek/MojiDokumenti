/**
 * App.tsx — ulazna tačka MojiDokumenti aplikacije.
 *
 * Pri startu: getOrCreateMasterKey() — pri PRVOM pokretanju generiše
 * 256-bitni master ključ i upisuje ga u Keychain/Keystore; pri svakom
 * sledećem samo potvrđuje da postoji. App ne renderuje sadržaj dok
 * ključ nije spreman.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { getOrCreateMasterKey } from './src/services/crypto';
import type { RootStackParamList } from './src/navigation';
import DocumentListScreen from './src/screens/DocumentListScreen';
import DocumentDetailScreen from './src/screens/DocumentDetailScreen';
import CryptoTestScreen from './src/screens/CryptoTestScreen';
import ScanScreen from './src/screens/ScanScreen';
import ManualEntryScreen from './src/screens/ManualEntryScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [keyReady, setKeyReady] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    getOrCreateMasterKey()
      .then(() => setKeyReady(true))
      .catch((e: unknown) =>
        setKeyError(e instanceof Error ? e.message : String(e)),
      );
  }, []);

  if (keyError != null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Greška pri inicijalizaciji ključa</Text>
        <Text style={styles.errorDetail}>{keyError}</Text>
      </View>
    );
  }

  if (!keyReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loading}>Priprema master ključa…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={DocumentListScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="DocumentDetails"
          component={DocumentDetailScreen}
          options={{ title: 'Detalji dokumenta' }}
        />
        <Stack.Screen
          name="CryptoTest"
          component={CryptoTestScreen}
          options={{ title: 'Crypto testovi' }}
        />
        <Stack.Screen
          name="ScanDocument"
          component={ScanScreen}
          options={{ title: 'Skeniranje MRZ-a', headerShown: false }}
        />
        <Stack.Screen
          name="ManualEntry"
          component={ManualEntryScreen}
          options={{ title: 'Ručni unos dokumenta' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loading: { marginTop: 12, color: '#666' },
  errorTitle: { fontSize: 17, fontWeight: '700', color: '#c0392b', marginBottom: 8 },
  errorDetail: { color: '#555', textAlign: 'center' },
});
