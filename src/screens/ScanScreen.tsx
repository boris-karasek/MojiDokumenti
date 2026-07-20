/**
 * ScanScreen — skeniranje MRZ zone: kamera → OCR → normalizacija → parsing → čuvanje.
 *
 * Prvi ekran koji radi na pravom uređaju (kamera + ML Kit su native paketi,
 * ne rade u Expo Go). Tok je namerno razbijen na jasno odvojene korake
 * (1–7 u komentarima ispod) — svaki korak upisuje svoj deo u state PRE nego
 * što pozove sledeći, da se u debug prikazu tačno vidi gde tok eventualno
 * pukne (loše osvetljenje → OCR prazan tekst; loš kadar → nema kandidat
 * linija; OCR greška → normalizator ne uspe da pogodi; check-digit greška →
 * mrz.valid === false).
 *
 * OCR poziv (TextRecognition.recognize) i heuristika za kandidat-linije
 * (extractCandidateLines) su prekopirani iz radnog POC-a
 * (~/projects/mrz-poc-mlkit/App.js) i pretipizirani — ta dva koraka su već
 * dokazana da rade na uređaju, ne menjati bez ponovnog testa na uređaju.
 *
 * Ono što OSTAJE u komponenti (a POC nije imao): mapiranje u DocumentData
 * (types.ts), konverzija YYMMDD → ISO datuma, i korak potvrde pre čuvanja —
 * sve prema bezbednosnom principu "nikad ne čuvaj sirovu sliku ni OCR tekst"
 * (CLAUDE.md). Slika iz takePictureAsync ide samo lokalnom ML Kit pozivu;
 * ni ona ni sirov OCR tekst se ne upisuju u bazu, samo strukturirani
 * DocumentData nakon eksplicitne potvrde korisnika.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  Switch,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { parse as parseMrz, type ParseResult } from 'mrz';

import {
  normalizeMrzLines,
  type MrzDocumentType,
  type MrzNormalizeResult,
} from '../services/mrzNormalizer';
import { saveDocument } from '../services/database';
import type { DocumentData, DocumentType } from '../types';
import type { ScreenProps } from '../navigation';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------- korak 3
// Iz sirovog OCR teksta izdvoji kandidat-linije MRZ zone: poslednje 2 (TD3 —
// pasoš) ili poslednje 3 (TD1 — lična karta) "guste" linije sa '<' karakterima.
// Ovde se NE dira dužina linije (o tome brine normalizeMrzLines, korak 4) —
// samo se bira KOJE linije uopšte idu dalje u tok.
function extractCandidateLines(rawText: string): string[] | null {
  const candidates = rawText
    .split('\n')
    .map((line) => line.toUpperCase().replace(/[^A-Z0-9<]/g, '')) // samo MRZ karakteri
    .filter((line) => line.includes('<') && line.length >= 20);

  if (candidates.length === 0) return null;

  const last2 = candidates.slice(-2);
  const last3 = candidates.slice(-3);

  if (last2.length === 2 && last2.every((l) => l.length >= 38)) {
    return last2; // pasoš (TD3): dve duge linije (~44)
  }
  if (candidates.length >= 3 && last3.every((l) => l.length >= 22 && l.length < 38)) {
    return last3; // lična karta (TD1): tri linije (~30)
  }
  if (last2.length === 2) {
    return last2; // fallback: pretpostavi pasoš
  }
  return null;
}

// ---------------------------------------------------------------- korak 6
// Mapiranje parsiranih MRZ polja (mrz paket) u DocumentData (types.ts).

function mrzTypeToDocumentType(mrzType: MrzDocumentType): DocumentType {
  return mrzType === 'TD3' ? 'pasos' : 'licna_karta';
}

/**
 * mrz paket vraća datume kao sirove YYMMDD stringove — parseDate u mrz
 * paketu ih samo validira (mesec 1-12, dan 1-31), NE pogađa vek. Vek se
 * mora dodati ovde: expiryDate je uvek 20xx (dokumenti sa MRZ zonom koje
 * ova app prati ne postoje iz XX veka — MRZ je ICAO standard od 1980ih,
 * ali sa realnim rokom trajanja 5-10 god. od izdavanja u praksi je 2000+).
 */
function yymmddToIso(yymmdd: string): string {
  if (!/^\d{6}$/.test(yymmdd)) {
    throw new Error(`Neispravan datum iz MRZ-a: "${yymmdd}"`);
  }
  const month = Number(yymmdd.slice(2, 4));
  const day = Number(yymmdd.slice(4, 6));
  const yy = Number(yymmdd.slice(0, 2));

  const date = new Date(Date.UTC(2000 + yy, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Neispravan datum iz MRZ-a: "${yymmdd}"`);
  }
  return date.toISOString();
}

function requireField(fields: ParseResult['fields'], name: keyof ParseResult['fields']): string {
  const value = fields[name];
  if (value == null || value === '') {
    throw new Error(`MRZ polje "${name}" nedostaje ili nije čitljivo.`);
  }
  return value;
}

function mapParsedToDocumentData(parsed: ParseResult, mrzType: MrzDocumentType): DocumentData {
  const firstName = requireField(parsed.fields, 'firstName');
  const lastName = requireField(parsed.fields, 'lastName');
  const documentNumber = requireField(parsed.fields, 'documentNumber');
  const expirationDate = requireField(parsed.fields, 'expirationDate');
  const nationality = parsed.fields.nationality ?? undefined;

  return {
    type: mrzTypeToDocumentType(mrzType),
    documentNumber,
    firstName,
    lastName,
    nationality,
    expiryDate: yymmddToIso(expirationDate),
    createdAt: Date.now(),
  };
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  pasos: 'Pasoš',
  licna_karta: 'Lična karta',
  vozacka: 'Vozačka dozvola',
  oruzni_list: 'Oružni list',
  platna_kartica: 'Platna kartica',
  ostalo: 'Ostalo',
};

const formatDate = (iso: string | undefined): string => (iso == null ? '—' : iso.slice(0, 10));

// -------------------------------------------------------------------------

type Phase = 'camera' | 'processing' | 'preview' | 'invalid';

export default function ScanScreen({ navigation }: ScreenProps<'ScanDocument'>) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const [phase, setPhase] = useState<Phase>('camera');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Snimak svakog koraka toka — samo za dijagnostiku na uređaju (debug panel).
  const [rawOcrText, setRawOcrText] = useState<string | null>(null);
  const [candidateLines, setCandidateLines] = useState<string[] | null>(null);
  const [normalizeResult, setNormalizeResult] = useState<MrzNormalizeResult | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);

  /** Potpuni reset — nakon uspešnog čuvanja, za skeniranje sledećeg dokumenta. */
  const reset = useCallback(() => {
    setPhase('camera');
    setError(null);
    setSavedId(null);
    setRawOcrText(null);
    setCandidateLines(null);
    setNormalizeResult(null);
    setParseResult(null);
    setDocumentData(null);
  }, []);

  /** Nazad na kameru posle neuspelog pokušaja — debug podaci OSTAJU vidljivi. */
  const handleRetry = useCallback(() => {
    setPhase('camera');
    setError(null);
  }, []);

  const handleCapture = useCallback(async () => {
    if (cameraRef.current == null) return;
    setPhase('processing');
    setError(null);
    setRawOcrText(null);
    setCandidateLines(null);
    setNormalizeResult(null);
    setParseResult(null);
    setDocumentData(null);

    try {
      // 2a. Slika sa kamere (privremen fajl u cache-u uređaja, nigde se ne upisuje).
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });

      // 2b. OCR — ML Kit, potpuno on-device (bez mreže).
      const ocrResult = await TextRecognition.recognize(photo.uri);
      const text = ocrResult.text;
      setRawOcrText(text);
      if (text === '') {
        throw new Error('OCR nije prepoznao nikakav tekst na slici.');
      }

      // 3. Kandidat MRZ linije.
      const candidates = extractCandidateLines(text);
      setCandidateLines(candidates);
      if (candidates == null) {
        throw new Error(
          'Nije pronađena MRZ zona. Uslikaj samo donji deo dokumenta (MRZ traku), sa boljim osvetljenjem.',
        );
      }

      // 4. Normalizacija (dužina linije, OCR K→< greške) — mrzNormalizer.ts.
      const normalized = normalizeMrzLines(candidates);
      setNormalizeResult(normalized);

      // 5. Parsiranje — mrz paket. Parsira i kad check-digit ne prolazi
      // (valid:false), zato se validnost proverava eksplicitno ispod.
      const parsed = parseMrz(normalized.lines);
      setParseResult(parsed);

      if (!parsed.valid) {
        setError('MRZ zona pročitana, ali provera (check-digit) nije prošla.');
        setPhase('invalid');
        return;
      }

      // 6. Mapiranje u DocumentData (types.ts).
      const data = mapParsedToDocumentData(parsed, normalized.type);
      setDocumentData(data);
      setPhase('preview');
    } catch (e) {
      setError(msg(e));
      setPhase('invalid');
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (documentData == null) return;
    setSaving(true);
    setError(null);
    try {
      // 7. Čuvanje — encryptObject + expo-sqlite (database.ts), tek nakon
      // eksplicitne potvrde korisnika u preview koraku.
      const id = await saveDocument(documentData);
      setSavedId(id);
    } catch (e) {
      setError(msg(e));
    } finally {
      setSaving(false);
    }
  }, [documentData]);

  // --------------------------------------------------------- 1. dozvola

  if (permission == null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionTitle}>Potrebna je dozvola za kameru</Text>
        <Text style={styles.permissionText}>
          Skeniranje MRZ zone zahteva pristup kameri. Slika se obrađuje isključivo
          na uređaju (OCR bez mreže) i nigde se ne čuva.
        </Text>
        {permission.canAskAgain ? (
          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Dozvoli kameru</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.button} onPress={() => Linking.openSettings()}>
            <Text style={styles.buttonText}>Otvori podešavanja</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Skeniranje MRZ-a</Text>
        <View style={styles.debugToggle}>
          <Text style={styles.debugToggleLabel}>Debug</Text>
          <Switch value={showDebug} onValueChange={setShowDebug} />
        </View>
      </View>

      {phase === 'camera' || phase === 'processing' ? (
        <View style={styles.cameraWrap}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
          />
          <View style={styles.overlay}>
            <Text style={styles.hint}>
              Postavi MRZ zonu (donji deo dokumenta) u kadar i slikaj.
            </Text>
            <Pressable
              style={styles.captureButton}
              onPress={handleCapture}
              disabled={phase === 'processing' || !cameraReady}
            >
              {phase === 'processing' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Slikaj i skeniraj</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultContent}>
          {phase === 'invalid' && (
            <View style={styles.card}>
              <Text style={styles.cardTitleError}>Skeniranje nije uspelo</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.button} onPress={handleRetry}>
                <Text style={styles.buttonText}>Pokušaj ponovo</Text>
              </Pressable>
            </View>
          )}

          {phase === 'preview' && documentData != null && (
            savedId != null ? (
              <View style={styles.card}>
                <Text style={styles.cardTitleOk}>Dokument sačuvan</Text>
                <Text style={styles.savedText}>id={savedId}</Text>
                <Pressable style={styles.button} onPress={reset}>
                  <Text style={styles.buttonText}>Skeniraj još jedan</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() => navigation.navigate('Home')}
                >
                  <Text style={styles.buttonText}>Nazad na početnu</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitleOk}>Proveri podatke pre čuvanja</Text>
                <Field label="Tip dokumenta" value={DOCUMENT_TYPE_LABELS[documentData.type]} />
                <Field label="Broj dokumenta" value={documentData.documentNumber} />
                <Field label="Ime" value={documentData.firstName} />
                <Field label="Prezime" value={documentData.lastName} />
                <Field label="Državljanstvo" value={documentData.nationality ?? '—'} />
                <Field label="Datum isteka" value={formatDate(documentData.expiryDate)} />

                {error != null && <Text style={styles.errorText}>{error}</Text>}

                <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Sačuvaj</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={reset}
                  disabled={saving}
                >
                  <Text style={styles.buttonText}>Skeniraj ponovo</Text>
                </Pressable>
              </View>
            )
          )}

          {showDebug && (
            <DebugPanel
              rawText={rawOcrText}
              candidates={candidateLines}
              normalized={normalizeResult}
              parsed={parseResult}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

interface DebugPanelProps {
  rawText: string | null;
  candidates: string[] | null;
  normalized: MrzNormalizeResult | null;
  parsed: ParseResult | null;
}

/** Prikaz svakog koraka toka (OCR → kandidati → normalizacija → parsing) — za dijagnostiku na uređaju i evaluaciju u radu. */
function DebugPanel({ rawText, candidates, normalized, parsed }: DebugPanelProps) {
  return (
    <View style={styles.debugCard}>
      <Text style={styles.debugTitle}>Debug — tok obrade</Text>

      <Text style={styles.debugLabel}>1. Sirov OCR tekst</Text>
      <Text style={styles.debugMono}>{rawText ?? '(nema)'}</Text>

      <Text style={styles.debugLabel}>2. Kandidat MRZ linije</Text>
      {candidates == null ? (
        <Text style={styles.debugMono}>(nema)</Text>
      ) : (
        candidates.map((l, i) => (
          <Text key={i} style={styles.debugMono}>
            {l}
          </Text>
        ))
      )}

      <Text style={styles.debugLabel}>
        3. Normalizovane linije
        {normalized != null
          ? ` (tip ${normalized.type}, ${normalized.totalChanges} izmena)`
          : ''}
      </Text>
      {normalized == null ? (
        <Text style={styles.debugMono}>(nema)</Text>
      ) : (
        normalized.lines.map((l, i) => (
          <Text key={i} style={styles.debugMono}>
            {l}
          </Text>
        ))
      )}

      <Text style={styles.debugLabel}>4. Parsirano (mrz paket)</Text>
      <Text style={styles.debugMono}>
        {parsed == null
          ? '(nema)'
          : `format=${parsed.format} valid=${String(parsed.valid)}\n${JSON.stringify(parsed.fields, null, 2)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#000',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  debugToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  debugToggleLabel: { color: '#ccc', fontSize: 13 },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    alignItems: 'center',
  },
  hint: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 8,
  },
  captureButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 220,
  },
  button: {
    backgroundColor: '#1f4e79',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonSecondary: { backgroundColor: '#555' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  permissionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  permissionText: { color: '#ccc', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  resultScroll: { flex: 1, backgroundColor: '#f5f5f5' },
  resultContent: { padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitleOk: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#1f4e79' },
  cardTitleError: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#a33b2e' },
  errorText: { color: '#a33b2e', fontSize: 14, marginBottom: 8 },
  savedText: { color: '#555', fontSize: 12, marginBottom: 4 },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fieldLabel: { color: '#666', fontSize: 14 },
  fieldValue: { fontWeight: '600', fontSize: 14 },
  debugCard: { backgroundColor: '#111', borderRadius: 12, padding: 16 },
  debugTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  debugLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  debugMono: { color: '#e5e7eb', fontFamily: 'monospace', fontSize: 12, marginBottom: 2 },
});
