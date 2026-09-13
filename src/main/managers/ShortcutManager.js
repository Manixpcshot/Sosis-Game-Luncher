'use strict';
/**
 * ShortcutManager — Windows .lnk creation for games and the launcher (spec §30).
 * Uses Electron's shell.writeShortcutLink (no registry writes, no system
 * modification beyond the shortcut files the user asked for, spec §64).
 */
const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');
const { makeLogger } = require('../util/log');

const log = makeLogger('shortcuts');

class ShortcutManager {
  _targets(kind, name) {
    const safe = name.replace(/[\\/:*?"<>|]/g, '_');
    const out = [];
    if (kind === 'desktop' || kind === 'both') out.push(path.join(app.getPath('desktop'), safe + '.lnk'));
    if (kind === 'startmenu' || kind === 'both') {
      out.push(path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', safe + '.lnk'));
    }
    return out;
  }

  createForGame(game, kind = 'both') {
    if (process.platform !== 'win32') return { ok: false, error: 'unsupported-platform' };
    const results = [];
    for (const target of this._targets(kind, game.name)) {
      try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const ok = shell.writeShortcutLink(target, 'create', {
          target: game.exePath,
          cwd: game.gameFolder || path.dirname(game.exePath),
          description: game.name + ' — via Sosis Launcher',
          appUserModelId: 'top.sosis-shop.launcher'
        });
        results.push({ target, ok });
      } catch (err) {
        log.warn('shortcut failed:', target, err.message);
        results.push({ target, ok: false, error: err.message });
      }
    }
    return { ok: results.every((r) => r.ok), results };
  }

  createForLauncher(kind = 'both') {
    if (process.platform !== 'win32') return { ok: false, error: 'unsupported-platform' };
    const exe = process.execPath;
    const results = [];
    for (const target of this._targets(kind, 'Sosis Launcher')) {
      try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const ok = shell.writeShortcutLink(target, 'create', {
          target: exe,
          cwd: path.dirname(exe),
          icon: exe,
          iconIndex: 0,
          description: 'Sosis Launcher',
          appUserModelId: 'top.sosis-shop.launcher'
        });
        results.push({ target, ok });
      } catch (err) {
        results.push({ target, ok: false, error: err.message });
      }
    }
    return { ok: results.every((r) => r.ok), results };
  }
}

module.exports = { ShortcutManager };
