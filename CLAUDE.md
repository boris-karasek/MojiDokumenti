@AGENTS.md
# CLAUDE.md — MojiDokumenti

## Šta je ovaj projekat

Diplomski rad (FIT). Mobilna aplikacija za bezbedno praćenje rokova važenja ličnih
dokumenata. Korisnik skenira dokument kamerom, OCR čita MRZ zonu, strukturirani
podaci se **enkriptuju na uređaju** i čuvaju; app podseća pred istek dokumenta.
Čuvaju se **samo strukturirani podaci, nikad slike dokumenata**.

Srž rada je **kriptografija i zero-knowledge arhitektura** — sve odluke se mere
prema tome. Autor je student; objasni netrivijalne odluke u
komentarima, jer kod ulazi u tekst rada.

## Trenutno stanje (ažuriraj posle svakog modula!)

- ✅ Modul 1: struktura projekta + navigacija
- ✅ Modul 2: crypto modul + 12 Jest testova + CryptoTestScreen (verifikacija na uređaju)
- ✅ Modul 3: lokalna baza (expo-sqlite) + repository sloj (`src/services/database.ts` —
  `saveDocument`, `getAllDocuments`, `getDocument`, `deleteDocument`) + 8 Jest testova
- ✅ Modul 4: MRZ generator (`tools/mrz-generator/`, samostalan CLI alat izvan mobilne app) —
  generiše ISKLJUČIVO srpska dokumenta (pasoš TD3 + lična karta TD1, uvek
  `nationality: SRB`), numerički brojevi dokumenata (bez OCR 0/O dvosmislenosti),
  strukturno validan JMBG (`src/jmbg.ts` — zaseban mod-11 algoritam nad prvih 12
  cifara, NIJE isto što i ICAO check-digit; DDMMGGG odgovara generisanom
  datumu rođenja), transliteracija imena (Č/Ć→C, Đ→DJ, Š→S, Ž→Z), ICAO 9303
  check-digit (7-3-1), samoverifikacija preko paketa `mrz`, `--corrupt` za
  namerno oštećene varijante, `--expiry` za kontrolu roka isteka
  (valid/soon/expired), vitest testovi
- ✅ **Modul 5 — MRZ skeniranje (kamera + OCR)**:
  normalizacioni sloj (`src/services/mrzNormalizer.ts` — čisti OCR K→<
  greške i dužinu linije pre `mrz` parsiranja, 12 Jest testova uključujući
  end-to-end TD1+TD3 preko pravog `mrz` paketa) + `src/screens/ScanScreen.tsx`
  (`expo-camera` + ML Kit OCR → kandidat-linije → normalizacija → `mrz`
  parsing → potvrda korisnika → `saveDocument`), sa debug prikazom celog
  toka na uređaju (flag u UI). `app.json` ima `expo-camera` config plugin
  (dozvola za kameru) — **zahteva nov native build** ako je dev build
  instaliran pre ovog modula. Verifikovano na uređaju: prava lična karta i pasoš pročitani bez greške iz
  prvog pokušaja; sintetički uzorci (generator) takođe prolaze.
- ✅ **Modul 6 — manuelni unos**: `src/services/documentValidation.ts`
  (čista validaciona funkcija bez UI zavisnosti — obavezna polja, expiryDate
  obavezan, platna kartica tačno 4 cifre, 15 Jest testova) +
  `src/screens/ManualEntryScreen.tsx` (izbor `DocumentType`, tekstualna
  polja, datum isteka preko `@react-native-community/datetimepicker`) →
  proizvodi isti `DocumentData` oblik i zove isti `saveDocument` kao
  ScanScreen. Platna kartica čuva ISKLJUČIVO poslednje 4 cifre (nikad pun
  broj, ni šifrovan) — bezbednosna odluka. `app.json` dobio config plugin
  za datetimepicker — **zahteva nov native build** ako je dev build
  instaliran pre ovog modula.
- ✅ **Minimizacija podataka**: `birthDate` uklonjen iz `DocumentData` —
  app ga nigde funkcionalno ne koristi (ni notifikacije ni prikaz hitnosti
  ne zavise od njega). Isti princip po kom se JMBG već odbacuje na izvoru.
  MRZ i dalje sadrži datum rođenja (deo ICAO standarda), samo se više ne
  mapira u model koji se šifruje i čuva. Drugim prolazom uklonjen i
  `createdAt` iz `DocumentData` — ista vrednost je već postojala kao plain
  SQLite kolona (invarijanta 3 je dopušta), pa je enkriptovana kopija bila
  čist višak bez funkcionalne koristi; `saveDocument` (`database.ts`) sad
  sam generiše `createdAt` za tu kolonu. V. "Minimizacija podataka" ispod.
- Sledeće: 7. lista/detalji → 8. lokalne notifikacije → 9. Firebase Auth +
  Firestore sync → 10. QR prenos ključa → 11. biometrija

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

## Obim (scope) — automatsko čitanje samo srpskih dokumenata

Automatsko MRZ čitanje podržava **isključivo srpska dokumenta** (pasoš TD3 i
lična karta TD1, `SRB`, numerički broj dokumenta). Svesna odluka, ne propust:
naziv i jezik aplikacije već sužavaju ciljnu grupu; projekat nije za objavljivanje
(diplomski rad); a strani dokumenti i dokumenti bez MRZ zone (vozačka, oružni
list, platne kartice) pokriveni su **manuelnim unosom** (modul 6).

Posledica: NE dodavati podršku za strane formate ni alfanumeričke brojeve
dokumenata bez eksplicitnog dogovora s autorom — to bi vratilo `0`↔`O`
dvosmislenost (v. Naučene lekcije).

## Tehnologije

| Deo | Paket |
|---|---|
| Framework | React Native + Expo SDK 57, TypeScript (strict) |
| Build | EAS dev build ili `npx expo run:android` (NE Expo Go — native paketi) |
| Kamera | `expo-camera` |
| OCR | `@react-native-ml-kit/text-recognition` (on-device) |
| MRZ parsing | `mrz` (npm) |
| Enkripcija | `react-native-quick-crypto` + `@craftzdog/react-native-buffer` |
| Ključ | `expo-secure-store` |
| Lokalna baza | `expo-sqlite` |
| Datumi (manuelni unos) | `@react-native-community/datetimepicker` |
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
src/services/mrzNormalizer.ts    čisti sirov OCR izlaz (K→<, dužina linije) PRE mrz parsiranja — bez native zavisnosti
src/services/documentValidation.ts  čista validacija manuelnog unosa (bez UI-ja) — obavezna polja, datumi, platna kartica
src/services/__tests__/          Jest testovi
src/screens/                     ekrani (uključujući privremene *TestScreen za verifikaciju na uređaju)
src/screens/ScanScreen.tsx       kamera (expo-camera) + ML Kit OCR → mrzNormalizer → mrz parsing → potvrda → saveDocument
src/screens/ManualEntryScreen.tsx  forma bez kamere/OCR-a → documentValidation → saveDocument (isti DocumentData kao ScanScreen)
__mocks__/                       Jest mape: quick-crypto→Node crypto, SecureStore→memorija, expo-sqlite→in-memory
```

## Komande

Aplikacija (root projekta):

```bash
npm test              # Jest: crypto + database + MRZ normalizacija + validacija manuelnog unosa (bez uređaja)
npx tsc --noEmit      # tipska provera app koda (testove proverava ts-jest)
npx expo-doctor       # provera konfiguracije
npx expo start --dev-client --tunnel    # razvoj na instaliranom dev buildu
```

Generator (`tools/mrz-generator/`) — **zaseban pod-projekat sa sopstvenim
`package.json` i Vitest-om**; glavni `npm test` ga NE pokriva, mora se
pokretati iz njegovog foldera:

```bash
cd tools/mrz-generator
npm test              # Vitest: check-digit, JMBG, expiry kategorije, generatori
npm run typecheck     # tsc --noEmit za generator
npm run generate -- 20 td3 --save=documents.json      # pasoši
npm run generate -- 20 td1 --save=documents-td1.json  # lične karte
```

CI (`.github/workflows/ci.yml`) pokreće OBA seta — app testove iz root-a i
generator testove kroz `working-directory: tools/mrz-generator`.

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
  parsiranja (višak odseći, manjak dopuniti `<`) — implementirano u
  `mrzNormalizer.ts`.
- Izmereno na uređaju (ML Kit, OCR-B): filler `<` se sporadično čita kao `K`,
  najčešće u nizovima na kraju polja. Normalizator to ispravlja pozicijski,
  NE agresivno — usamljeno `K` se dira samo ako mu NIJEDAN sused nije slovo
  (inače ostaje, jer imena u MRZ-u često stoje odmah uz `<<` separator, npr.
  "KATARINA", i doslovno pravilo "K uz bilo koji `<`" bi ih pokvarilo).
  Check-digit u `mrz` je krajnji sudija — bolje da parser javi grešku nego da
  normalizator pogodi pogrešno.
- `mrz` (npm) je ESM-only, bez CJS builda → Jest ga ne parsira po default-u
  (node_modules se ne transformišu). Rešeno ciljanim transform pravilom u
  `jest.config.js` (ts-jest sa `allowJs` samo za `node_modules/mrz/**.js`),
  bez menjanja transform-a za ostatak koda.
- ML Kit OCR + `mrz` rade pouzdano na realnom uređaju (dokazano POC-om) —
  ne menjati OCR stack.
- `mrz` paket NE pogađa vek datuma: `parseDate` u paketu samo validira
  YYMMDD (mesec 1-12, dan 1-31) i vraća sirov string, vek ostaje na
  pozivaocu. U `ScanScreen.tsx` (`yymmddToIso`): expiryDate je uvek 20xx
  (dokumenti koje app prati praktično ne postoje iz XX veka). Ako se ikad
  pojavi realan slučaj gde ovo pogrešno pogodi vek, prvo proveriti ovde pre
  menjanja mrzNormalizer-a — normalizator ne dira datume, samo linije.
- `expo-camera` zahteva config plugin u `app.json` (`cameraPermission` poruka)
  da bi native dozvola bila deklarisana — bez njega app pri `takePictureAsync`
  puca na uređaju bez jasne poruke. Dodavanje/izmena plugina u `app.json`
  je izmena native sloja → obavezan nov `expo run:android`/EAS build, JS/TS
  hot-reload preko Metro-a nije dovoljan.
- `mrz.parse()` vraća rezultat i kad `valid:false` (ne baca grešku) — provera
  mora biti eksplicitna (`if (!parsed.valid)`), ne oslanjati se na try/catch.
- `react-native-quick-crypto` kopira Node `crypto` API → zato Jest testovi
  rade na laptopu preko `moduleNameMapper`. Unit testovi dokazuju LOGIKU;
  native implementaciju dokazuje CryptoTestScreen na uređaju. Oba sloja ostaju.
- Isti princip za `expo-sqlite`: Jest testovi rade na mock bazi
  (`__mocks__/expo-sqlite.js`, in-memory), native implementaciju i
  PERZISTENCIJU PREKO RESTARTA dokazuje DatabaseTestScreen na uređaju
  (dugme "Učitaj postojeće" bez prethodnog Save-a nakon restarta app-a).
- `npx expo start --tunnel` ako QR/Metro ne radi preko lokalne mreže.

- **OCR meša `0` i `O`** kad broj dokumenta sadrži i slova i cifre. Otkriveno
  skeniranjem sintetičkih uzoraka: generator je pravio broj `SLQP0BG3R` (sa
  nulom), OCR čitao `SLQPOBG3R` (sa slovom O) → check-digit pada iako je kadar
  čist i OCR inače savršen. Rešeno na izvoru: generator pravi ISKLJUČIVO
  numeričke brojeve dokumenata (kako srpski pasoš i lična karta ionako rade).
  Normalizator NAMERNO ne pogađa `0`↔`O` — u broju dokumenta bi pogrešno
  pogađanje tiho proizvelo validan ali pogrešan dokument.
- Prva hipoteza za neuspelo čitanje odštampanih uzoraka bio je nedostatak
  OCR-B fonta. Pokazalo se da NIJE uzrok: posle prelaska na numeričke brojeve,
  uzorci se čitaju i odštampani običnim fontom. Font pomaže, ali pravi krivac
  je bila `0`↔`O` dvosmislenost. Dijagnozu je omogućio debug prikaz u
  ScanScreen (sirov OCR → kandidati → normalizovano → parsed) — zadržati ga.
- Kamera hvata širi kadar nego što se vidi u preview-u: pri skeniranju
  odštampanih uzoraka lako uđe susedni MRZ sa ivice papira i pokvari OCR.
  Skenirati jedan uzorak po jedan (ostale prekriti).
- `@react-native-community/datetimepicker` je, kao i `expo-camera`, native
  paket sa config pluginom — `npx expo install` ga sam dodao u `app.json`
  → isti zaključak kao za kameru: nov native build je obavezan ako je dev
  build instaliran pre modula 6, JS/TS hot-reload nije dovoljan.
- `mrz.parse()` javlja check-digit grešku tek POSLE što je korisnik dokument
  fotografisao; kod manuelnog unosa ekvivalentna zaštita ne postoji (korisnik
  ručno kuca, nema check-digit da uhvati typo). Zato je validacija stroža na
  mestima gde je greška najskuplja: platna kartica prihvata TAČNO 4 cifre
  (regex, ne "nije prazno") da se spreči greškom ukucan pun broj kartice.

## Model podataka

SQLite red (`documents` tabela, `src/services/database.ts`): `{ id, encrypted, createdAt }`.
`createdAt` je plain (epoch ms) — dozvoljeno invarijantom 3, služi za sortiranje
(`ORDER BY createdAt DESC` u `getAllDocuments`) i generiše ga sam `saveDocument`
(ne dolazi od pozivaoca). Firestore oblik zapisa (isti red + plain `userId` za
security rules, po istoj invarijanti 3) je van obima do modula 9 — nije još
implementiran, samo rezervisan.

`DocumentData` (sadržaj šifrata) — vidi `src/types.ts`:
`type` (pasos | licna_karta | vozacka | oruzni_list | platna_kartica | ostalo),
`documentNumber`, `firstName`, `lastName`, `nationality?`,
`expiryDate` (ISO string — osnova za notifikacije). `createdAt` NIJE deo ovog
objekta (v. "Minimizacija podataka") — postoji samo kao plain SQLite kolona.

## Minimizacija podataka

Čuva se SAMO ono što aplikaciji funkcionalno treba (podsetnici, prikaz) ili
što korisnik svesno unese — ne sve što izvor podataka (MRZ, forma) nudi.

- **JMBG**: MRZ lične karte ga ne sadrži direktno, ali se javlja unutar
  broja dokumenta/opcionih polja kod nekih formata — odbačen na izvoru
  (nikad se ne mapira u `DocumentData`).
- **birthDate**: MRZ (i pasoš i lična karta) ga sadrži kao standardno ICAO
  polje, ali app ga nigde funkcionalno ne koristi (notifikacije i prikaz
  hitnosti zavise isključivo od `expiryDate`) — odbačen na izvoru, i u
  `ScanScreen.tsx` mapiranju i u `ManualEntryScreen.tsx` formi.
- **platna_kartica**: broj kartice se čuva ISKLJUČIVO kao poslednje 4 cifre
  (regex u `documentValidation.ts`) — nikad pun broj, ni šifrovan.
- **createdAt**: metapodatak o vremenu unosa nije osetljiv sadržaj — invarijanta
  3 ga ionako dopušta kao plain SQLite kolonu, pa nije postojao razlog da ista
  vrednost uđe i u šifrat. Uklonjen iz `DocumentData`; `saveDocument`
  (`database.ts`) sam generiše `createdAt` (`Date.now()`) direktno za tu
  kolonu. Isti princip kao `birthDate`.

Princip: dodavanje polja u `DocumentData` je svesna odluka, ne "MRZ/forma ga
ima pa ga čuvamo".

## Posebni zahtevi

- **Nikad ne koristiti prave lične podatke** — ni u testovima, ni u primerima,
  ni u fixture podacima. Modul 4 pravi generator sintetičkih srpskih MRZ
  zapisa (nepostojeći ljudi, validni check-digitovi po ICAO 9303, težine
  7-3-1, uključujući strukturno validan ali nasumičan JMBG — v.
  `tools/mrz-generator/src/jmbg.ts`); koristiti očigledno izmišljene podatke
  (MARKO PETROVIĆ i sl.) svuda drugde u kodu.
- Generator će služiti i za evaluaciju u radu (OCR pouzdanost na većem uzorku,
  uključujući namerno oštećene varijante).