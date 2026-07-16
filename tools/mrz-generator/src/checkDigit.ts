/**
 * ICAO 9303 check-digit algoritam.
 *
 * Svaki karakter se mapira u vrednost (cifre 0-9 → 0-9, slova A-Z → 10-35,
 * '<' → 0), množi se cikličnom težinom 7-3-1-7-3-1... počev od prvog
 * karaktera stringa, i suma po modulu 10 daje check-digit (0-9).
 * Isti algoritam se koristi za broj dokumenta, datum rođenja, datum isteka
 * i kompozitni (composite) check-digit — jedina razlika je koji se ulazni
 * string prosleđuje.
 */

const WEIGHTS = [7, 3, 1] as const;

function charValue(char: string): number {
  if (char === "<") return 0;
  if (char >= "0" && char <= "9") return char.charCodeAt(0) - "0".charCodeAt(0);
  if (char >= "A" && char <= "Z") return char.charCodeAt(0) - "A".charCodeAt(0) + 10;
  throw new Error(`Nevalidan MRZ karakter za check-digit: "${char}"`);
}

export function computeCheckDigit(input: string): number {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const weight = WEIGHTS[i % WEIGHTS.length]!;
    sum += charValue(input[i]!) * weight;
  }
  return sum % 10;
}

export function checkDigitChar(input: string): string {
  return String(computeCheckDigit(input));
}
