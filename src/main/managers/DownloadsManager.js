'use strict';
/**
 * DownloadsManager — Settings > Downloads (spec §44) plus an extensible
 * download queue scaffold for future features (game installs, asset packs).
 *
 * Today it owns: download folder, concurrency limit, auto-update toggle and a
 * live view of active jobs (the updater reports through here). The queue API
 * (addJob/listJobs) is implemented so future features can plug in without
 * refactoring.
 */
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { shell } = require('electron');
const { makeLogger } = require('../util/log');
const paths = require('../util/paths');
const { download, verifySha256, safeName } = require('../util/downloader');

const log = makeLogger('downloads');

class DownloadsManager extends EventEmitter {
  constructor(settings) {
    super();
    this.settings = settings;
    /** @type {Map<string, object>} */
    this.jobs = new Map();
    this.running = 0;
    this.queue = [];
  }

  folder() {
    const cfg = this.settings.get('downloads', 'folder');
    if (cfg && fs.existsSync(cfg)) return cfg;
    return paths.downloadsDir;
  }

  getSettings() {
    const cfg = { ...this.settings.get('downloads') };
    cfg.effectiveFolder = this.folder();
    return cfg;
  }

  setSettings(patch) {
    const next = this.settings.set('downloads', patch);
    return next;
  }

  openFolder() {
    const dir = this.folder();
    paths.ensure(dir);
    shell.openPath(dir);
    return { ok: true, dir };
  }

  listJobs() {
    return [...this.jobs.values()].map((j) => ({
      id: j.id,
      url: j.url,
      name: j.name,
      status: j.status,
      progress: j.progress,
      error: j.error || null
    }));
  }

  /** Queue a download job (future-proof API; used by tests + future features). */
  addJob(url, { name, sha256 } = {}) {
    const id = 'job-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const job = { id, url, name: name || safeName(url), sha256, status: 'queued', progress: null, error: null };
    this.jobs.set(id, job);
    this.queue.push(id);
    this._pump();
    return id;
  }

  _pump() {
    const limit = Math.max(1, Number(this.settings.get('downloads', 'concurrentDownloads')) || 3);
    while (this.running < limit && this.queue.length) {
      const id = this.queue.shift();
      const job = this.jobs.get(id);
      if (job) {
        this.running += 1;
        this._run(job);
      }
    }
  }

  async _run(job) {
    job.status = 'downloading';
    this.emit('changed', this.listJobs());
    const dest = path.join(this.folder(), job.name);
    const result = await download(job.url, dest, {
      onProgress: (p) => {
        job.progress = p;
        this.emit('progress', { id: job.id, ...p });
      }
    });
    this.running -= 1;
    if (!result.ok) {
      job.status = 'failed';
      job.error = result.error;
      log.warn('download job failed:', job.url, result.error);
    } else if (job.sha256 && !(await verifySha256(dest, job.sha256))) {
      job.status = 'verify-failed';
      job.error = 'sha256-mismatch';
      try {
        fs.unlinkSync(dest);
      } catch {}
    } else {
      job.status = 'done';
      job.progress = { bytes: result.bytes, total: result.bytes, percent: 100, speed: 0, etaSeconds: 0 };
    }
    this.emit('changed', this.listJobs());
    this._pump();
  }
}

module.exports = { DownloadsManager };
