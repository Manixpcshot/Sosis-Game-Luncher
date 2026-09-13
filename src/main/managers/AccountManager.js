'use strict';
/**
 * AccountManager — online accounts against the Sosis Web Platform
 * (https://app.sosis-shop.top by default, configurable).
 *
 * The bearer token is stored encrypted via SecretsManager; the renderer never
 * sees it. Play sessions are pushed to the server when they finish so the
 * leaderboard / popular games / profile stay in sync.
 */
const fs = require('fs');
const path = require('path');
const { makeLogger } = require('../util/log');
const paths = require('../util/paths');

const log = makeLogger('account');

const TOKEN_KEY = 'account.token';
const DEFAULT_SERVER = 'https://app.sosis-shop.top';

class AccountManager {
  constructor(settings, secrets) {
    this.settings = settings;
    this.secrets = secrets;
    this.cache = { username: null, avatar: null, user: null };
  }

  serverUrl() {
    const url = (this.settings.get('account') && this.settings.get('account').serverUrl) || DEFAULT_SERVER;
    return String(url).replace(/\/+$/, '');
  }

  token() {
    return this.secrets.get(TOKEN_KEY);
  }

  async _req(method, endpoint, body, authed = true) {
    const headers = { 'content-type': 'application/json' };
    const token = this.token();
    if (authed && token) headers.authorization = 'Bearer ' + token;
    const res = await fetch(this.serverUrl() + endpoint, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000)
    });
    let data = null;
    try {
      data = await res.json();
    } catch {}
    return { status: res.status, data };
  }

  async state() {
    const token = this.token();
    if (!token) return { loggedIn: false, user: null, server: this.serverUrl() };
    const { status, data } = await this._req('GET', '/api/auth/me');
    if (status === 200 && data && data.ok) {
      this.cache.user = data.user;
      this._cacheAvatar(data.user);
      return { loggedIn: true, user: data.user, server: this.serverUrl() };
    }
    if (status === 401) this.secrets.set(TOKEN_KEY, null); // stale token
    return { loggedIn: false, user: null, server: this.serverUrl() };
  }

  async login(username, password) {
    const { status, data } = await this._req('POST', '/api/auth/login', { username, password }, false);
    if (data && data.ok) {
      this.secrets.set(TOKEN_KEY, data.token);
      this.settings.set('account', { username: data.user.username });
      this.cache.user = data.user;
      this._cacheAvatar(data.user);
      return { ok: true, user: data.user };
    }
    return { ok: false, error: data && data.error ? data.error : 'http-' + status };
  }

  async register(username, password, email) {
    const { status, data } = await this._req('POST', '/api/auth/register', { username, password, email }, false);
    if (data && data.ok) {
      this.secrets.set(TOKEN_KEY, data.token);
      this.settings.set('account', { username: data.user.username });
      this.cache.user = data.user;
      return { ok: true, user: data.user };
    }
    return { ok: false, error: data && data.error ? data.error : 'http-' + status };
  }

  logout() {
    this._req('POST', '/api/auth/logout', {}).catch(() => {});
    this.secrets.set(TOKEN_KEY, null);
    this.cache = { username: null, avatar: null, user: null };
    return { ok: true };
  }

  async uploadAvatarDataUrl(dataUrl) {
    const { status, data } = await this._req('POST', '/api/auth/avatar', { dataUrl });
    if (data && data.ok) {
      this.cache.user = data.user;
      this._cacheAvatar(data.user);
      return { ok: true, user: data.user };
    }
    return { ok: false, error: data && data.error ? data.error : 'http-' + status };
  }

  /** Push a finished session to the server (fire-and-forget safe). */
  async syncSession(gameName, seconds) {
    if (!this.token()) return { ok: false, reason: 'not-logged-in' };
    try {
      const { status, data } = await this._req('POST', '/api/sync/session', {
        gameName,
        seconds,
        endedAt: Date.now()
      });
      if (data && data.ok) {
        this.cache.user = data.user;
        return { ok: true };
      }
      return { ok: false, error: 'http-' + status };
    } catch (err) {
      log.warn('session sync failed (offline?):', err && err.message);
      return { ok: false, error: 'network' };
    }
  }

  async leaderboard() {
    try {
      const { status, data } = await this._req('GET', '/api/leaderboard', null, false);
      if (data && data.ok) return { ok: true, users: data.users };
      return { ok: false, error: 'http-' + status };
    } catch (err) {
      return { ok: false, error: 'network' };
    }
  }

  async popular() {
    try {
      const { status, data } = await this._req('GET', '/api/games/popular', null, false);
      if (data && data.ok) return { ok: true, games: data.games };
      return { ok: false, error: 'http-' + status };
    } catch (err) {
      return { ok: false, error: 'network' };
    }
  }

  async ping() {
    try {
      const { status, data } = await this._req('GET', '/api/site/config', null, false);
      return { ok: status === 200 && !!data, config: data || null };
    } catch {
      return { ok: false, config: null };
    }
  }

  _cacheAvatar(user) {
    // keep a local copy of the avatar for offline profile display
    if (!user || !user.avatar) return;
    fetch(this.serverUrl() + user.avatar)
      .then((r) => (r.ok ? r.buffer() : null))
      .then((buf) => {
        if (!buf) return;
        const file = path.join(paths.artDir, 'my-avatar' + path.extname(user.avatar || '.png'));
        fs.writeFileSync(file, buf);
        this.cache.avatar = file;
      })
      .catch(() => {});
  }

  cachedAvatar() {
    return this.cache.avatar;
  }
}

module.exports = { AccountManager, DEFAULT_SERVER };
