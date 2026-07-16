import { randomInt, shuffle } from "./random.js";

export type ExpiryCategory = "valid" | "soon" | "expired";

export const EXPIRY_CATEGORIES: readonly ExpiryCategory[] = ["valid", "soon", "expired"];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Datum isteka dokumenta prema kategoriji — koristi se za testiranje praga
 * lokalnih notifikacija (v. CLAUDE.md, "lokalne notifikacije" modul):
 *
 * - "valid"   — ističe za 2-9 godina od danas (normalan, važeći dokument)
 * - "soon"    — ističe za 7-30 dana od danas (blizu praga notifikacije)
 * - "expired" — istekao pre 1-60 dana (već istekao dokument)
 *
 * Check-digit i formalna validnost MRZ-a ne zavise od toga da li je datum
 * isteka u prošlosti ili budućnosti — ovo utiče samo na semantiku roka.
 */
export function randomExpiryDate(category: ExpiryCategory = "valid"): Date {
  const now = Date.now();
  switch (category) {
    case "valid": {
      const years = randomInt(2, 9);
      const month = randomInt(0, 11);
      const day = randomInt(1, 28);
      return new Date(Date.UTC(new Date(now).getUTCFullYear() + years, month, day));
    }
    case "soon": {
      const days = randomInt(7, 30);
      return new Date(now + days * DAY_MS);
    }
    case "expired": {
      const days = randomInt(1, 60);
      return new Date(now - days * DAY_MS);
    }
  }
}

function isExpiryCategory(value: string): value is ExpiryCategory {
  return (EXPIRY_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Parsira CLI specifikaciju kategorija isteka u niz od `count` kategorija
 * (jedna po zapisu, redosled nasumično promešan).
 *
 * Prihvata dva oblika:
 * - jedna kategorija za sve zapise, npr. "soon"
 * - eksplicitna raspodela po broju zapisa, npr. "valid:15,soon:3,expired:2"
 *   — zbir mora biti jednak `count`
 */
export function parseExpirySpec(spec: string, count: number): ExpiryCategory[] {
  if (isExpiryCategory(spec)) {
    return new Array<ExpiryCategory>(count).fill(spec);
  }

  const counts: Partial<Record<ExpiryCategory, number>> = {};
  for (const part of spec.split(",")) {
    const [name, countStr] = part.split(":");
    if (!name || countStr === undefined || !isExpiryCategory(name)) {
      throw new Error(`Neispravna kategorija u --expiry: "${part}". Dozvoljeno: ${EXPIRY_CATEGORIES.join(", ")}.`);
    }
    const n = Number(countStr);
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`Neispravan broj u --expiry: "${part}"`);
    }
    counts[name] = (counts[name] ?? 0) + n;
  }

  const total = Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0);
  if (total !== count) {
    throw new Error(`Zbir kategorija u --expiry (${total}) mora biti jednak broju zapisa (${count}).`);
  }

  const result: ExpiryCategory[] = [];
  for (const category of EXPIRY_CATEGORIES) {
    const n = counts[category] ?? 0;
    for (let i = 0; i < n; i++) result.push(category);
  }
  return shuffle(result);
}
