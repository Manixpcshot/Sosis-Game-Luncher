'use strict';
/**
 * UpdateManager — self-update pipeline (spec §45).
 *
 *  1. read current version (package.json / app.getVersion)
 *  2. fetch manifest (latest.json / version.json) from the update server
 *  3. compare versions
 *  4. download installer with progress events
 *  5. verify SHA-256 integrity — abort on mismatch (spec §50)
 *  6. run installer and quit
 *
 * The manifest URL defaults to the Sosis shop server and can be overridden
 * with the SOSIS_UPDATE_URL environment variable (never hard-locked).
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const { app } = require('electron');
const { makeLogger } = require('../util/log');
const paths = require('../util/paths');
const semver = require('../util/semver');
const { download, verifySha256 } = require('../util/downloader');

const log = makeLogger('update');

const DEFAULT_MANIFEST_URL = 'https://sosis-shop.top/app/latest.json';

class UpdateManager extends EventEmitter {
  constructor(settings) {
    super();
    this.settings = settings;
    this.state = { phase: 'idle', progress: null, info: null, error: null };
    this.abortController = null;
  }

  get manifestUrl() {
    return process.env.SOSIS_UPDATE_URL || DEFAULT_MANIFEST_URL;
  }

  currentVersion() {
    try {
      return app.getVersion();
    } catch {
      return '0.0.0';
    }
  }

  _setState(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }

  async check() {
    this._setState({ phase: 'checking', error: null });
    try {
      const res = await fetch(this.manifestUrl, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error('http-' + res.status);
      const manifest = await res.json();
      if (!manifest || !manifest.version) throw new Error('bad-manifest');
      const current = this.currentVersion();
      const channel = this.settings.get('general', 'updateChannel');
      if (manifest.channel && channel && manifest.channel !== channel) {
        this._setState({ phase: 'up-to-date', info: { current, latest: manifest.version } });
        return { ok: true, updateAvailable: false, current, latest: manifest.version, reason: 'channel' };
      }
      const updateAvailable = semver.isNewer(current, manifest.version);
      this._setState({
        phase: updateAvailable ? 'available' : 'up-to-date',
        info: {
          current,
          latest: manifest.version,
          download: manifest.download || null,
          sha256: manifest.sha256 || null,
          notes: manifest.notes || '',
          size: manifest.size || 0
        }
      });
      return { ok: true, updateAvailable, current, latest: manifest.version, info: this.state.info };
    } catch (err) {
      log.warn('update check failed:', err.message);
      this._setState({ phase: 'error', error: err.message });
      return { ok: false, error: err.message };
    }
  }

  async downloadUpdate() {
    const info = this.state.info;
    if (!info || !info.download) return { ok: false, error: 'no-download-url' };
    const dest = path.join(paths.updatesDir, 'SosisLauncherSetup-' + info.latest + '.exe');
    this.abortController = new AbortController();
    this._setState({ phase: 'downloading', progress: { bytes: 0, total: info.size || 0, percent: 0, speed: 0, etaSeconds: 0 } });
    const result = await download(info.download, dest, {
      signal: this.abortController.signal,
      onProgress: (p) => {
        this.emit('progress', p);
        this.state.progress = p;
      }
    });
    if (!result.ok) {
      try {
        if (fs.existsSync(dest)) fs.unlinkSync(dest); // never keep partial files
      } catch {}
      this._setState({ phase: 'download-failed', error: result.error });
      return { ok: false, error: result.error, retryable: true };
    }
    // Integrity (spec §50)
    if (info.sha256) {
      this._setState({ phase: 'verifying' });
      const good = await verifySha256(dest, info.sha256);
      if (!good) {
        try {
          fs.unlinkSync(dest);
        } catch {}
        this._setState({ phase: 'verify-failed', error: 'sha256-mismatch' });
        return { ok: false, error: 'sha256-mismatch', retryable: true };
      }
    }
    this._setState({ phase: 'ready', progress: { bytes: result.bytes, total: result.bytes, percent: 100, speed: 0, etaSeconds: 0 } });
    this.downloadedFile = dest;
    return { ok: true, file: dest };
  }

  cancelDownload() {
    if (this.abortController) this.abortController.abort();
    this._setState({ phase: 'idle' });
    return { ok: true };
  }

  install() {
    const file = this.downloadedFile;
    if (!file || !fs.existsSync(file)) return { ok: false, error: 'no-installer' };
    try {
      const child = spawn(file, ['--update'], { detached: true, stdio: 'ignore' });
      child.unref();
      this._setState({ phase: 'installing' });
      setTimeout(() => app.quit(), 600);
      return { ok: true };
    } catch (err) {
      this._setState({ phase: 'error', error: err.message });
      return { ok: false, error: err.message };
    }
  }
}

module.exports = { UpdateManager, DEFAULT_MANIFEST_URL };
