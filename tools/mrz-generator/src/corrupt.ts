import { randomInt, randomItem } from "./random.js";

export type CorruptionType = "flip-char" | "ocr-confusion" | "truncate-line" | "extend-line";

export interface CorruptedMRZ {
  lines: string[];
  corruption: CorruptionType;
  description: string;
}

/** Parovi karaktera koje OCR najčešće pobrka (vizuelna sličnost). */
const OCR_CONFUSIONS: Record<string, string> = {
  "0": "O",
  O: "0",
  "1": "I",
  I: "1",
  "8": "B",
  B: "8",
  "5": "S",
  S: "5",
  "2": "Z",
  Z: "2",
};

const CORRUPTION_TYPES: readonly CorruptionType[] = ["flip-char", "ocr-confusion", "truncate-line", "extend-line"];

/**
 * Napravi NAMERNO OŠTEĆENU varijantu validnih MRZ linija — za evaluaciju
 * robusnosti OCR/parsing-a. Rezultat je očekivano nevalidan (pogrešan
 * check-digit ili pogrešna dužina linije).
 */
export function corruptLines(lines: readonly string[]): CorruptedMRZ {
  const corrupted = [...lines];
  const lineIndex = randomInt(0, corrupted.length - 1);
  const line = corrupted[lineIndex]!;
  const type = randomItem(CORRUPTION_TYPES);

  switch (type) {
    case "flip-char": {
      const pos = randomInt(0, line.length - 1);
      const original = line[pos]!;
      const replacement = original === "X" ? "Y" : "X";
      corrupted[lineIndex] = line.slice(0, pos) + replacement + line.slice(pos + 1);
      return {
        lines: corrupted,
        corruption: type,
        description: `Nasumično izmenjen karakter na poziciji ${pos + 1} u liniji ${lineIndex + 1} (${original} → ${replacement})`,
      };
    }
    case "ocr-confusion": {
      const candidates = [...line].map((c, i) => ({ c, i })).filter(({ c }) => c in OCR_CONFUSIONS);
      if (candidates.length === 0) return corruptLines(lines);
      const { c, i } = randomItem(candidates);
      const replacement = OCR_CONFUSIONS[c]!;
      corrupted[lineIndex] = line.slice(0, i) + replacement + line.slice(i + 1);
      return {
        lines: corrupted,
        corruption: type,
        description: `Simulirana OCR zabuna na poziciji ${i + 1} u liniji ${lineIndex + 1} (${c} → ${replacement})`,
      };
    }
    case "truncate-line": {
      corrupted[lineIndex] = line.slice(0, -1);
      return {
        lines: corrupted,
        corruption: type,
        description: `Linija ${lineIndex + 1} skraćena za 1 karakter (simulira OCR koji je preskočio karakter)`,
      };
    }
    case "extend-line": {
      corrupted[lineIndex] = line + "<";
      return {
        lines: corrupted,
        corruption: type,
        description: `Linija ${lineIndex + 1} produžena za 1 karakter (pogrešna dužina)`,
      };
    }
  }
}
