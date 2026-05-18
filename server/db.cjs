// SQLite-backed key-value store. Persistent across server restarts.
const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.resolve(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "library.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)`);

const stmts = {
  all: db.prepare("SELECT key, value FROM kv"),
  get: db.prepare("SELECT value FROM kv WHERE key = ?"),
  upsert: db.prepare(`INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
                      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`),
  del: db.prepare("DELETE FROM kv WHERE key = ?"),
  wipe: db.prepare("DELETE FROM kv"),
};

module.exports = {
  dbPath: DB_PATH,
  all() {
    const rows = stmts.all.all();
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  },
  get(key) {
    const r = stmts.get.get(key);
    return r ? r.value : null;
  },
  set(key, value) {
    stmts.upsert.run(key, value, Date.now());
  },
  remove(key) {
    stmts.del.run(key);
  },
  wipe() {
    stmts.wipe.run();
  },
};
