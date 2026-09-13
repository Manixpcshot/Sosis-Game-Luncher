'use strict';
/**
 * ProcessManager — launch and monitor game processes SAFELY (spec §9, §11).
 *
 * Guarantees:
 *  - No DLL injection, no EXE patching, no memory reading, no anti-cheat
 *    interaction. We only `spawn` the executable the user chose and observe
 *    process lifetime from the outside.
 *  - Monitoring: primary signal is the child `exit` event. Some launchers
 *    respawn themselves and the direct child exits immediately; on Windows the
 *    "smart" mode then observes the process tree via `tasklist` (a read-only
 *    listing) until the game image disappears.
 *  - Every failure path resolves gracefully with an error result; the launcher
 *    never crashes because a game failed to start (spec §43).
 */
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { EventEmitter } = require('events');
const { makeLogger } = require('../util/log');

const log = makeLogger('process');

class ProcessManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, {child:any, exeName:string, pid:number, startedAt:number, treePoll:any}>} */
    this.tracked = new Map();
  }

  isRunning(gameId) {
    return this.tracked.has(gameId);
  }

  activeIds() {
    return [...this.tracked.keys()];
  }

  /**
   * Launch a game exe.
   * @returns {{ok:boolean, pid?:number, error?:string, code?:string}}
   */
  launch(game, opts = {}) {
    const exePath = game.exePath;
    if (!exePath) return { ok: false, error: 'no-exe-path', code: 'EXE_NOT_FOUND' };
    if (!fs.existsSync(exePath)) {
      return { ok: false, error: 'EXE not found: ' + exePath, code: 'EXE_NOT_FOUND' };
    }
    if (this.tracked.has(game.id)) {
      return { ok: false, error: 'already-running', code: 'ALREADY_RUNNING' };
    }
    const cwd = game.gameFolder && fs.existsSync(game.gameFolder) ? game.gameFolder : path.dirname(exePath);
    let child;
    try {
      child = spawn(exePath, [], {
        cwd,
        detached: process.platform === 'win32',
        stdio: 'ignore',
        windowsHide: false,
        env: process.env
      });
    } catch (err) {
      log.error('spawn threw for', exePath, err);
      return { ok: false, error: err && err.message ? err.message : String(err), code: 'SPAWN_FAILED' };
    }

    const state = {
      child,
      exeName: path.basename(exePath),
      pid: child.pid || 0,
      startedAt: Date.now(),
      treePoll: null,
      childExited: false,
      childExitAt: 0
    };
    this.tracked.set(game.id, state);

    child.on('error', (err) => {
      log.error('child error for', game.name, err);
      this._cleanup(game.id);
      this.emit('launch-error', { gameId: game.id, error: err.message, code: err.code || 'SPAWN_FAILED' });
    });

    child.on('exit', (code) => {
      state.childExited = true;
      state.childExitAt = Date.now();
      const mode = opts.trackMode || 'smart';
      const quickExit = Date.now() - state.startedAt < 8000;
      if (process.platform === 'win32' && mode === 'smart' && quickExit) {
        // The launcher may have handed off to another process: watch the tree.
        this._startTreePoll(game.id, state, opts);
      } else {
        this._finish(game.id, code);
      }
    });

    log.info('Launched', game.name, 'pid=', state.pid);
    return { ok: true, pid: state.pid };
  }

  _startTreePoll(gameId, state, opts) {
    const interval = Math.max(2000, opts.pollIntervalMs || 5000);
    let misses = 0;
    const tick = async () => {
      const alive = await this._treeAlive(state.pid, state.exeName);
      if (alive) {
        misses = 0;
      } else {
        misses += 1;
        if (misses >= 2) {
          clearInterval(state.treePoll);
          state.treePoll = null;
          this._finish(gameId, 0);
        }
      }
    };
    state.treePoll = setInterval(tick, interval);
    // first check shortly after start
    setTimeout(tick, 1500);
  }

  /** Read-only check: is the pid or any descendant still running / image present? */
  async _treeAlive(rootPid, exeName) {
    if (process.platform !== 'win32') return false;
    return new Promise((resolve) => {
      // tasklist is a read-only system listing; no interaction with the game.
      execFile(
        'tasklist',
        ['/FO', 'CSV', '/NH', '/FI', `IMAGENAME eq ${exeName}`],
        { timeout: 8000, windowsHide: true },
        (err, stdout) => {
          if (err) return resolve(false);
          const lines = String(stdout)
            .split('\n')
            .filter((l) => l.includes('.exe'));
          resolve(lines.length > 0);
        }
      );
    });
  }

  _finish(gameId, exitCode) {
    const state = this.tracked.get(gameId);
    if (!state) return;
    this._cleanup(gameId);
    this.emit('exit', { gameId, exitCode: exitCode || 0, startedAt: state.startedAt, endedAt: Date.now() });
  }

  _cleanup(gameId) {
    const state = this.tracked.get(gameId);
    if (!state) return;
    if (state.treePoll) clearInterval(state.treePoll);
    try {
      state.child.removeAllListeners('exit');
      state.child.removeAllListeners('error');
    } catch {}
    this.tracked.delete(gameId);
  }

  /** Stop tracking without killing anything (we never kill game processes). */
  stopTracking(gameId) {
    const state = this.tracked.get(gameId);
    if (!state) return { ok: false };
    this._cleanup(gameId);
    return { ok: true, startedAt: state.startedAt, endedAt: Date.now() };
  }

  dispose() {
    for (const id of [...this.tracked.keys()]) this._cleanup(id);
  }
}

module.exports = { ProcessManager };
