// In-memory zamena za expo-sqlite — samo za testove!
// Ne implementira pravi SQL parser; prepoznaje TAČNO upite koje koristi
// src/services/database.ts (CREATE TABLE / INSERT / SELECT sve /
// SELECT po id / UPDATE po id / DELETE po id).

let rows = []; // { id, encrypted, createdAt }

function normalizeParams(params) {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
}

class MockSQLiteDatabase {
  async execAsync(_source) {
    // CREATE TABLE IF NOT EXISTS — "tabela" je niz `rows`, ništa da se radi.
  }

  async runAsync(source, ...params) {
    const args = normalizeParams(params);

    if (/^\s*INSERT INTO documents/i.test(source)) {
      const [id, encrypted, createdAt] = args;
      rows.push({ id, encrypted, createdAt });
      return { changes: 1, lastInsertRowId: rows.length };
    }
    if (/^\s*UPDATE documents SET encrypted/i.test(source)) {
      const [encrypted, id] = args;
      const row = rows.find((r) => r.id === id);
      if (row != null) row.encrypted = encrypted;
      return { changes: row != null ? 1 : 0, lastInsertRowId: 0 };
    }
    if (/^\s*DELETE FROM documents/i.test(source)) {
      const [id] = args;
      const before = rows.length;
      rows = rows.filter((r) => r.id !== id);
      return { changes: before - rows.length, lastInsertRowId: 0 };
    }
    throw new Error(`Mock expo-sqlite: nepodržan upit u runAsync: ${source}`);
  }

  async getAllAsync(source, ...params) {
    const args = normalizeParams(params);
    if (/WHERE\s+id\s*=\s*\?/i.test(source)) {
      const [id] = args;
      return rows.filter((r) => r.id === id).map((r) => ({ ...r }));
    }
    if (/^\s*SELECT .* FROM documents/i.test(source)) {
      return [...rows].sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ ...r }));
    }
    throw new Error(`Mock expo-sqlite: nepodržan upit u getAllAsync: ${source}`);
  }

  async getFirstAsync(source, ...params) {
    const results = await this.getAllAsync(source, ...params);
    return results.length > 0 ? results[0] : null;
  }

  async closeAsync() {}
}

module.exports = {
  async openDatabaseAsync(_name) {
    return new MockSQLiteDatabase();
  },
  // pomoćna funkcija za testove — resetuje "bazu" između testova
  __reset() {
    rows = [];
  },
};
