# MojiDokumenti

Diplomski rad (FIT) — mobilna aplikacija za bezbedno praćenje rokova važenja
ličnih dokumenata. Korisnik skenira dokument kamerom, OCR čita MRZ zonu,
strukturirani podaci se **enkriptuju na uređaju** (AES-256-GCM) i čuvaju
lokalno; app podseća pred istek dokumenta lokalnim notifikacijama. Čuvaju se
**samo strukturirani podaci, nikad slike dokumenata**. Srž rada je
kriptografija i zero-knowledge arhitektura — server (kad bude dodat u modulu
9) nikad ne vidi ključ ni plaintext.

Detaljna arhitektura, bezbednosne invarijante i konvencije razvoja su u
[CLAUDE.md](./CLAUDE.md).

## Trenutno stanje

- ✅ Modul 1: struktura projekta + navigacija
- ✅ Modul 2: crypto modul (AES-256-GCM) + 12 Jest testova (logika) + CryptoTestScreen sa 6 on-device provera (native implementacija na uredjaju)
- ✅ Modul 3: lokalna baza (`expo-sqlite`) + repository sloj + 8 Jest testova
- ⏳ Modul 4: MRZ generator — sledeći

## Tehnologije

React Native + Expo SDK 57 (TypeScript, strict). Kamera i OCR su native
paketi (`expo-camera`, ML Kit) — projekat se **ne** pokreće kroz Expo Go, već
kroz EAS dev build ili `expo run:android`.

## Postavljanje

```bash
git clone <url> MojiDokumenti
cd MojiDokumenti
npm install
```

Kako projekat koristi native pakete (kamera, kriptografija, SQLite), potreban
je dev build pre prvog pokretanja na uređaju/emulatoru:

```bash
eas build --profile development --platform android
# ili lokalno:
npx expo run:android
```

Nakon što je dev build instaliran, dalje JS/TS izmene stižu preko Metro-a bez
ponovnog builda:

```bash
npx expo start --dev-client --tunnel
```

## Struktura

```
App.tsx                          init master ključa + navigacija
src/types.ts                     centralni model podataka (DocumentData, EncryptedString…)
src/navigation.ts                RootStackParamList
src/services/crypto.ts           master ključ (Keystore) + AES-256-GCM
src/services/database.ts         repository sloj: expo-sqlite + crypto, vraća samo DecryptedDocument
src/services/__tests__/          Jest testovi crypto i database logike
src/screens/                     ekrani (Home, CryptoTest, DatabaseTest, …)
__mocks__/                       Jest mape: quick-crypto → Node crypto, SecureStore → memorija, expo-sqlite → in-memory
```

## Testiranje i provera tipova

```bash
npm test              # Jest testovi crypto i database logike (bez uređaja)
npx tsc --noEmit       # tipska provera app koda
npx expo-doctor        # provera konfiguracije projekta
```

`react-native-quick-crypto` kopira Node-ov `crypto` API, pa Jest testovi rade
na laptopu preko `moduleNameMapper` (native paketi su mapirani na Node
ekvivalente u `__mocks__/`). Time je verifikovana **logika** enkripcije
(format šifrata, roundtrip, jedinstven IV po zapisu, odbijanje pogrešnog
ključa, GCM tamper detekcija). **Native implementaciju na uređaju** verifikuje
`CryptoTestScreen`:

1. Prvi start → generisanje master ključa.
2. Home → **Crypto testovi** → svih 6 zeleno.
3. Prekini proces app i pokreni ponovo → opet zeleno (ključ preživeo restart).

Ovo su dva komplementarna sloja evaluacije koji zajedno dokazuju ispravnost
enkripcije.

`src/services/database.ts` je jedino mesto koje zna za SQL i za `encrypted`
kolonu — enkripcija/dekripcija se dešava isključivo tu, ostatak app-a vidi
samo `DocumentData`/`DecryptedDocument`. Jest testovi (mock baze u
`__mocks__/expo-sqlite.js`) pokrivaju save→get roundtrip, sortiranje po
datumu, brisanje, i da red u bazi zaista sadrži `v1:iv:ct:tag` šifrat a ne
plaintext. **Native implementaciju i perzistenciju na uređaju** verifikuje
`DatabaseTestScreen` (privremen, briše se u modulu 7):

1. Home → **Lokalna baza** → **Sačuvaj test dokument** (par puta) → **Izlistaj
   sve** → provera da su svi tu, sortirani od najnovijeg.
2. **Obriši sve** → **Izlistaj sve** → baza prazna.
3. Sačuvaj par test dokumenata, **prekini proces app i pokreni ponovo**, otvori ekran i
   pritisni SAMO **Učitaj postojeće** (bez Save-a) → dokumenti se i dalje
   pojavljuju → baza je perzistentna preko restarta.

## Bezbednosne invarijante

Ukratko (puna lista sa obrazloženjem u [CLAUDE.md](./CLAUDE.md)):

- Master ključ (256 nasumičnih bita) živi isključivo u `expo-secure-store`
  (Keychain/Keystore) i nikad ne napušta uređaj osim kroz eksplicitni QR
  export uređaj→uređaj (modul 10).
- Ključ nije izveden iz PIN-a.
- Sva osetljiva polja idu u jedan AES-256-GCM šifrovan string
  (`v1:iv:ct:tag`), nikad plain u bazi ili u Firestore-u.
- Server nikad ne vidi ključ ni plaintext → nema push notifikacija, samo
  lokalne.
