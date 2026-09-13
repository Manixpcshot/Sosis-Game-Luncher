'use strict';
/**
 * GameManager — library CRUD on top of StorageManager (spec §5, §6).
 * Emits change events so the renderer can refresh without polling.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { makeLogger } = require('../util/log');
const { extractIcon } = require('./IconExtractor');

const log = makeLogger('games');

/** "cod3.exe" -> "Cod3", "my_game2-final (1).exe" -> "My Game2 Final" */
function nameFromExe(exePath) {
  // normalize Windows separators so the helper is platform-independent
  const normalized = String(exePath || '').replace(/\\/g, '/');
  const base = path.basename(normalized || '', path.extname(normalized || ''));
  return base
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[_\.]+/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

class GameManager extends EventEmitter {
  constructor(storage) {
    super();
    this.storage = storage;
  }

  list() {
    return this.storage.backend.gameList();
  }

  get(id) {
    return this.storage.backend.gameGet(id);
  }

  async add({ exePath, name, description }) {
    if (!exePath) throw new Error('EXE path is required');
    if (!fs.existsSync(exePath)) {
      const err = new Error('EXE not found: ' + exePath);
      err.code = 'EXE_NOT_FOUND';
      throw err;
    }
    const now = Date.now();
    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const game = {
      id,
      name: name && name.trim() ? name.trim() : nameFromExe(exePath),
      exePath,
      gameFolder: path.dirname(exePath),
      icon: null,
      cover: null,
      banner: null,
      description: description || '',
      favorite: false,
      totalPlayTime: 0,
      lastPlayed: null,
      launchCount: 0,
      createdAt: now,
      updatedAt: now
    };
    this.storage.backend.gamePut(game);
    // Best-effort icon extraction; never blocks adding a game (spec §43).
    try {
      game.icon = await extractIcon(exePath, id);
      if (game.icon) this.storage.backend.gamePut(game);
    } catch (err) {
      log.warn('Icon extraction skipped:', err && err.message);
    }
    this._changed('add', game.id);
    return this.storage.backend.gameGet(id);
  }

  update(id, patch) {
    const game = this.storage.backend.gameGet(id);
    if (!game) throw new Error('Game not found: ' + id);
    const allowed = ['name', 'exePath', 'gameFolder', 'icon', 'cover', 'banner', 'description', 'favorite'];
    const next = { ...game };
    for (const key of allowed) {
      if (key in patch) next[key] = patch[key];
    }
    if (patch.exePath && patch.exePath !== game.exePath && !patch.gameFolder) {
      next.gameFolder = path.dirname(patch.exePath);
    }
    next.favorite = !!next.favorite;
    next.updatedAt = Date.now();
    this.storage.backend.gamePut(next);
    this._changed('update', id);
    return this.storage.backend.gameGet(id);
  }

  setFavorite(id, favorite) {
    return this.update(id, { favorite: !!favorite });
  }

  /** Remove from library only. NEVER deletes game files (spec §65). */
  remove(id) {
    const game = this.storage.backend.gameGet(id);
    if (!game) return { ok: false, error: 'not-found' };
    this.storage.backend.gameDelete(id);
    this._changed('remove', id);
    return { ok: true };
  }

  recordSessionEnd(id, { startedAt, endedAt, seconds }) {
    const game = this.storage.backend.gameGet(id);
    if (!game) return null;
    this.storage.backend.sessionAdd({ gameId: id, startedAt, endedAt, seconds });
    const next = {
      ...game,
      totalPlayTime: (game.totalPlayTime || 0) + seconds,
      lastPlayed: endedAt,
      launchCount: (game.launchCount || 0) + 1,
      updatedAt: Date.now()
    };
    this.storage.backend.gamePut(next);
    this._changed('session', id);
    return next;
  }

  sessions(id) {
    return this.storage.backend.sessionList(id);
  }

  _changed(kind, id) {
    this.emit('changed', { kind, id });
  }
}

module.exports = { GameManager, nameFromExe };
