@AGENTS.md
# CLAUDE.md — MojiDokumenti

## Šta je ovaj projekat

Diplomski rad (FIT). Mobilna aplikacija za bezbedno praćenje rokova važenja ličnih
dokumenata. Korisnik skenira dokument kamerom, OCR čita MRZ zonu, strukturirani
podaci se **enkriptuju na uređaju** i čuvaju; app podseća pred istek dokumenta.
Čuvaju se **samo strukturirani podaci, nikad slike dokumenata**.

Srž rada je **kriptografija i zero-knowledge arhitektura** — sve odluke se mere
prema tome. Rok: 2-3 meseca. Autor je student; objasni netrivijalne odluke u
komentarima, jer kod ulazi u tekst rada.

## Trenutno stanje (ažuriraj posle svakog modula!)

- ✅ Modul 1: struktura projekta + navigacija
- ✅ Modul 2: crypto modul + 12 Jest testova + CryptoTestScreen (verifikacija na uređaju)
- ✅ Modul 3: lokalna baza (expo-sqlite) + repository sloj (`src/services/database.ts`) + 8 Jest testova
- ⏳ **SLEDEĆI — Modul 4: MRZ generator**
- Zatim: 5. MRZ skeniranje → 6. manuelni unos → 7. lista/detalji
  → 8. lokalne notifikacije → 9. Firebase Auth + Firestore sync → 10. QR prenos
  ključa → 11. biometrija 

## Arhitektura

```
kamera → OCR (ML Kit, on-device) → MRZ parsing → DocumentData objekat
                                                        ↓
                            AES-256-GCM enkripcija (ključ iz Keystore)
                                                        ↓
                                    šifrat → expo-sqlite (PRIMARNO)
                                          → Firestore (backup/sync, modul 9)
                                                        ↓
                                    lokalne notifikacije (zakazane na uređaju)
```

## Bezbednosne invarijante — NIKAD ne kršiti

1. Master ključ (256 nasumičnih bita) živi u `expo-secure-store`
   (Keychain/Keystore) i **nikad ne napušta uređaj** — jedini izuzetak je
   eksplicitni QR export u modulu 10 (direktno uređaj→uređaj, nikad kroz server).
2. Ključ **nije izveden iz PIN-a** i to ostaje tako (PIN = 10.000 kombinacija =
   trivijalan offline brute-force).
3. **Sva** osetljiva polja (ime, prezime, broj dokumenta, datumi) idu u JEDAN
   šifrovan string. U Firestore plain ide samo `userId` (za security rules)
   i `createdAt`. Ni `expiryDate` nije plain — zato su notifikacije LOKALNE.
4. Algoritam je **AES-256-GCM** (integritet + poverljivost), nov nasumičan
   12-bajtni IV za svaki zapis. Format šifrata: `v1:iv:ct:tag` (base64 delovi).
5. Tip `EncryptedString` (branded, `src/types.ts`) nastaje ISKLJUČIVO u
   `encryptObject()`. Baza i Firestore sloj primaju samo `EncryptedString` —
   nikad ne dodavati cast `as EncryptedString` van `crypto.ts`.
6. Server nikad ne vidi ključ ni plaintext → push notifikacije su nemoguće
   i nepotrebne; koristi se `expo-notifications` + `scheduleNotificationAsync`.

## Tehnologije

| Deo | Paket |
|---|---|
| Framework | React Native + Expo SDK 56, TypeScript (strict) |
| Build | EAS dev build ili `npx expo run:android` (NE Expo Go — native paketi) |
| Kamera | `expo-camera` |
| OCR | `@react-native-ml-kit/text-recognition` (on-device) |
| MRZ parsing | `mrz` (npm) |
| Enkripcija | `react-native-quick-crypto` + `@craftzdog/react-native-buffer` |
| Ključ | `expo-secure-store` |
| Lokalna baza | `expo-sqlite` |
| Notifikacije | `expo-notifications` (lokalne!) |
| Cloud (modul 9) | Firebase Auth + Firestore |
| QR (modul 10) | `react-native-qrcode-svg` + `expo-camera` |

**ZABRANJENO:** `crypto-js` (CBC bez integriteta, `Math.random`), Google Cloud
Vision API, push/FCM notifikacije, Firestore `Timestamp` tip (sve osetljivo je
šifrovan string), čuvanje slika dokumenata.

## Struktura

```
App.tsx                          init ključa + navigacija
src/types.ts                     CENTRALNI model — svaka izmena modela kreće odavde
src/navigation.ts                RootStackParamList — nov ekran se registruje tu
src/services/crypto.ts           ključ + AES-GCM (NE menjati bez dogovora s autorom)
src/services/database.ts         repository sloj (expo-sqlite + crypto) — vraća samo DecryptedDocument
src/services/__tests__/          Jest testovi
src/screens/                     ekrani (uključujući privremene *TestScreen za verifikaciju na uređaju)
__mocks__/                       Jest mape: quick-crypto→Node crypto, SecureStore→memorija, expo-sqlite→in-memory
```

## Komande

```bash
npm test              # 20 Jest testova (crypto + database logika, bez uređaja)
npx tsc --noEmit      # tipska provera app koda (testove proverava ts-jest)
npx expo-doctor       # provera konfiguracije
npx expo start --dev-client --tunnel    # razvoj na instaliranom dev buildu
```

Rebuild (EAS / `expo run:android`) SAMO pri izmeni native sloja — JS/TS izmene
stižu preko Metro-a.

## Konvencije

- Datumi u modelu podataka su **ISO stringovi** (`.toISOString()`), nikad `Date`
  objekti — `JSON.parse` ne vraća `Date`. Konverzija u `Date` tek pri upotrebi.
- TS strict + `noUncheckedIndexedAccess` — ne popuštati opcije; greške rešavati
  ciljano na mestu nastanka.
- Dva tsconfig-a: `tsconfig.json` (app, exclude testova) i `tsconfig.jest.json`
  (nasleđuje glavni + `"types": ["jest","node"]`). Ne spajati ih.
- Jest verzija mora pratiti Expo SDK očekivanja (trenutno jest 29.x) —
  proveriti sa `npx expo-doctor` posle izmena dev zavisnosti.
- Komentari i UI tekstovi na srpskom.
- Jedan modul = jedan-dva commit-a sa jasnom porukom.

## Naučene lekcije (ne ponavljati greške)

- `mrz` paket zahteva TAČNU dužinu linija (TD1=30, TD2=36, TD3=44). OCR skoro
  nikad ne vrati savršenu dužinu → **obavezna normalizacija** svake linije pre
  parsiranja (višak odseći, manjak dopuniti `<`).
- ML Kit OCR + `mrz` rade pouzdano na realnom uređaju (dokazano POC-om) —
  ne menjati OCR stack.
- `react-native-quick-crypto` kopira Node `crypto` API → zato Jest testovi
  rade na laptopu preko `moduleNameMapper`. Unit testovi dokazuju LOGIKU;
  native implementaciju dokazuje CryptoTestScreen na uređaju. Oba sloja ostaju.
- Isti princip za `expo-sqlite`: Jest testovi rade na mock bazi
  (`__mocks__/expo-sqlite.js`, in-memory), native implementaciju i
  PERZISTENCIJU PREKO RESTARTA dokazuje DatabaseTestScreen na uređaju
  (dugme "Učitaj postojeće" bez prethodnog Save-a nakon restarta app-a).
- `npx expo start --tunnel` ako QR/Metro ne radi preko lokalne mreže.

## Model podataka

Firestore/SQLite zapis: `{ id, encrypted: EncryptedString, createdAt, userId? }`

`DocumentData` (sadržaj šifrata) — vidi `src/types.ts`:
`type` (pasos | licna_karta | vozacka | oruzni_list | platna_kartica | ostalo),
`documentNumber`, `firstName`, `lastName`, `nationality?`, `birthDate?`,
`expiryDate` (ISO string — osnova za notifikacije), `createdAt` (epoch ms).

## Posebni zahtevi

- **Nikad ne koristiti prave lične podatke** — ni u testovima, ni u primerima,
  ni u fixture podacima. Modul 4 pravi generator sintetičkih MRZ zapisa
  (nepostojeći ljudi, validni check-digitovi po ICAO 9303, težine 7-3-1);
  do tada koristiti očigledno izmišljene podatke (MARKO PETROVIC i sl.).
- Generator će služiti i za evaluaciju u radu (OCR pouzdanost na većem uzorku,
  uključujući namerno oštećene varijante).