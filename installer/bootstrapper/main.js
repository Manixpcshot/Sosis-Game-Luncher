'use strict';
/**
 * Sosis Launcher — Web Installer / Bootstrapper (spec §46-51).
 *
 * Flow:
 *   SosisLauncherSetup.exe
 *     -> connect to Launcher Download Endpoint (installer/config.json)
 *     -> fetch payload manifest (files + sha256 + sizes)
 *     -> download with progress (speed / ETA / current file)
 *     -> verify SHA-256 (abort install on mismatch)
 *     -> run the downloaded installer (silent), which creates shortcuts
 *     -> finish -> launch Sosis Launcher
 *
 * Failures show Retry / Cancel and never install partial or corrupt files.
 */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const { URL } = require('url');

const CONFIG = loadConfig();
let win = null;
let abortController = null;

function loadConfig() {
  const candidates = [
    path.join(__dirname, '..', 'config.json'),
    path.join(__dirname, 'config.json')
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {}
  }
  return { DOWNLOAD_BASE_URL: 'https://sosis-shop.top/app/datasetup' };
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

app.setName('Sosis Launcher Setup');

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 640,
    height: 480,
    resizable: false,
    frame: false,
    backgroundColor: '#0a0d14',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'ui.html'));

  ipcMain.handle('setup:config', () => ({
    endpoint: process.env.DOWNLOAD_BASE_URL || CONFIG.DOWNLOAD_BASE_URL,
    product: CONFIG.PRODUCT_NAME || 'Sosis Launcher'
  }));

  ipcMain.handle('setup:fetchManifest', async () => {
    const base = process.env.DOWNLOAD_BASE_URL || CONFIG.DOWNLOAD_BASE_URL;
    try {
      const res = await fetch(base, { headers: { accept: 'application/json' } });
      if (!res.ok) return { ok: false, error: 'http-' + res.status };
      const manifest = await res.json();
      if (!manifest || !Array.isArray(manifest.files) || !manifest.files.length) {
        return { ok: false, error: 'bad-manifest' };
      }
      return { ok: true, manifest };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  ipcMain.handle('setup:download', async (_e, { url, sha256, size }) => {
    const tmpDir = path.join(os.tmpdir(), 'sosis-setup');
    fs.mkdirSync(tmpDir, { recursive: true });
    const dest = path.join(tmpDir, 'SosisLauncherSetup-payload.exe');
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    abortController = { aborted: false };
    const result = await downloadFile(url, dest, (p) => send('setup:progress', p), abortController);
    if (!result.ok) {
      try {
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
      } catch {}
      return { ok: false, error: result.error };
    }
    if (sha256) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
      if (actual.toLowerCase() !== String(sha256).toLowerCase()) {
        fs.unlinkSync(dest);
        return { ok: false, error: 'sha256-mismatch' };
      }
    }
    return { ok: true, file: dest, bytes: result.bytes };
  });

  ipcMain.handle('setup:cancel', () => {
    if (abortController) abortController.aborted = true;
    return { ok: true };
  });

  ipcMain.handle('setup:install', async (_e, { file }) => {
    if (!file || !fs.existsSync(file)) return { ok: false, error: 'missing-file' };
    try {
      // Run the real installer silently; NSIS creates shortcuts + uninstaller.
      const child = spawn(file, ['/S'], { detached: true, stdio: 'ignore' });
      child.unref();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('setup:launch', async () => {
    // Best effort: launch installed launcher from the default location.
    const candidates = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Sosis Launcher', 'SosisLauncher.exe'),
      path.join(process.env.ProgramFiles || '', 'Sosis Launcher', 'SosisLauncher.exe')
    ];
    for (const exe of candidates) {
      if (exe && fs.existsSync(exe)) {
        const child = spawn(exe, [], { detached: true, stdio: 'ignore' });
        child.unref();
        return { ok: true, exe };
      }
    }
    return { ok: false, error: 'not-found' };
  });

  ipcMain.handle('setup:quit', () => {
    app.quit();
    return { ok: true };
  });
  ipcMain.handle('setup:openExternal', (_e, url) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
    return { ok: true };
  });
});

function downloadFile(url, dest, onProgress, cancel) {
  return new Promise((resolve) => {
    let redirects = 0;
    const attempt = (current) => {
      const mod = current.startsWith('https:') ? https : http;
      const req = mod.get(current, { headers: { 'user-agent': 'SosisLauncherSetup/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (++redirects > 5) return resolve({ ok: false, error: 'too-many-redirects' });
          return attempt(new URL(res.headers.location, current).toString());
        }
        if (res.statusCode !== 200) {
          res.resume();
          return resolve({ ok: false, error: 'http-' + res.statusCode });
        }
        const total = Number(res.headers['content-length'] || 0);
        let bytes = 0;
        const startedAt = Date.now();
        let last = 0;
        const out = fs.createWriteStream(dest);
        const timer = setInterval(() => {
          if (cancel && cancel.aborted) {
            res.destroy();
            out.destroy();
            clearInterval(timer);
            resolve({ ok: false, error: 'cancelled' });
          }
        }, 200);
        res.on('data', (c) => {
          bytes += c.length;
          const now = Date.now();
          if (now - last > 200) {
            last = now;
            const elapsed = (now - startedAt) / 1000;
            const spd = bytes / Math.max(elapsed, 0.001);
            onProgress({
              bytes,
              total,
              percent: total ? Math.min(100, (bytes / total) * 100) : 0,
              speed: spd,
              etaSeconds: total && spd > 0 ? Math.max(0, (total - bytes) / spd) : 0
            });
          }
        });
        res.on('error', (e) => {
          clearInterval(timer);
          out.destroy();
          resolve({ ok: false, error: e.message });
        });
        out.on('error', (e) => {
          clearInterval(timer);
          resolve({ ok: false, error: e.message });
        });
        out.on('finish', () => {
          clearInterval(timer);
          onProgress({ bytes, total: total || bytes, percent: 100, speed: 0, etaSeconds: 0 });
          resolve({ ok: true, bytes });
        });
        res.pipe(out);
      });
      req.on('error', (e) => resolve({ ok: false, error: e.message }));
    };
    attempt(url);
  });
}
