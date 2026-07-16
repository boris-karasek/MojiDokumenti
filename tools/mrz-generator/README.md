# mrz-generator

Razvojni CLI alat za generisanje **sintetičkih** (izmišljenih) MRZ (Machine
Readable Zone) zapisa — koristi se za testiranje OCR/MRZ parsing pipeline-a
mobilne aplikacije i za evaluaciju u diplomskom radu. **Nije deo mobilne
aplikacije** — samostalan Node.js/TypeScript projekat sa sopstvenim
`package.json`.

Generiše nepostojeće ljude (imena iz fiksne liste, npr. `MARKO PETROVIC`) i
nasumične brojeve dokumenata, ali sa ISPRAVNO izračunatim check-digitovima po
ICAO 9303 standardu — svaki zapis se odmah proverava paketom
[`mrz`](https://www.npmjs.com/package/mrz) (`valid: true`).

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

## Formati

### TD3 — pasoš (2 linije × 44 karaktera)

Referentni primer iz ICAO Doc 9303 Part 4 Appendix A (koristi se u testovima
check-digit algoritma, v. gore). Napomena: zemlja `UTO` je fiktivna zemlja iz
same specifikacije i `mrz` paket je ne prepoznaje kao važeći ISO kod — generator
zato koristi samo stvarne ISO 3166-1 alpha-3 kodove (v. `src/identity.ts`).

```
P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<
L898902C36UTO7408122F1204159ZE184226B<<<<<10
```

Primer stvarno generisanog i samoverifikovanog zapisa:

```
P<MKDPETROVIC<<TAMARA<<<<<<<<<<<<<<<<<<<<<<<
QH6UWMS0W5MKD8206222F2701172<<<<<<<<<<<<<<08
```

### TD1 — lična karta (3 linije × 30 karaktera)

Primer stvarno generisanog i samoverifikovanog zapisa:

```
I<AUTOKCGGOV2I5<<<<<<<<<<<<<<<
7402049F2910172AUT<<<<<<<<<<<4
NIKOLIC<<MILICA<<<<<<<<<<<<<<<
```

Tačan raspored polja (pozicije, dužine, formula za kompozitni check-digit) je
dokumentovan komentarima na vrhu [`src/td3.ts`](src/td3.ts) i
[`src/td1.ts`](src/td1.ts).

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
očigledno izmišljenih (v. [`src/identity.ts`](src/identity.ts)), a brojevi
dokumenata su nasumični. Ovo pravilo važi za sve module projekta (v.
`CLAUDE.md` u korenu repozitorijuma).
