# mrz-generator

Razvojni CLI alat za generisanje **sintetičkih** (izmišljenih) MRZ (Machine
Readable Zone) zapisa — koristi se za testiranje OCR/MRZ parsing pipeline-a
mobilne aplikacije i za evaluaciju u diplomskom radu. **Nije deo mobilne
aplikacije** — samostalan Node.js/TypeScript projekat sa sopstvenim
`package.json`.

Generiše **isključivo srpska dokumenta** — pasoš (TD3) i ličnu kartu (TD1) —
za nepostojeće ljude (imena iz fiksne liste, npr. `MARKO PETROVIĆ`), sa
numeričkim brojevima dokumenata i strukturno validnim JMBG-om. Svi
check-digitovi su ISPRAVNO izračunati po ICAO 9303 standardu — svaki zapis se
odmah proverava paketom [`mrz`](https://www.npmjs.com/package/mrz)
(`valid: true`).

## Instalacija

```bash
cd tools/mrz-generator
npm install
```

## Pokretanje

```bash
npm run generate -- <broj> [format] [opcije]
```

| Argument/opcija | Opis |
|---|---|
| `<broj>` | Broj zapisa za generisanje (obavezno) |
| `[format]` | `td3` (pasoš, 2×44, podrazumevano) ili `td1` (lična karta, 3×30) |
| `--save=<putanja>` | Snimi rezultate u fajl — `.json` (identitet + sirove linije) ili `.txt` (samo sirove linije) |
| `--corrupt=<n>` | Dodatno generiši `n` NAMERNO OŠTEĆENIH (nevalidnih) varijanti, za testiranje robusnosti OCR-a |
| `--expiry=<spec>` | Kategorija datuma isteka — v. odeljak ispod (podrazumevano `valid`) |
| `--help` | Prikaz pomoći |

Primeri:

```bash
npm run generate -- 20
npm run generate -- 10 td1 --save=out.json
npm run generate -- 5 td3 --corrupt=5 --save=out.txt
npm run generate -- 20 td3 --expiry=valid:15,soon:3,expired:2
```

Na kraju ispisa stoji rezime, npr. `20/20 validnih zapisa`. Ako neki zapis ne
prođe samoverifikaciju, to znači bug u generatoru — greška se ispisuje
glasno, a proces završava sa exit kodom 1.

Testovi: `npm test` (vitest). Provera tipova: `npm run typecheck`.

## ICAO 9303 check-digit algoritam

Svaki karakter MRZ zone se mapira u brojčanu vrednost:

- cifre `0`-`9` → `0`-`9`
- slova `A`-`Z` → `10`-`35` (A=10, B=11, ..., Z=35)
- filler `<` → `0`

Vrednosti se množe cikličnom težinom **7-3-1-7-3-1...** (počev od prvog
karaktera polja), saberu, i check-digit je ostatak te sume po modulu 10:

```
check_digit = (Σ value(char_i) × weight(i mod 3)) mod 10,  weights = [7, 3, 1]
```

Implementacija: [`src/checkDigit.ts`](src/checkDigit.ts) (`computeCheckDigit`).

Primer (broj dokumenta `L898902C3`, referentni primer iz ICAO Doc 9303 Part
4 Appendix A):

| karakter | L | 8 | 9 | 8 | 9 | 0 | 2 | C | 3 |
|---|---|---|---|---|---|---|---|---|---|
| vrednost | 21 | 8 | 9 | 8 | 9 | 0 | 2 | 12 | 3 |
| težina | 7 | 3 | 1 | 7 | 3 | 1 | 7 | 3 | 1 |
| proizvod | 147 | 24 | 9 | 56 | 27 | 0 | 14 | 36 | 3 |

Suma = 316, `316 mod 10 = 6` → check-digit **6** (poklapa se sa specifikacijom).

Check-digit se računa nezavisno za četiri polja:

1. **Broj dokumenta**
2. **Datum rođenja** (YYMMDD)
3. **Datum isteka** (YYMMDD)
4. **Kompozitni (composite)** check-digit — računa se nad konkatenacijom više
   polja (broj dokumenta+CD, datum rođenja+CD, datum isteka+CD+opciona
   polja+CD); tačan raspon zavisi od formata (TD3 vs TD1) — v. komentare u
   [`src/td3.ts`](src/td3.ts) i [`src/td1.ts`](src/td1.ts).

Testovi u [`src/__tests__/checkDigit.test.ts`](src/__tests__/checkDigit.test.ts)
proveravaju algoritam nad poznatim ICAO 9303 referentnim primerom.

## Formati — isključivo srpska dokumenta

Generator NE bira nacionalnost nasumično — svaki zapis je srpski pasoš ili
srpska lična karta (`nationality: "SRB"` je konstanta u `src/identity.ts`,
ne nasumičan izbor). Brojevi dokumenata su čisto numerički (rešava OCR
0/O dvosmislenost), a imena se transliterišu iz srpske dijakritike u MRZ
A-Z opseg (`Č`/`Ć`→`C`, `Đ`→`DJ`, `Š`→`S`, `Ž`→`Z`; v.
[`src/transliterate.ts`](src/transliterate.ts)).

Fiksan primer korišćen u [`src/__tests__/generators.test.ts`](src/__tests__/generators.test.ts)
(identitet `MILOŠ ĐORĐEVIĆ`, NE prava osoba — bira transliteraciju Đ→DJ i Š→S
namerno):

### TD3 — pasoš (2 linije × 44 karaktera)

```
Red 1: "P<SRB" + PREZIME + "<<" + IME + fileri do 44
Red 2: broj pasoša(9, numerički) + CD + "SRB" + rođenje(YYMMDD) + CD
       + pol(M/F) + istek(YYMMDD) + CD + JMBG(13) + "<" + CD + kompozitni CD
```

```
P<SRBDJORDJEVIC<<MILOS<<<<<<<<<<<<<<<<<<<<<<
1234567897SRB9005178M30051761705990710012<66
```

### TD1 — lična karta (3 linije × 30 karaktera)

Raspon fillera i tačna formula kompozitnog check-digita su potvrđeni protiv
`node_modules/mrz` izvora (`td1Fields.js`), ne skraćeni nagađanjem — v.
komentar na vrhu [`src/td1.ts`](src/td1.ts).

```
Red 1: "ID" + "SRB" + registarski broj(9, numerički) + CD
       + opciono polje(15) = JMBG(13) + 2 filler karaktera
Red 2: rođenje(YYMMDD) + CD + pol + istek(YYMMDD) + CD + "SRB"
       + opciono polje(11, filler) + kompozitni CD
Red 3: PREZIME + "<<" + IME + fileri do 30
```

```
IDSRB12345678971705990710012<<
9005178M3005176SRB<<<<<<<<<<<8
DJORDJEVIC<<MILOS<<<<<<<<<<<<<
```

Tačan raspored polja (pozicije, dužine, formula za kompozitni check-digit) je
dokumentovan komentarima na vrhu [`src/td3.ts`](src/td3.ts) i
[`src/td1.ts`](src/td1.ts).

## JMBG (Jedinstveni matični broj građana)

Implementacija: [`src/jmbg.ts`](src/jmbg.ts). Format — 13 cifara,
`DDMMGGG + RR + BBB + K`:

| Deo | Dužina | Značenje |
|---|---|---|
| `DDMMGGG` | 7 | datum rođenja — dan, mesec, **poslednje tri cifre godine** (1958 → `958`); MORA odgovarati generisanom `birthDate` |
| `RR` | 2 | regionalna oznaka mesta rođenja — nasumično iz `70`-`89` (Srbija: `70`-`79` centralna Srbija, `80`-`89` Vojvodina) |
| `BBB` | 3 | redni broj rođenja istog dana u regionu — po konvenciji `000`-`499` muški, `500`-`999` ženski |
| `K` | 1 | kontrolna cifra — v. ispod |

**Kontrolna cifra (K) NIJE isti algoritam kao ICAO MRZ check-digit** — to je
zaseban mod-11 postupak nad prvih 12 cifara:

1. Uparuju se cifre 1&7, 2&8, 3&9, 4&10, 5&11, 6&12.
2. Svaki par se sabere i pomnoži težinom `7,6,5,4,3,2` (redom).
3. Proizvodi se saberu, uzme se ostatak po modulu 11.
4. `K = 11 - ostatak`; ako je `K ≥ 10` (ostatak je 0 ili 1), `K = 0`.

Algoritam i primer su verifikovani prema javno dostupnom objašnjenju formule
([opsteobrazovanje.in.rs — JMBG](https://www.opsteobrazovanje.in.rs/zanimljivo/jmbg/)):
generički primer računa za osobu rođenu 05.12.1981. u Beogradu daje
`JMBG 0512981717776` — kontrolna cifra `6` za prvih 12 cifara
`051298171777`. Ovaj primer (ilustracija algoritma, ne prava osoba) je
tačno test-slučaj u [`src/__tests__/jmbg.test.ts`](src/__tests__/jmbg.test.ts).

Regionalne oznake (71=Beograd, 72=Šumadija, 73=Niš, 80=Novi Sad, 81=Sombor,
82=Subotica, ...) potvrđene prema javno dostupnom pregledu
([Dnevni list Danas — šifre regiona](https://www.danas.rs/zivot/sta-predstavlja-svaka-cifra-u-vasem-jmbg-u/)).

## Namerno oštećene varijante (`--corrupt`)

Za evaluaciju robusnosti OCR/parsing-a u radu, `--corrupt=<n>` generiše `n`
dodatnih zapisa sa jednom od sledećih namernih grešaka
([`src/corrupt.ts`](src/corrupt.ts)):

- **flip-char** — nasumičan karakter zamenjen drugim (narušava check-digit)
- **ocr-confusion** — zamena karaktera koji OCR često pobrka (`0`/`O`,
  `1`/`I`, `8`/`B`, `5`/`S`, `2`/`Z`)
- **truncate-line** — linija skraćena za 1 karakter (pogrešna dužina)
- **extend-line** — linija produžena za 1 karakter (pogrešna dužina)

Ovi zapisi su OČEKIVANO nevalidni i jasno su označeni u ispisu i u snimljenom
fajlu (`corrupted` niz u JSON-u, odvojena sekcija u TXT-u).

## Kategorije datuma isteka (`--expiry`)

Datum isteka NE utiče na formalnu validnost MRZ-a (check-digit i dužina
linija su ispravni bez obzira na to da li je datum u prošlosti ili
budućnosti) — utiče samo na semantiku roka, što je bitno za testiranje praga
lokalnih notifikacija (v. `CLAUDE.md`, modul "lokalne notifikacije").
Implementacija: [`src/expiry.ts`](src/expiry.ts).

| Kategorija | Datum isteka | Namena |
|---|---|---|
| `valid` (podrazumevano) | za 2-9 godina od danas | normalan, važeći dokument |
| `soon` | za 7-30 dana od danas | blizu praga notifikacije |
| `expired` | pre 1-60 dana | već istekao dokument |

Dva oblika `--expiry` specifikacije:

```bash
# ista kategorija za svih N zapisa
npm run generate -- 10 --expiry=soon

# eksplicitna raspodela — zbir MORA biti jednak <broju> zapisa;
# redosled zapisa je nasumično promešan
npm run generate -- 20 --expiry=valid:15,soon:3,expired:2
```

Ako izostavljen, `--expiry` je podrazumevano `valid` za sve zapise (kao i
pre uvođenja ove opcije). Kategorija svakog zapisa se ispisuje u konzoli
(`istek: soon`) i snima u `expiryCategory` polje u JSON izlazu.

## Napomena o bezbednosti

Generator NIKAD ne koristi podatke stvarnih osoba — imena su iz fiksne liste
očigledno izmišljenih (v. [`src/identity.ts`](src/identity.ts)), brojevi
dokumenata su nasumični, a JMBG je strukturno validan (ispravna kontrolna
cifra, DDMMGGG odgovara generisanom datumu rođenja) ali NIJE dodeljen
stvarnoj osobi — RR (region) i BBB (redni broj) su nasumični, ne stvarni
matični podaci. Ovo pravilo važi za sve module projekta (v. `CLAUDE.md` u
korenu repozitorijuma).
