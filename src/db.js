// Uses Node.js built-in SQLite (available since Node 22.5, stable in Node 24)
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'prices.db');

let db;

export function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    migrate(db);
  }
  return db;
}

function migrate(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS prices (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      store       TEXT    NOT NULL,
      product     TEXT    NOT NULL,
      variant     TEXT    NOT NULL DEFAULT '',
      pack_size   INTEGER NOT NULL DEFAULT 1,
      price_eur   REAL    NOT NULL,
      per_unit    REAL    NOT NULL,
      url         TEXT    NOT NULL,
      scraped_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_prices_lookup
      ON prices (store, product, variant, pack_size, scraped_at);

    CREATE TABLE IF NOT EXISTS notified_deals (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_key    TEXT    NOT NULL UNIQUE,
      notified_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function insertPrice({ store, product, variant, packSize, priceEur, perUnit, url }) {
  getDb().prepare(`
    INSERT INTO prices (store, product, variant, pack_size, price_eur, per_unit, url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(store, product, variant, packSize, priceEur, perUnit, url);
}

export function getRollingAverage(store, product, variant, packSize, days = 7) {
  const row = getDb().prepare(`
    SELECT AVG(per_unit) AS avg_per_unit
    FROM prices
    WHERE store = ? AND product = ? AND variant = ? AND pack_size = ?
      AND scraped_at >= datetime('now', '-' || ? || ' days')
  `).get(store, product, variant, packSize, days);
  return row?.avg_per_unit ?? null;
}

export function wasAlreadyNotified(dealKey) {
  const row = getDb().prepare(
    `SELECT 1 AS found FROM notified_deals WHERE deal_key = ?`
  ).get(dealKey);
  return !!row;
}

export function markNotified(dealKey) {
  getDb().prepare(
    `INSERT OR IGNORE INTO notified_deals (deal_key) VALUES (?)`
  ).run(dealKey);
}

// Expire old "notified" records after 3 days so re-emerging deals are re-notified
export function pruneOldNotifications() {
  getDb().prepare(
    `DELETE FROM notified_deals WHERE notified_at < datetime('now', '-3 days')`
  ).run();
}
