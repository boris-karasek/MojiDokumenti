import { writeFileSync } from "node:fs";
import { extname } from "node:path";
import type { CorruptedMRZ } from "./corrupt.js";
import type { ExpiryCategory } from "./expiry.js";
import type { SyntheticIdentity } from "./identity.js";

export interface GeneratedRecord {
  identity: SyntheticIdentity;
  expiryCategory: ExpiryCategory;
  lines: string[];
  valid: boolean;
}

export interface CorruptedRecord extends CorruptedMRZ {
  valid: boolean;
}

export function saveResults(path: string, records: readonly GeneratedRecord[], corrupted: readonly CorruptedRecord[]): void {
  const ext = extname(path).toLowerCase();
  if (ext === ".json") {
    writeFileSync(path, JSON.stringify({ records, corrupted }, null, 2), "utf8");
  } else {
    const lines: string[] = [];
    for (const record of records) {
      lines.push(...record.lines, "");
    }
    if (corrupted.length > 0) {
      lines.push("=== OSTECENI (namerno nevalidni) UZORCI ===", "");
      for (const record of corrupted) {
        lines.push(`# ${record.corruption}: ${record.description}`);
        lines.push(...record.lines, "");
      }
    }
    writeFileSync(path, lines.join("\n"), "utf8");
  }
}
