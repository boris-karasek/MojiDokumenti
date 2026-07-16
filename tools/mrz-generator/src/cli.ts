import { parse as parseMRZ } from "mrz";
import { corruptLines } from "./corrupt.js";
import type { ExpiryCategory } from "./expiry.js";
import { parseExpirySpec } from "./expiry.js";
import { generateRandomIdentity } from "./identity.js";
import type { CorruptedRecord, GeneratedRecord } from "./output.js";
import { saveResults } from "./output.js";
import { generateTD1 } from "./td1.js";
import { generateTD3 } from "./td3.js";

type Format = "td3" | "td1";

interface CliOptions {
  count: number;
  format: Format;
  savePath?: string;
  corruptCount: number;
  expiryCategories: ExpiryCategory[];
}

const HELP = `Generator sintetičkih MRZ zapisa (razvojni alat, ne deo mobilne aplikacije)

Upotreba:
  npm run generate -- <broj> [format] [opcije]

Argumenti:
  <broj>              Broj MRZ zapisa za generisanje (obavezno)
  [format]             "td3" (pasoš, podrazumevano) ili "td1" (lična karta)

Opcije:
  --save=<putanja>     Snimi rezultate u fajl (.json ili .txt, prema ekstenziji)
  --corrupt=<broj>      Dodatno generiši N namerno oštećenih (nevalidnih) varijanti
  --expiry=<spec>       Kategorija datuma isteka — v. ispod (podrazumevano "valid")
  --help               Prikaz ove poruke

Kategorije datuma isteka (--expiry):
  valid     ističe za 2-9 godina od danas (podrazumevano)
  soon      ističe za 7-30 dana od danas (prag notifikacije)
  expired   istekao pre 1-60 dana

  Zadaj jednu kategoriju za sve zapise (--expiry=soon), ili eksplicitnu
  raspodelu čiji zbir mora biti jednak <broju> (--expiry=valid:15,soon:3,expired:2).

Primeri:
  npm run generate -- 20
  npm run generate -- 10 td1 --save=out.json
  npm run generate -- 5 td3 --corrupt=5 --save=out.txt
  npm run generate -- 20 td3 --expiry=valid:15,soon:3,expired:2
`;

function parseArgs(argv: string[]): CliOptions {
  if (argv.includes("--help")) {
    console.log(HELP);
    process.exit(0);
  }

  const positional = argv.filter((a) => !a.startsWith("--"));
  const flags = argv.filter((a) => a.startsWith("--"));

  if (positional.length === 0) {
    console.log(HELP);
    throw new Error("Nedostaje obavezan argument <broj>.");
  }

  const count = Number(positional[0]);
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`Neispravan broj zapisa: "${positional[0]}". Mora biti pozitivan ceo broj.`);
  }

  const formatArg = positional[1]?.toLowerCase();
  if (formatArg && formatArg !== "td3" && formatArg !== "td1") {
    throw new Error(`Nepoznat format: "${positional[1]}". Koristi "td3" ili "td1".`);
  }
  const format: Format = formatArg === "td1" ? "td1" : "td3";

  let savePath: string | undefined;
  let corruptCount = 0;
  let expirySpec = "valid";
  for (const flag of flags) {
    if (flag.startsWith("--save=")) {
      savePath = flag.slice("--save=".length);
    } else if (flag.startsWith("--corrupt=")) {
      const value = Number(flag.slice("--corrupt=".length));
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Neispravna vrednost za --corrupt: "${flag}"`);
      }
      corruptCount = value;
    } else if (flag.startsWith("--expiry=")) {
      expirySpec = flag.slice("--expiry=".length);
    } else {
      throw new Error(`Nepoznata opcija: "${flag}"`);
    }
  }

  const expiryCategories = parseExpirySpec(expirySpec, count);

  return { count, format, savePath, corruptCount, expiryCategories };
}

function generateLines(format: Format): string[] {
  const identity = generateRandomIdentity();
  return format === "td3" ? generateTD3(identity).lines : generateTD1(identity).lines;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  const records: GeneratedRecord[] = [];
  let validCount = 0;

  for (let i = 0; i < options.count; i++) {
    const expiryCategory = options.expiryCategories[i]!;
    const identity = generateRandomIdentity(expiryCategory);
    const { lines } = options.format === "td3" ? generateTD3(identity) : generateTD1(identity);
    const result = parseMRZ(lines);

    console.log(`--- Zapis ${i + 1}/${options.count} (${options.format.toUpperCase()}, istek: ${expiryCategory}) ---`);
    for (const line of lines) console.log(line);

    if (result.valid) {
      validCount++;
      console.log("✓ validan\n");
    } else {
      const errors = result.details.filter((d) => !d.valid).map((d) => `${d.label}: ${d.error}`);
      console.error(`✗ NEVALIDAN — BUG U GENERATORU:\n  ${errors.join("\n  ")}\n`);
    }

    records.push({ identity, expiryCategory, lines, valid: result.valid });
  }

  console.log(`\n${validCount}/${options.count} validnih zapisa`);
  if (validCount !== options.count) {
    process.exitCode = 1;
  }

  const corrupted: CorruptedRecord[] = [];
  if (options.corruptCount > 0) {
    console.log(`\n=== Generisanje ${options.corruptCount} namerno oštećenih (nevalidnih) uzoraka ===\n`);
    for (let i = 0; i < options.corruptCount; i++) {
      const lines = generateLines(options.format);
      const corrupt = corruptLines(lines);

      let valid: boolean;
      try {
        valid = parseMRZ(corrupt.lines).valid;
      } catch {
        valid = false;
      }

      console.log(`--- Oštećeni uzorak ${i + 1}/${options.corruptCount} (${corrupt.corruption}) ---`);
      console.log(corrupt.description);
      for (const line of corrupt.lines) console.log(line);
      console.log(valid ? "⚠ i dalje validan (redak slučaj — check-digit se poklopio)\n" : "✓ nevalidan, kao što se očekuje\n");

      corrupted.push({ ...corrupt, valid });
    }
  }

  if (options.savePath) {
    saveResults(options.savePath, records, corrupted);
    console.log(`Snimljeno u: ${options.savePath}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Greška: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
