/**
 * navigation.ts — tipovi React Navigation stack-a.
 *
 * Svaki nov ekran se registruje OVDE (ime rute + parametri koje prima),
 * pa navigation.navigate('...') dobija autocomplete i proveru parametara.
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  CryptoTest: undefined;
  DatabaseTest: undefined;
  ScanDocument: undefined;
  // Budući moduli se dodaju ovde, npr:
  // DocumentDetails: { documentId: string };
};

/** Props tip za ekran — koristi se kao: ScreenProps<'Home'> */
export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
