'use strict';
/**
 * downloader — streaming HTTP(S) download with progress + SHA-256 verification.
 * Shared by the Update System (spec §45) and the Downloads manager / installer
 * payload contract (spec §46-50). Retries are handled by callers (spec §49).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const MAX_REDIRECTS = 5;

/**
 * @param {string} url
 * @param {string} destFile
 * @param {{onProgress?:Function, signal?:AbortSignal, timeoutMs?:number}} opts
 * @returns {Promise<{ok:boolean, bytes:number, sha256:string, error?:string}>}
 */
function download(url, destFile, opts = {}) {
  return new Promise((resolve) => {
    let redirects = 0;
    let settled = false;
    const finish = (r) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };

    const attempt = (currentUrl) => {
      const mod = currentUrl.startsWith('https:') ? https : http;
      const req = mod.get(
        currentUrl,
        { timeout: opts.timeoutMs || 30000, headers: Object.assign({ 'user-agent': 'SosisLauncher/1.0' }, opts.headers || {}) },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            if (++redirects > MAX_REDIRECTS) return finish({ ok: false, bytes: 0, sha256: '', error: 'too-many-redirects' });
            return attempt(new URL(res.headers.location, currentUrl).toString());
          }
          if (res.statusCode !== 200) {
            res.resume();
            return finish({ ok: false, bytes: 0, sha256: '', error: 'http-' + res.statusCode });
          }
          const total = Number(res.headers['content-length'] || 0);
          const hash = crypto.createHash('sha256');
          let bytes = 0;
          const startedAt = Date.now();
          let lastReport = 0;
          const out = fs.createWriteStream(destFile);
          const abort = () => {
            res.destroy();
            out.destroy();
          };
          if (opts.signal) {
            if (opts.signal.aborted) return abort();
            opts.signal.addEventListener('abort', abort, { once: true });
          }
          res.on('data', (chunk) => {
            bytes += chunk.length;
            hash.update(chunk);
            const now = Date.now();
            if (opts.onProgress && now - lastReport > 250) {
              lastReport = now;
              const elapsed = (now - startedAt) / 1000;
              const speed = bytes / Math.max(elapsed, 0.001);
              opts.onProgress({
                bytes,
                total,
                percent: total ? Math.min(100, (bytes / total) * 100) : 0,
                speed,
                etaSeconds: total && speed > 0 ? Math.max(0, (total - bytes) / speed) : 0
              });
            }
          });
          res.on('error', (err) => {
            out.destroy();
            finish({ ok: false, bytes, sha256: '', error: err.message });
          });
          out.on('error', (err) => finish({ ok: false, bytes, sha256: '', error: err.message }));
          out.on('finish', () => {
            if (opts.onProgress) opts.onProgress({ bytes, total: total || bytes, percent: 100, speed: 0, etaSeconds: 0 });
            finish({ ok: true, bytes, sha256: hash.digest('hex') });
          });
          res.pipe(out);
        }
      );
      req.on('timeout', () => {
        req.destroy(new Error('timeout'));
      });
      req.on('error', (err) => finish({ ok: false, bytes: 0, sha256: '', error: err.message }));
    };

    try {
      attempt(url);
    } catch (err) {
      finish({ ok: false, bytes: 0, sha256: '', error: err.message });
    }
  });
}

function verifySha256(file, expected) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('error', () => resolve(false));
    stream.on('data', (c) => hash.update(c));
    stream.on('end', () => resolve(hash.digest('hex').toLowerCase() === String(expected).toLowerCase()));
  });
}

function safeName(url) {
  try {
    const u = new URL(url);
    return path.basename(u.pathname).replace(/[^\w.\-]/g, '_') || 'download.bin';
  } catch {
    return 'download.bin';
  }
}

module.exports = { download, verifySha256, safeName };
