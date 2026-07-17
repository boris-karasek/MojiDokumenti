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
- ✅ Modul 4: MRZ generator (`tools/mrz-generator/`, samostalan CLI alat, van mobilne app) —
  ICAO 9303 check-digit (7-3-1), TD3 + TD1, samoverifikacija preko paketa `mrz`,
  `--corrupt` za namerno oštećene varijante, `--expiry` za kontrolu roka isteka
  (valid/soon/expired), vitest testovi
- ✅ Modul 5: MRZ skeniranje (kamera + OCR) — normalizacioni sloj
  (`src/services/mrzNormalizer.ts`, čisti OCR K→< greške i dužinu linije pre
  `mrz` parsiranja, 12 Jest testova) + `ScanScreen` (`expo-camera` +
  ML Kit OCR → normalizacija → `mrz` parsing → potvrda → `saveDocument`),
  sa ugrađenim debug prikazom toka za dijagnostiku na uređaju
- Sledeće: Modul 6 (manuelni unos dokumenta, bez skeniranja)

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

`app.json` sadrži `expo-camera` config plugin (dozvola za kameru) — ako je dev
build instaliran PRE modula 5, potreban je nov build da se dozvola ugradi u
native sloj.

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
src/services/mrzNormalizer.ts    čisti sirov OCR izlaz (K→<, dužina linije) pre mrz parsiranja — bez native zavisnosti
src/services/__tests__/          Jest testovi crypto, database i MRZ normalizacije
src/screens/                     ekrani (Home, CryptoTest, DatabaseTest, ScanScreen, …)
__mocks__/                       Jest mape: quick-crypto → Node crypto, SecureStore → memorija, expo-sqlite → in-memory
tools/mrz-generator/             razvojni CLI alat — generator sintetičkih MRZ zapisa (v. ispod), NIJE deo mobilne app
```

## Razvojni alati — MRZ generator

[`tools/mrz-generator/`](./tools/mrz-generator/) je samostalan Node.js/TypeScript
CLI alat (sopstveni `package.json`, van mobilne app) koji generiše sintetičke
(izmišljene) MRZ zapise za testiranje OCR/parsing pipeline-a i za evaluaciju u
radu:

- **TD3** (pasoš, 2×44) i **TD1** (lična karta, 3×30), sa ICAO 9303
  check-digitom (težine 7-3-1) i samoverifikacijom preko paketa `mrz`
  (svaki zapis mora vratiti `valid: true`).
- `--corrupt=<n>` — namerno oštećene (nevalidne) varijante za evaluaciju
  robusnosti OCR-a.
- `--expiry=<spec>` — kontrola datuma isteka: `valid` (2-9 godina, podrazumevano),
  `soon` (7-30 dana, testiranje praga notifikacija) ili `expired` (istekao pre
  1-60 dana); podržana i eksplicitna raspodela po broju zapisa
  (npr. `valid:15,soon:3,expired:2`).

Detalji (algoritam, layout polja, svi primeri) su u
[tools/mrz-generator/README.md](./tools/mrz-generator/README.md).

## Testiranje i provera tipova

```bash
npm test              # 32 Jest testa: crypto, database i MRZ normalizacija (bez uređaja)
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

`src/services/mrzNormalizer.ts` čisti sirov OCR izlaz pre `mrz` paketa — bez
native zavisnosti, pa je u potpunosti testabilan na laptopu (nema poseban
*TestScreen sloj kao crypto/baza). Jest testovi (`mrzNormalizer.test.ts`)
dokazuju:

- filler nizove pogrešno pročitane kao `K` (npr. `"BORIS<KK<K<"`,
  `"BORISKKKKKK"`),
- da prava imena sa `K` (npr. "MARKO", "KATARINA") ostaju netaknuta,
- normalizaciju dužine linije (TD1=30, TD3=44) i kraćenjem i dopunjavanjem,
- dva potpuno "prljava" TD3/TD1 primera koji posle normalizacije prolaze kroz
  pravi `mrz` paket sa `valid: true` (end-to-end dokaz, ne samo unit nivo).

Kamera, ML Kit OCR i `ScanScreen` su native/UI sloj koji Jest ne pokriva —
verifikuje se ručno na uređaju preko `HomeScreen` → **MRZ skeniranje**:

1. Prva poseta ekranu traži dozvolu za kameru; testirati i odbijanje
   (poruka + dugme koje vodi u podešavanja uređaja).
2. Uslikati MRZ zonu (pasoš ili lična karta) uz dobro osvetljenje → očekivan
   preview sa ispravno mapiranim poljima, posebno datum rođenja i datum
   isteka (vek se pogađa ručno jer `mrz` paket vraća sirov `YYMMDD`).
3. Uslikati nešto bez MRZ zone / loše osvetljeno → "Skeniranje nije uspelo" +
   "Pokušaj ponovo", ništa se ne sme upisati u bazu.
4. **Debug** prekidač (gornji desni ugao ekrana) posle jednog pokušaja
   prikazuje sirov OCR tekst → kandidat linije → normalizovane linije → 
   parsirana polja — koristi se i za evaluaciju OCR pouzdanosti u radu.
5. Na preview ekranu **Sačuvaj** → proveriti kroz `DatabaseTestScreen` da je
   dokument stvarno upisan i da polja odgovaraju MRZ zoni.

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
