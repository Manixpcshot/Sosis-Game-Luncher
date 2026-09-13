'use strict';
/**
 * StoreManager — the Steam-like game store (Sosis Web Platform).
 * Catalog browsing (with offline cache), free-game claim, credit purchase,
 * card-to-card payment receipt submission and downloads through the existing
 * DownloadsManager queue (progress, SHA-256 verification, retry-friendly).
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { makeLogger } = require('../util/log');

const log = makeLogger('store');

class StoreManager {
  constructor(account, downloads) {
    this.account = account;
    this.downloads = downloads;
    this.cacheFile = path.join(app.getPath('userData'), 'store-cache.json');
  }

  async catalog() {
    const server = this.account.serverUrl();
    try {
      const { status, data } = await this.account._req('GET', '/api/store/games');
      if (status === 200 && data && data.ok) {
        const out = { ok: true, offline: false, games: data.games || [], meta: data.meta || {}, server };
        this._saveCache(out);
        return out;
      }
      return this._offlineResult(server, 'http-' + status);
    } catch (err) {
      log.warn('catalog fetch failed (offline?):', err && err.message);
      return this._offlineResult(server, 'network');
    }
  }

  _offlineResult(server, reason) {
    const cached = this._loadCache();
    if (cached && Array.isArray(cached.games)) {
      return { ok: true, offline: true, games: cached.games, meta: cached.meta || null, server, reason };
    }
    return { ok: false, offline: true, games: [], meta: null, server, error: reason };
  }

  _saveCache(data) {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify({ games: data.games, meta: data.meta, savedAt: Date.now() }));
    } catch {}
  }

  _loadCache() {
    try {
      return JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
    } catch {
      return null;
    }
  }

  async claim(gameId) {
    if (!this.account.token()) return { ok: false, error: 'not-logged-in' };
    try {
      const { status, data } = await this.account._req('POST', '/api/store/claim', { gameId });
      if (data && data.ok) return { ok: true, user: data.user };
      return { ok: false, error: (data && data.error) || 'http-' + status };
    } catch {
      return { ok: false, error: 'offline' };
    }
  }

  async buy(gameId) {
    if (!this.account.token()) return { ok: false, error: 'not-logged-in' };
    try {
      const { status, data } = await this.account._req('POST', '/api/store/buy', { gameId });
      if (data && data.ok) return { ok: true, user: data.user };
      return { ok: false, error: (data && data.error) || 'http-' + status };
    } catch {
      return { ok: false, error: 'offline' };
    }
  }

  async submitPayment(gameId, dataUrl, note) {
    if (!this.account.token()) return { ok: false, error: 'not-logged-in' };
    if (!dataUrl || !/^data:image\//.test(dataUrl)) return { ok: false, error: 'bad-image' };
    try {
      const { status, data } = await this.account._req('POST', '/api/store/payment', { gameId, dataUrl, note: note || '' });
      if (data && data.ok) return { ok: true, id: data.id };
      return { ok: false, error: (data && data.error) || 'http-' + status };
    } catch {
      return { ok: false, error: 'offline' };
    }
  }

  async myPayments() {
    if (!this.account.token()) return { ok: false, error: 'not-logged-in', payments: [] };
    try {
      const { status, data } = await this.account._req('GET', '/api/store/payments');
      if (data && data.ok) return { ok: true, payments: data.payments || [] };
      return { ok: false, error: 'http-' + status, payments: [] };
    } catch {
      return { ok: false, error: 'offline', payments: [] };
    }
  }

  /** Queue the game download in the Downloads manager (progress + sha256). */
  async install(game) {
    if (!game || !game.url) return { ok: false, error: game && game.price > 0 && !game.owned ? 'purchase-required' : 'no-url' };
    const net = require('electron').net;
    if (!net.isOnline()) return { ok: false, error: 'offline' };
    const server = this.account.serverUrl();
    const url = /^https?:/i.test(game.url) ? game.url : server + game.url;
    const safeBase = String(game.name || 'game').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
    const name = game.file ? game.file : safeBase + '.bin';
    const headers = {};
    const token = this.account.token();
    if (url.indexOf(server) === 0 && token) headers.authorization = 'Bearer ' + token;
    const jobId = this.downloads.addJob(url, {
      name,
      sha256: game.sha256 || undefined,
      headers
    });
    return { ok: true, jobId, name };
  }
}

module.exports = { StoreManager };
