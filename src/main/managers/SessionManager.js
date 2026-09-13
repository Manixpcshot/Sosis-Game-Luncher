'use strict';
/**
 * SessionManager — play-time sessions (spec §9, §10, §38).
 *
 * Strict separation:
 *  - `current session time` = now - session.startedAt (live, per running game)
 *  - `total play time`      = stored sum of finished sessions (updated ONCE,
 *    when the process ends, then persisted)
 */
const { EventEmitter } = require('events');
const { makeLogger } = require('../util/log');

const log = makeLogger('session');

class SessionManager extends EventEmitter {
  constructor(gameManager, processManager) {
    super();
    this.games = gameManager;
    this.proc = processManager;
    /** @type {Map<string, {gameId:string, startedAt:number}>} */
    this.sessions = new Map();

    this.proc.on('exit', ({ gameId, startedAt, endedAt }) => this.endSession(gameId, { startedAt, endedAt, reason: 'process-exit' }));
    this.proc.on('launch-error', ({ gameId, error, code }) => {
      this.sessions.delete(gameId);
      this.emit('launch-error', { gameId, error, code });
    });
  }

  start(game) {
    if (this.sessions.has(game.id)) {
      return { ok: false, code: 'ALREADY_RUNNING', session: this.describe(game.id) };
    }
    const result = this.proc.launch(game, { trackMode: 'smart' });
    if (!result.ok) return result;
    const startedAt = Date.now();
    this.sessions.set(game.id, { gameId: game.id, startedAt });
    this.emit('started', { gameId: game.id, startedAt, pid: result.pid });
    return { ok: true, session: this.describe(game.id) };
  }

  describe(gameId) {
    const s = this.sessions.get(gameId);
    if (!s) return null;
    return {
      gameId,
      startedAt: s.startedAt,
      elapsedSeconds: Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000)),
      running: true
    };
  }

  active() {
    return [...this.sessions.values()].map((s) => this.describe(s.gameId)).filter(Boolean);
  }

  /**
   * Finish a session: persist totals. Idempotent per game.
   */
  endSession(gameId, { startedAt, endedAt, reason } = {}) {
    const s = this.sessions.get(gameId);
    if (!s) return null;
    this.sessions.delete(gameId);
    const start = startedAt || s.startedAt;
    const end = endedAt || Date.now();
    const seconds = Math.max(0, Math.round((end - start) / 1000));
    const game = this.games.recordSessionEnd(gameId, { startedAt: start, endedAt: end, seconds });
    log.info('Session ended for', gameId, reason || '', seconds + 's');
    const summary = { gameId, startedAt: start, endedAt: end, seconds, game };
    this.emit('ended', summary);
    return summary;
  }

  /** Forcibly drop a session without recording (e.g. app shutdown). */
  discard(gameId) {
    this.sessions.delete(gameId);
  }

  dispose() {
    // On shutdown we do NOT credit unfinished sessions; totals only count
    // completed sessions (documented behaviour).
    this.sessions.clear();
  }
}

module.exports = { SessionManager };
