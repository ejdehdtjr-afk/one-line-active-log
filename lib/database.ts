import { env } from 'cloudflare:workers';

let ready: Promise<void> | undefined;

export function db() {
  if (!env.DB) throw new Error('D1 DB binding is unavailable');
  return env.DB;
}

export function ensureSchema() {
  if (!ready) {
    const d1 = db();
    ready = d1
      .batch([
        d1.prepare(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
        d1.prepare(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL, created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`),
        d1.prepare(`CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, question TEXT NOT NULL,
        metric TEXT NOT NULL, unit TEXT NOT NULL, calculation TEXT NOT NULL,
        missing_rule TEXT NOT NULL, duplicate_rule TEXT NOT NULL, outlier_rule TEXT NOT NULL,
        rounding_rule TEXT NOT NULL, week_start TEXT NOT NULL, plan_before TEXT NOT NULL,
        plan_after TEXT, changed_at TEXT, changed_reason TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`),
        d1.prepare(`CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, record_date TEXT NOT NULL,
        value REAL NOT NULL, note TEXT NOT NULL DEFAULT '', phase TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, record_date)
      )`),
        d1.prepare(`CREATE TABLE IF NOT EXISTS legacy_records (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, legacy_id TEXT NOT NULL,
        record_date TEXT NOT NULL, value REAL NOT NULL, unit TEXT NOT NULL,
        memo TEXT NOT NULL, tag TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, legacy_id)
      )`),
        d1.prepare(
          'CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)',
        ),
        d1.prepare(
          'CREATE INDEX IF NOT EXISTS idx_records_user_date ON records(user_id, record_date)',
        ),
        d1.prepare(
          'CREATE INDEX IF NOT EXISTS idx_legacy_records_user_date ON legacy_records(user_id, record_date)',
        ),
      ])
      .then(() => undefined);
  }
  return ready;
}

export type User = { id: string; email: string; created_at: string };
