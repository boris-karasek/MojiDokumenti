/**
 * ManualEntryScreen — ručni unos I izmena dokumenta, bez kamere/OCR-a
 * (unos: modul 6, izmena: modul 7).
 *
 * Postoji jer automatsko MRZ čitanje (modul 5) pokriva SAMO srpski
 * pasoš (TD3) i ličnu kartu (TD1) — v. CLAUDE.md, sekcija "Obim". Svi ostali
 * slučajevi (strani dokumenti, vozačka, oružni list, platna kartica — bilo
 * koji dokument bez MRZ zone) prolaze kroz ovu formu, kao i izmena BILO KOG
 * već sačuvanog dokumenta (uključujući skenirane — v. napomena kod handleSave).
 *
 * Isti ekran radi oba posla (route.params?.documentId odsutan → nov unos,
 * prisutan → izmena) da se izbegne duplirana forma/validacija/state. Pri
 * unosu proizvodi TAČNO isti DocumentData objekat kao ScanScreen i čuva ga
 * kroz saveDocument; pri izmeni učitava postojeći dokument (getDocument) i
 * čuva kroz updateDocument (database.ts) — validacija je ista u oba slučaja
 * (documentValidation.ts), testabilna bez UI-ja.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  validateManualEntry,
  buildDocumentData,
  hasErrors,
  CARD_NUMBER_DIGITS,
  type ManualEntryInput,
  type ManualEntryErrors,
} from '../services/documentValidation';
import { saveDocument, getDocument, updateDocument } from '../services/database';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from '../services/documentLabels';
import type { DocumentType } from '../types';
import type { ScreenProps } from '../navigation';
import { msg } from '../utils/errors';

const formatDate = (d: Date | null): string =>
  d == null ? 'Izaberi datum' : d.toISOString().slice(0, 10);

type DatePickerTarget = 'expiryDate' | null;

export default function ManualEntryScreen({ navigation, route }: ScreenProps<'ManualEntry'>) {
  const documentId = route.params?.documentId;
  const isEditMode = documentId != null;

  const [type, setType] = useState<DocumentType>('vozacka');
  const [documentNumber, setDocumentNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationality, setNationality] = useState('');
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget>(null);

  const [errors, setErrors] = useState<ManualEntryErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [loadingDoc, setLoadingDoc] = useState(isEditMode);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: isEditMode ? 'Izmena dokumenta' : 'Ručni unos dokumenta' });
  }, [navigation, isEditMode]);

  useEffect(() => {
    if (documentId == null) return;
    let active = true;
    getDocument(documentId)
      .then((doc) => {
        if (!active) return;
        if (doc == null) {
          setLoadError('Dokument nije pronađen.');
          return;
        }
        setType(doc.data.type);
        setDocumentNumber(doc.data.documentNumber);
        setFirstName(doc.data.firstName);
        setLastName(doc.data.lastName);
        setNationality(doc.data.nationality ?? '');
        setExpiryDate(new Date(doc.data.expiryDate));
      })
      .catch((e: unknown) => {
        if (active) setLoadError(msg(e));
      })
      .finally(() => {
        if (active) setLoadingDoc(false);
      });
    return () => {
      active = false;
    };
  }, [documentId]);

  const clearFieldError = useCallback((field: keyof ManualEntryErrors) => {
    setErrors((prev) => {
      if (prev[field] == null) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleTypeSelect = useCallback(
    (next: DocumentType) => {
      setType(next);
      clearFieldError('documentNumber');
    },
    [clearFieldError],
  );

  const reset = useCallback(() => {
    setType('vozacka');
    setDocumentNumber('');
    setFirstName('');
    setLastName('');
    setNationality('');
    setExpiryDate(null);
    setErrors({});
    setSaveError(null);
    setSavedId(null);
  }, []);

  const handleDateChange = useCallback(
    (_event: unknown, selected: Date | undefined) => {
      const target = datePickerTarget;
      setDatePickerTarget(Platform.OS === 'ios' ? target : null);
      if (selected == null) return;
      if (target === 'expiryDate') {
        setExpiryDate(selected);
        clearFieldError('expiryDate');
      }
    },
    [datePickerTarget, clearFieldError],
  );

  const persist = useCallback(
    async (input: ManualEntryInput) => {
      const data = buildDocumentData(input);
      setSaving(true);
      try {
        if (isEditMode) {
          await updateDocument(documentId, data);
          setSavedId(documentId);
        } else {
          const id = await saveDocument(data);
          setSavedId(id);
        }
      } catch (e) {
        setSaveError(msg(e));
      } finally {
        setSaving(false);
      }
    },
    [isEditMode, documentId],
  );

  const handleSave = useCallback(() => {
    const input: ManualEntryInput = {
      type,
      documentNumber,
      firstName,
      lastName,
      nationality,
      expiryDate,
    };

    const validationErrors = validateManualEntry(input);
    setErrors(validationErrors);
    setSaveError(null);
    if (hasErrors(validationErrors)) return;

    // Za izmenu tražimo eksplicitnu potvrdu: skenirani dokument je prošao
    // ICAO check-digit pri unosu (mrz.parse), ali ovde korisnik ručno kuca
    // izmenjene vrednosti — nema te zaštite od typo-a, pa je dodatna
    // potvrda jednostavna kočnica (isti obrazac kao potvrda pri brisanju).
    if (isEditMode) {
      Alert.alert('Sačuvati izmene?', 'Podaci dokumenta će biti trajno izmenjeni.', [
        { text: 'Otkaži', style: 'cancel' },
        { text: 'Sačuvaj', onPress: () => void persist(input) },
      ]);
    } else {
      void persist(input);
    }
  }, [type, documentNumber, firstName, lastName, nationality, expiryDate, isEditMode, persist]);

  if (loadingDoc) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (loadError != null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  if (savedId != null) {
    return (
      <View style={styles.center}>
        <Text style={styles.cardTitleOk}>
          {isEditMode ? 'Izmene sačuvane' : 'Dokument sačuvan'}
        </Text>
        {!isEditMode && <Text style={styles.savedText}>id={savedId}</Text>}
        {isEditMode ? (
          <Pressable style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Nazad na detalje</Text>
          </Pressable>
        ) : (
          <>
            <Pressable style={styles.button} onPress={reset}>
              <Text style={styles.buttonText}>Unesi još jedan</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.buttonText}>Nazad na početnu</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Tip dokumenta</Text>
      <View style={styles.typeRow}>
        {DOCUMENT_TYPES.map((t) => (
          <Pressable
            key={t}
            style={[styles.typeChip, type === t && styles.typeChipSelected]}
            onPress={() => handleTypeSelect(t)}
          >
            <Text style={[styles.typeChipText, type === t && styles.typeChipTextSelected]}>
              {DOCUMENT_TYPE_LABELS[t]}
            </Text>
          </Pressable>
        ))}
      </View>

      <FormField
        // Za platnu karticu se, iz bezbednosnih razloga, čuva
        // ISKLJUČIVO poslednje 4 cifre — nikad pun broj kartice, ni šifrovan.
        // Zato je maxLength/tastatura ovde uslovljena tipom dokumenta, a
        // validateManualEntry to dodatno proverava regexom pre čuvanja.
        label={type === 'platna_kartica' ? `Poslednje ${CARD_NUMBER_DIGITS} cifre kartice` : 'Broj dokumenta'}
        value={documentNumber}
        onChangeText={(v) => {
          setDocumentNumber(v);
          clearFieldError('documentNumber');
        }}
        error={errors.documentNumber}
        keyboardType={type === 'platna_kartica' ? 'number-pad' : 'default'}
        maxLength={type === 'platna_kartica' ? CARD_NUMBER_DIGITS : undefined}
        autoCapitalize="characters"
      />

      <FormField
        label="Ime"
        value={firstName}
        onChangeText={(v) => {
          setFirstName(v);
          clearFieldError('firstName');
        }}
        error={errors.firstName}
        autoCapitalize="words"
      />

      <FormField
        label="Prezime"
        value={lastName}
        onChangeText={(v) => {
          setLastName(v);
          clearFieldError('lastName');
        }}
        error={errors.lastName}
        autoCapitalize="words"
      />

      <FormField
        label="Državljanstvo (opciono)"
        value={nationality}
        onChangeText={setNationality}
        autoCapitalize="characters"
        maxLength={3}
        placeholder="npr. SRB"
      />

      <DateField
        label="Datum isteka"
        value={expiryDate}
        error={errors.expiryDate}
        onPress={() => setDatePickerTarget('expiryDate')}
      />

      {datePickerTarget != null && (
        <DateTimePicker
          value={expiryDate ?? new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {saveError != null && <Text style={styles.errorText}>{saveError}</Text>}

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{isEditMode ? 'Sačuvaj izmene' : 'Sačuvaj'}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  keyboardType?: 'default' | 'number-pad';
  maxLength?: number;
  autoCapitalize?: 'none' | 'words' | 'characters';
  placeholder?: string;
}

function FormField({
  label,
  value,
  onChangeText,
  error,
  keyboardType = 'default',
  maxLength,
  autoCapitalize = 'none',
  placeholder,
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, error != null && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        placeholder={placeholder}
      />
      {error != null && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

function DateField({
  label,
  value,
  error,
  onPress,
}: {
  label: string;
  value: Date | null;
  error?: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={[styles.input, error != null && styles.inputError]} onPress={onPress}>
        <Text style={value == null ? styles.datePlaceholder : styles.dateValue}>
          {formatDate(value)}
        </Text>
      </Pressable>
      {error != null && <Text style={styles.fieldError}>{error}</Text>}
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
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f2f5f9',
  },
  typeChipSelected: { backgroundColor: '#1f4e79' },
  typeChipText: { color: '#1f4e79', fontWeight: '600', fontSize: 13 },
  typeChipTextSelected: { color: '#fff' },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: '#666', marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    justifyContent: 'center',
    minHeight: 46,
  },
  inputError: { borderColor: '#a33b2e' },
  fieldError: { color: '#a33b2e', fontSize: 12, marginTop: 4 },
  datePlaceholder: { color: '#999', fontSize: 15 },
  dateValue: { color: '#111', fontSize: 15 },
  button: {
    backgroundColor: '#1f4e79',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonSecondary: { backgroundColor: '#555' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cardTitleOk: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#1f4e79' },
  savedText: { color: '#555', fontSize: 12, marginBottom: 20 },
  errorText: { color: '#a33b2e', fontSize: 14, marginBottom: 8 },
});
