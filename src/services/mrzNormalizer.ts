/**
 * mrzNormalizer.ts — čisti sirov OCR izlaz pre nego što ga preuzme `mrz` paket.
 *
 * `mrz` zahteva TAČNU dužinu linija (TD1=30, TD3=44) i tačan filler karakter
 * `<`. ML Kit OCR (izmereno na uređaju) sistematski greši na dva mesta:
 *  - filler `<` se povremeno pročita kao `K` (najčešće u nizovima na kraju
 *    polja, npr. posle imena),
 *  - dužina linije skoro nikad nije tačna (razmaci se uvuku, karakteri
 *    nedostaju ili se udvoje).
 *
 * Cilj je popraviti ono što je SIGURNO OCR greška, a ostaviti nejasne
 * slučajeve netaknutim — check-digit u `mrz` paketu je krajnji validator,
 * bolje da parser javi grešku nego da normalizator "popravi" u pogrešnu
 * vrednost (vidi CLAUDE.md).
 */

export type MrzDocumentType = 'TD1' | 'TD3';

/** Layout MRZ zapisa po ICAO 9303: broj linija i tačna dužina svake. */
const MRZ_LAYOUT: Record<MrzDocumentType, { lineCount: number; lineLength: number }> = {
  TD3: { lineCount: 2, lineLength: 44 },
  TD1: { lineCount: 3, lineLength: 30 },
};

/** Vrsta izmene koju je normalizator napravio nad jednom linijom. */
export type MrzChangeKind =
  | 'razmak-uklonjen'
  | 'filler-niz'
  | 'filler-uz-medju'
  | 'linija-skracena'
  | 'linija-dopunjena';

/** Jedna zabeležena izmena — za debug i za evaluaciju u radu. */
export interface MrzNormalizeChange {
  /** Indeks linije (0-bazirano) u kojoj je izmena napravljena. */
  lineIndex: number;
  kind: MrzChangeKind;
  /** Broj promenjenih/dodatih/uklonjenih karaktera. */
  count: number;
}

export interface MrzNormalizeResult {
  /** Očišćene linije, tačne dužine, spremne za `mrz` paket. */
  lines: string[];
  type: MrzDocumentType;
  changes: MrzNormalizeChange[];
  /** Ukupan broj izmenjenih karaktera (zbir change.count) — brz pokazatelj "prljavosti". */
  totalChanges: number;
}

/** Odredi tip MRZ dokumenta po broju sirovih linija (TD3=2, TD1=3). */
function inferDocumentType(rawLines: string[]): MrzDocumentType {
  if (rawLines.length === 2) return 'TD3';
  if (rawLines.length === 3) return 'TD1';
  throw new Error(
    `Ne mogu da odredim tip MRZ dokumenta iz ${rawLines.length} linija — prosledi tip eksplicitno.`,
  );
}

/** Ukloni sve razmake (i druge whitespace karaktere) iz linije. */
function stripSpaces(line: string): { result: string; removed: number } {
  const result = line.replace(/\s+/g, '');
  return { result, removed: line.length - result.length };
}

/** Nizove od 2+ uzastopnih `K` pretvori u isto toliko `<` (filler nizovi). */
function replaceFillerRuns(line: string): { result: string; count: number } {
  let count = 0;
  const result = line.replace(/K{2,}/g, (match) => {
    count += match.length;
    return '<'.repeat(match.length);
  });
  return { result, count };
}

function isLetter(char: string | undefined): boolean {
  return char != null && char >= 'A' && char <= 'Z';
}

/**
 * Usamljeno `K` neposredno uz postojeći `<` tretiraj kao filler — ALI samo
 * ako mu NIJEDAN sused nije slovo. Ime u MRZ polju je uvek uz separator
 * `<<` ili uz padding `<`, pa slovo K na početku/kraju imena (npr.
 * "<<KATARINA", "MARK<<<<") ima slovo na jednoj strani — to je "usamljeno K
 * između (bar) jednog slova" i ostaje netaknuto, čak i kad mu je druga
 * strana `<`. Filler-K se prepoznaje po tome što su MU OBE strane
 * ne-slovo (npr. duboko u nizu fillera, ili na kraju linije).
 *
 * Odluke se donose na osnovu snapshot-a linije PRE ove izmene (ne kaskadno),
 * da rezultat ne zavisi od redosleda obilaska.
 */
function replaceAdjacentSingleK(line: string): { result: string; count: number } {
  const chars = line.split('');
  const snapshot = line;
  let count = 0;
  for (let i = 0; i < chars.length; i++) {
    if (snapshot[i] !== 'K') continue;
    const prev = i > 0 ? snapshot[i - 1] : undefined;
    const next = i < snapshot.length - 1 ? snapshot[i + 1] : undefined;
    if (isLetter(prev) || isLetter(next)) continue;
    if (prev === '<' || next === '<') {
      chars[i] = '<';
      count++;
    }
  }
  return { result: chars.join(''), count };
}

/** Dovede liniju na tačnu dužinu: višak s desna odseci, manjak dopuni `<`. */
function normalizeLength(
  line: string,
  targetLength: number,
): { result: string; kind: MrzChangeKind | null; count: number } {
  if (line.length > targetLength) {
    return { result: line.slice(0, targetLength), kind: 'linija-skracena', count: line.length - targetLength };
  }
  if (line.length < targetLength) {
    const missing = targetLength - line.length;
    return { result: line + '<'.repeat(missing), kind: 'linija-dopunjena', count: missing };
  }
  return { result: line, kind: null, count: 0 };
}

/**
 * Normalizuje sirove OCR linije MRZ zone u oblik koji `mrz` paket može da
 * parsira. Tip dokumenta se ili prosledi eksplicitno, ili se pogodi po broju
 * linija (2 → TD3, 3 → TD1).
 */
export function normalizeMrzLines(rawLines: string[], type?: MrzDocumentType): MrzNormalizeResult {
  const docType = type ?? inferDocumentType(rawLines);
  const { lineLength } = MRZ_LAYOUT[docType];

  const changes: MrzNormalizeChange[] = [];
  const lines = rawLines.map((rawLine, lineIndex) => {
    const spaces = stripSpaces(rawLine);
    if (spaces.removed > 0) {
      changes.push({ lineIndex, kind: 'razmak-uklonjen', count: spaces.removed });
    }

    const runs = replaceFillerRuns(spaces.result);
    if (runs.count > 0) {
      changes.push({ lineIndex, kind: 'filler-niz', count: runs.count });
    }

    const adjacent = replaceAdjacentSingleK(runs.result);
    if (adjacent.count > 0) {
      changes.push({ lineIndex, kind: 'filler-uz-medju', count: adjacent.count });
    }

    const length = normalizeLength(adjacent.result, lineLength);
    if (length.kind != null) {
      changes.push({ lineIndex, kind: length.kind, count: length.count });
    }

    return length.result;
  });

  const totalChanges = changes.reduce((sum, change) => sum + change.count, 0);
  return { lines, type: docType, changes, totalChanges };
}
