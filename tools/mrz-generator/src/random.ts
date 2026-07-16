const DOCUMENT_NUMBER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomItem<T>(items: readonly T[]): T {
  const item = items[randomInt(0, items.length - 1)];
  if (item === undefined) throw new Error("randomItem: prazna lista");
  return item;
}

export function randomDocumentNumber(length = 9): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += randomItem(DOCUMENT_NUMBER_ALPHABET);
  }
  return result;
}

/** Datum rođenja punoletne osobe (podrazumevano 18-75 godina), bez ivičnih slučajeva dužine meseca. */
export function randomBirthDate(minAge = 18, maxAge = 75): Date {
  const now = new Date();
  const age = randomInt(minAge, maxAge);
  const month = randomInt(0, 11);
  const day = randomInt(1, 28);
  return new Date(Date.UTC(now.getUTCFullYear() - age, month, day));
}

/** Fisher-Yates šafl — ne menja ulazni niz. */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
