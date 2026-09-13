-- Sosis Launcher — SQLite schema (reference; created automatically at runtime
-- by src/main/managers/StorageManager.js inside the user's userData folder).
-- The repository never contains user data; this file documents the structure.

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL            -- JSON
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,        -- "section:<name>"
  value TEXT NOT NULL            -- JSON object of the section
);

CREATE TABLE IF NOT EXISTS secrets (
  key   TEXT PRIMARY KEY,        -- e.g. "ai.apiKey"
  value TEXT NOT NULL            -- safeStorage/AES-GCM ciphertext, never plaintext
);

CREATE TABLE IF NOT EXISTS games (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  exePath       TEXT NOT NULL,
  gameFolder    TEXT,
  icon          TEXT,
  cover         TEXT,
  banner        TEXT,
  description   TEXT,
  favorite      INTEGER NOT NULL DEFAULT 0,
  totalPlayTime INTEGER NOT NULL DEFAULT 0,  -- seconds, sum of finished sessions
  lastPlayed    INTEGER,                     -- epoch ms
  launchCount   INTEGER NOT NULL DEFAULT 0,
  createdAt     INTEGER NOT NULL,
  updatedAt     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  gameId    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  startedAt INTEGER NOT NULL,
  endedAt   INTEGER NOT NULL,
  seconds   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_game ON sessions(gameId);
