'use strict';
/**
 * AIManager — OpenAI-compatible assistant (spec §15-19).
 *
 * Security: the API key lives ONLY in SecretsManager (safeStorage/AES-GCM).
 * The renderer receives a masked state (`hasKey`) and can submit a new key,
 * but never reads the stored plaintext (spec §16).
 *
 * Library awareness: when enabled, a compact snapshot of the library is added
 * to the system prompt so questions like "Which game should I play?" can be
 * answered from real data (spec §18).
 *
 * Image suggestions (spec §19): candidates are gathered from public metadata
 * APIs (Steam store search, iTunes Search) or RAWG with a user-supplied key,
 * or from user-pasted URLs. Nothing is downloaded automatically — the user
 * picks a candidate in the UI, and only then is that single image cached
 * locally for their own library metadata.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { makeLogger } = require('../util/log');
const paths = require('../util/paths');

const log = makeLogger('ai');

const KEY_SECRET = 'ai.apiKey';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

class AIManager {
  constructor(settings, secrets, games) {
    this.settings = settings;
    this.secrets = secrets;
    this.games = games;
    this.controllers = new Map();
  }

  config() {
    return this.settings.get('ai');
  }

  getSettings() {
    const cfg = { ...this.config() };
    delete cfg.apiKey;
    cfg.hasKey = this.secrets.has(KEY_SECRET);
    cfg.keyMethod = this.secrets.describe().method;
    return cfg;
  }

  saveSettings(patch) {
    const { apiKey, ...rest } = patch || {};
    if (rest && Object.keys(rest).length) this.settings.set('ai', rest);
    if (apiKey !== undefined) {
      if (apiKey === '' || apiKey === null) this.secrets.set(KEY_SECRET, null);
      else if (apiKey !== '••••••••') this.secrets.set(KEY_SECRET, apiKey);
    }
    return this.getSettings();
  }

  _headers() {
    const h = { 'content-type': 'application/json' };
    const key = this.secrets.get(KEY_SECRET);
    if (key) h.authorization = 'Bearer ' + key;
    return h;
  }

  _baseUrl() {
    let base = String(this.config().baseUrl || '').trim();
    if (!base) throw Object.assign(new Error('AI Base URL is not configured'), { code: 'NO_BASE_URL' });
    base = base.replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) base = 'https://' + base;
    return base;
  }

  /** spec §17 — explicit, human-readable success/failure. */
  async test() {
    const cfg = this.config();
    try {
      const base = this._baseUrl();
      if (!this.secrets.has(KEY_SECRET)) {
        return { ok: false, code: 'NO_KEY', message: 'ai.errors.noKey' };
      }
      if (!cfg.model) return { ok: false, code: 'NO_MODEL', message: 'ai.errors.noModel' };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      let res;
      try {
        res = await fetch(base + '/chat/completions', {
          method: 'POST',
          headers: this._headers(),
          signal: controller.signal,
          body: JSON.stringify({
            model: cfg.model,
            messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
            max_tokens: 5,
            temperature: 0
          })
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return this._httpError(res.status, body);
      }
      const data = await res.json().catch(() => null);
      const model = data && data.model ? data.model : cfg.model;
      return { ok: true, code: 'OK', message: 'ai.errors.success', model };
    } catch (err) {
      return this._networkError(err);
    }
  }

  _httpError(status, body) {
    let snippet = '';
    try {
      const j = JSON.parse(body);
      snippet = (j.error && (j.error.message || j.error.code)) || j.message || '';
    } catch {
      snippet = String(body || '').slice(0, 180);
    }
    if (status === 401 || status === 403) return { ok: false, code: 'BAD_KEY', message: 'ai.errors.badKey', detail: snippet };
    if (status === 404) return { ok: false, code: 'BAD_URL_OR_MODEL', message: 'ai.errors.notFound', detail: snippet };
    if (status === 429) return { ok: false, code: 'RATE_LIMIT', message: 'ai.errors.rateLimit', detail: snippet };
    return { ok: false, code: 'HTTP_' + status, message: 'ai.errors.http', detail: `${status} ${snippet}` };
  }

  _networkError(err) {
    const name = err && err.name;
    if (name === 'AbortError') return { ok: false, code: 'TIMEOUT', message: 'ai.errors.timeout' };
    const msg = String((err && err.message) || err);
    if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) return { ok: false, code: 'DNS', message: 'ai.errors.dns', detail: msg };
    if (/ECONNREFUSED/i.test(msg)) return { ok: false, code: 'REFUSED', message: 'ai.errors.refused', detail: msg };
    if (/ECONNRESET|ETIMEDOUT|network/i.test(msg)) return { ok: false, code: 'NETWORK', message: 'ai.errors.network', detail: msg };
    return { ok: false, code: 'UNKNOWN', message: 'ai.errors.unknown', detail: msg };
  }

  _libraryContext() {
    if (!this.settings.get('ai', 'includeLibraryContext')) return '';
    const games = this.games.list().map((g) => ({
      name: g.name,
      favorite: !!g.favorite,
      totalPlayTimeHours: Math.round((g.totalPlayTime || 0) / 36) / 100,
      launches: g.launchCount || 0,
      lastPlayed: g.lastPlayed ? new Date(g.lastPlayed).toISOString().slice(0, 10) : null
    }));
    return (
      '\n\nThe user\'s game library (JSON) for context — answer library questions from it:\n' +
      JSON.stringify(games)
    );
  }

  /**
   * Stream a chat completion. Emits chunks through onChunk(requestId, delta).
   */
  async chat({ requestId, messages, onChunk }) {
    const cfg = this.config();
    const controller = new AbortController();
    this.controllers.set(requestId, controller);
    try {
      const base = this._baseUrl();
      const system =
        (cfg.systemPrompt ||
          'You are the Sosis Launcher assistant: a concise, friendly helper inside a Windows game launcher. ' +
            'The interface language may be English or Persian (Farsi); mirror the user\'s language.') +
        this._libraryContext();
      const res = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: this._headers(),
        signal: controller.signal,
        body: JSON.stringify({
          model: cfg.model,
          temperature: Number(cfg.temperature) || 0.7,
          stream: true,
          messages: [{ role: 'system', content: system }, ...(messages || [])]
        })
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return this._httpError(res.status, body);
      }
      if (!res.body) {
        const data = await res.json();
        const text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
        onChunk(text || '');
        return { ok: true, done: true };
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices && json.choices[0] && json.choices[0].delta ? json.choices[0].delta.content : null;
            if (delta) onChunk(delta);
          } catch {}
        }
      }
      return { ok: true, done: true };
    } catch (err) {
      if (err && err.name === 'AbortError') return { ok: false, code: 'ABORTED', message: 'ai.errors.aborted' };
      return this._networkError(err);
    } finally {
      this.controllers.delete(requestId);
    }
  }

  abort(requestId) {
    const c = this.controllers.get(requestId);
    if (c) c.abort();
    return { ok: !!c };
  }

  // ---------------------------------------------------------------- images

  /**
   * Candidate artwork search (spec §19). Returns URLs + source labels only.
   * provider: 'steam' | 'itunes' | 'rawg' | 'custom'
   */
  async searchImages(gameName, provider = 'steam', customUrls = [], rawgKey = '') {
    const term = String(gameName || '').trim();
    if (!term) return { ok: false, code: 'NO_TERM', results: [] };
    try {
      if (provider === 'custom') {
        const results = customUrls
          .filter((u) => /^https?:\/\//i.test(String(u)))
          .map((u, i) => ({ url: u, source: 'custom', label: 'custom #' + (i + 1), width: 0, height: 0 }));
        return { ok: true, results };
      }
      if (provider === 'rawg') {
        if (!rawgKey) return { ok: false, code: 'NO_KEY', results: [] };
        const res = await fetch('https://api.rawg.io/api/games?key=' + encodeURIComponent(rawgKey) + '&search=' + encodeURIComponent(term) + '&page_size=9');
        if (!res.ok) return this._httpError(res.status, await res.text().catch(() => ''));
        const data = await res.json();
        const results = (data.results || [])
          .filter((g) => g.background_image)
          .map((g) => ({ url: g.background_image, source: 'rawg', label: g.name, width: 0, height: 0 }));
        return { ok: true, results };
      }
      if (provider === 'itunes') {
        const res = await fetch('https://itunes.apple.com/search?media=software&limit=9&term=' + encodeURIComponent(term));
        if (!res.ok) return this._httpError(res.status, await res.text().catch(() => ''));
        const data = await res.json();
        const results = (data.results || [])
          .filter((r) => r.artworkUrl512 || r.artworkUrl100)
          .map((r) => ({
            url: (r.artworkUrl512 || r.artworkUrl100 || '').replace('512x512bb', '600x600bb'),
            source: 'itunes',
            label: r.trackName || term,
            width: 600,
            height: 600
          }));
        return { ok: true, results };
      }
      // default: Steam public store search + official CDN capsules
      const res = await fetch('https://store.steampowered.com/api/storesearch/?term=' + encodeURIComponent(term) + '&l=english&cc=US');
      if (!res.ok) return this._httpError(res.status, await res.text().catch(() => ''));
      const data = await res.json();
      const results = [];
      for (const item of (data.items || []).slice(0, 6)) {
        const id = item.id;
        results.push(
          { url: `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`, source: 'steam', label: item.name + ' (cover)', width: 600, height: 900 },
          { url: `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`, source: 'steam', label: item.name + ' (banner)', width: 460, height: 215 },
          { url: `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/capsule_616x353.jpg`, source: 'steam', label: item.name + ' (capsule)', width: 616, height: 353 }
        );
      }
      return { ok: true, results };
    } catch (err) {
      log.warn('image search failed:', err && err.message);
      return this._networkError(err);
    }
  }

  /**
   * Cache ONE user-selected image locally (never automatic, spec §19).
   * kind: 'cover' | 'banner' | 'icon'
   */
  async cacheImage(url, gameId, kind) {
    if (!/^https?:\/\//i.test(String(url))) return { ok: false, error: 'invalid-url' };
    const dir = kind === 'icon' ? paths.iconDir : paths.coverDir;
    const id = `${gameId}-${kind}-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 8)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'SosisLauncher/1.0' } });
      if (!res.ok) return { ok: false, error: 'http-' + res.status };
      const type = res.headers.get('content-type') || '';
      const ext = type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : type.includes('gif') ? '.gif' : '.jpg';
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_IMAGE_BYTES) return { ok: false, error: 'too-large' };
      const file = path.join(dir, id + ext);
      fs.writeFileSync(file, buf);
      return { ok: true, path: file };
    } catch (err) {
      return { ok: false, error: err && err.name === 'AbortError' ? 'timeout' : err.message };
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { AIManager };
