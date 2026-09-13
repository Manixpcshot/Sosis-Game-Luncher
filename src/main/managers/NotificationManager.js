'use strict';
/**
 * NotificationManager — Windows toast notifications via Electron (spec §28).
 * All toasts are gated by Settings > Notifications.
 */
const { Notification, app } = require('electron');
const path = require('path');
const { makeLogger } = require('../util/log');

const log = makeLogger('notify');

class NotificationManager {
  constructor(settings, translations) {
    this.settings = settings;
    this.t = translations;
  }

  _icon() {
    try {
      return path.join(__dirname, '..', '..', '..', 'assets', 'icons', 'icon.png');
    } catch {
      return undefined;
    }
  }

  _send(title, body) {
    try {
      if (!Notification.isSupported()) return { ok: false, reason: 'unsupported' };
      const n = new Notification({ title, body, icon: this._icon(), silent: false });
      n.on('failed', (_e, err) => log.warn('toast failed:', err));
      n.show();
      return { ok: true };
    } catch (err) {
      log.warn('notification error:', err);
      return { ok: false, reason: err.message };
    }
  }

  notify(key, vars = {}) {
    const cfg = this.settings.get('notifications');
    if (!cfg.enabled) return { ok: false, reason: 'disabled' };
    const locale = this.settings.get('language', 'locale');
    const bundle = this.t.get(locale);
    const tr = (k, v) => {
      let s = (bundle.messages && bundle.messages[k]) || (bundle.fallback && bundle.fallback[k]) || k;
      for (const name of Object.keys(v || {})) s = s.replace(new RegExp('\\{' + name + '\\}', 'g'), v[name]);
      return s;
    };
    switch (key) {
      case 'gameStarted':
        if (!cfg.gameStarted) return { ok: false, reason: 'disabled' };
        return this._send(tr('notify.gameStarted.title'), tr('notify.gameStarted.body', vars));
      case 'sessionFinished':
        if (!cfg.sessionFinished) return { ok: false, reason: 'disabled' };
        return this._send(tr('notify.sessionFinished.title'), tr('notify.sessionFinished.body', vars));
      case 'updateAvailable':
        if (!cfg.updatesAvailable) return { ok: false, reason: 'disabled' };
        return this._send(tr('notify.updateAvailable.title'), tr('notify.updateAvailable.body', vars));
      case 'test':
        return this._send(tr('notify.test.title'), tr('notify.test.body'));
      default:
        return this._send(vars.title || key, vars.body || '');
    }
  }
}

module.exports = { NotificationManager };
