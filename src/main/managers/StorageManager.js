'use strict';
/**
 * StorageManager — persistent structured storage for Sosis Launcher.
 *
 * Backend strategy (spec §41):
 *  1. SQLite via better-sqlite3 (preferred, professional).
 *  2. Atomic JSON file fallback if the native module is unavailable
 *     (e.g. cross-built package without a matching prebuild) or the DB is
 *     unreadable. The app never crashes because of storage problems: a
 *     corrupted database is backed up and rebuilt (spec §42, §43).
 *
 * Both backends implement the same interface; everything above this module
 * is backend-agnostic.
 */
const fs = require('fs');
const path = require('path');
const { makeLogger } = require('../util/log');
const paths = require('../util/paths');

const log = makeLogger('storage');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS secrets (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
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
  totalPlayTime INTEGER NOT NULL DEFAULT 0,
  lastPlayed    INTEGER,
  launchCount   INTEGER NOT NULL DEFAULT 0,
  createdAt     INTEGER NOT NULL,
  updatedAt     INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  gameId    TEXT NOT NULL,
  startedAt INTEGER NOT NULL,
  endedAt   INTEGER NOT NULL,
  seconds   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_game ON sessions(gameId);
`;

const GAME_FIELDS = [
  'id',
  'name',
  'exePath',
  'gameFolder',
  'icon',
  'cover',
  'banner',
  'description',
  'favorite',
  'totalPlayTime',
  'lastPlayed',
  'launchCount',
  'createdAt',
  'updatedAt'
];

class JsonBackend {
  constructor(file) {
    this.file = file;
    this.data = { meta: {}, settings: {}, secrets: {}, games: {}, sessions: [] };
    this._load();
  }
  _load() {
    if (fs.existsSync(this.file)) {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw); // may throw -> caller recovers
      this.data = Object.assign(this.data, parsed);
    }
  }
  _save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data), 'utf8');
    fs.renameSync(tmp, this.file);
  }
  get name() {
    return 'json';
  }
  metaGet(k, d) {
    return k in this.data.meta ? this.data.meta[k] : d;
  }
  metaSet(k, v) {
    this.data.meta[k] = v;
    this._save();
  }
  settingGet(k, d) {
    return k in this.data.settings ? this.data.settings[k] : d;
  }
  settingSet(k, v) {
    this.data.settings[k] = v;
    this._save();
  }
  settingAll() {
    return { ...this.data.settings };
  }
  secretGet(k) {
    return this.data.secrets[k] || null;
  }
  secretSet(k, v) {
    if (v === null) delete this.data.secrets[k];
    else this.data.secrets[k] = v;
    this._save();
  }
  gameList() {
    return Object.values(this.data.games).map((g) => ({ ...g, favorite: !!g.favorite }));
  }
  gameGet(id) {
    const g = this.data.games[id];
    return g ? { ...g, favorite: !!g.favorite } : null;
  }
  gamePut(game) {
    this.data.games[game.id] = { ...game, favorite: game.favorite ? 1 : 0 };
    this._save();
  }
  gameDelete(id) {
    delete this.data.games[id];
    this.data.sessions = this.data.sessions.filter((s) => s.gameId !== id);
    this._save();
  }
  sessionAdd(s) {
    this.data.sessions.push(s);
    this._save();
  }
  sessionList(gameId) {
    return this.data.sessions.filter((s) => s.gameId === gameId);
  }
  close() {}
}

class SqliteBackend {
  constructor(file) {
    // Resolved lazily so a missing native module throws here, not at require-time.
    const Database = require('better-sqlite3');
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA);
  }
  get name() {
    return 'sqlite';
  }
  metaGet(k, d) {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(k);
    return row ? JSON.parse(row.value) : d;
  }
  metaSet(k, v) {
    this.db
      .prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(k, JSON.stringify(v));
  }
  settingGet(k, d) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
    return row ? JSON.parse(row.value) : d;
  }
  settingSet(k, v) {
    this.db
      .prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(k, JSON.stringify(v));
  }
  settingAll() {
    const out = {};
    for (const row of this.db.prepare('SELECT key, value FROM settings').all()) {
      out[row.key] = JSON.parse(row.value);
    }
    return out;
  }
  secretGet(k) {
    const row = this.db.prepare('SELECT value FROM secrets WHERE key = ?').get(k);
    return row ? row.value : null;
  }
  secretSet(k, v) {
    if (v === null) this.db.prepare('DELETE FROM secrets WHERE key = ?').run(k);
    else
      this.db
        .prepare('INSERT INTO secrets(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .run(k, v);
  }
  gameList() {
    return this.db.prepare('SELECT * FROM games').all().map((g) => ({ ...g, favorite: !!g.favorite }));
  }
  gameGet(id) {
    const g = this.db.prepare('SELECT * FROM games WHERE id = ?').get(id);
    return g ? { ...g, favorite: !!g.favorite } : null;
  }
  gamePut(game) {
    const cols = GAME_FIELDS.map((f) => `${f} = @${f}`).join(', ');
    const stmt = this.db.prepare(
      `INSERT INTO games(${GAME_FIELDS.join(', ')}) VALUES(${GAME_FIELDS.map((f) => '@' + f).join(', ')})
       ON CONFLICT(id) DO UPDATE SET ${cols}`
    );
    const row = { ...game, favorite: game.favorite ? 1 : 0 };
    for (const f of GAME_FIELDS) if (!(f in row)) row[f] = null;
    stmt.run(row);
  }
  gameDelete(id) {
    this.db.prepare('DELETE FROM games WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM sessions WHERE gameId = ?').run(id);
  }
  sessionAdd(s) {
    this.db
      .prepare('INSERT INTO sessions(gameId, startedAt, endedAt, seconds) VALUES(@gameId, @startedAt, @endedAt, @seconds)')
      .run(s);
  }
  sessionList(gameId) {
    return this.db.prepare('SELECT * FROM sessions WHERE gameId = ? ORDER BY startedAt').all(gameId);
  }
  close() {
    try {
      this.db.close();
    } catch {}
  }
}

class StorageManager {
  constructor() {
    this.backend = null;
    this.status = { backend: 'none', recovered: false, error: null, path: null };
  }

  init() {
    paths.ensure(paths.dbDir);
    // 1) Try SQLite
    try {
      this.backend = new SqliteBackend(paths.dbFile);
      this.status = { backend: 'sqlite', recovered: false, error: null, path: paths.dbFile };
      log.info('Storage backend: sqlite at', paths.dbFile);
      return this.status;
    } catch (err) {
      const reason = err && err.message ? err.message : String(err);
      log.warn('SQLite unavailable or corrupted:', reason);
      // Back up a corrupted DB so nothing is silently destroyed (spec §64).
      try {
        if (fs.existsSync(paths.dbFile)) {
          const backup = paths.dbFile + '.corrupt-' + Date.now();
          fs.renameSync(paths.dbFile, backup);
          for (const suffix of ['-wal', '-shm']) {
            if (fs.existsSync(paths.dbFile + suffix)) fs.renameSync(paths.dbFile + suffix, backup + suffix);
          }
          this.status.recovered = true;
        }
      } catch (e2) {
        log.error('Could not back up corrupted db:', e2);
      }
    }
    // 2) JSON fallback
    try {
      this.backend = new JsonBackend(paths.jsonFallbackFile);
      this.status = {
        backend: 'json',
        recovered: this.status.recovered,
        error: this.status.error,
        path: paths.jsonFallbackFile
      };
      log.info('Storage backend: json fallback at', paths.jsonFallbackFile);
      return this.status;
    } catch (err) {
      // Corrupted JSON: back it up and start clean rather than crash (spec §42).
      log.error('JSON storage corrupted, recovering:', err);
      try {
        if (fs.existsSync(paths.jsonFallbackFile)) {
          fs.renameSync(paths.jsonFallbackFile, paths.jsonFallbackFile + '.corrupt-' + Date.now());
        }
      } catch {}
      this.backend = new JsonBackend(paths.jsonFallbackFile);
      this.status = { backend: 'json', recovered: true, error: String(err && err.message), path: paths.jsonFallbackFile };
      return this.status;
    }
  }

  info() {
    return {
      backend: this.status.backend,
      path: this.status.path,
      recovered: this.status.recovered,
      error: this.status.error,
      games: this.backend.gameList().length,
      userData: paths.userData
    };
  }

  close() {
    if (this.backend) this.backend.close();
  }
}

module.exports = { StorageManager, GAME_FIELDS, SCHEMA };
