'use strict';
/**
 * Main window + secure custom protocol (sosis://).
 *
 * The renderer is served through a privileged standard scheme instead of
 * file:// so ES modules, fetch and CSP behave like a normal web origin while
 * still loading entirely from disk (offline, no server).
 */
const path = require('path');
const fs = require('fs');
const { protocol, BrowserWindow, screen } = require('electron');
const { makeLogger } = require('../util/log');
const paths = require('../util/paths');

const log = makeLogger('window');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

let appRoot = null;

function registerSchemes() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'sosis',
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
    }
  ]);
}

function registerProtocol(app) {
  appRoot = app.getAppPath();
  protocol.handle('sosis', (request) => {
    try {
      const url = new URL(request.url);
      let baseDir;
      let rel;
      if (url.hostname === 'app') {
        baseDir = appRoot;
        rel = decodeURIComponent(url.pathname);
      } else if (url.hostname === 'userdata') {
        baseDir = paths.userData;
        rel = decodeURIComponent(url.pathname);
        // whitelist: only art + icons are servable from userData
        if (!/^\/(art|icons)\//.test(rel)) return new Response('forbidden', { status: 403 });
      } else {
        return new Response('not found', { status: 404 });
      }
      const file = path.normalize(path.join(baseDir, rel));
      if (!file.startsWith(baseDir)) return new Response('forbidden', { status: 403 });
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('not found', { status: 404 });
      const ext = path.extname(file).toLowerCase();
      const body = new Uint8Array(fs.readFileSync(file));
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': MIME[ext] || 'application/octet-stream',
          'cache-control': 'no-store'
        }
      });
    } catch (err) {
      log.error('protocol error:', err);
      return new Response('error', { status: 500 });
    }
  });
}

function createMainWindow(ctx) {
  const { settings } = ctx;
  const appearance = settings.get('appearance');
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 620,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: appearance.theme === 'light' ? '#f2f4f8' : '#0a0d14',
    icon: path.join(appRoot, 'assets', 'icons', 'icon.png'),
    title: 'Sosis Launcher',
    webPreferences: {
      preload: path.join(appRoot, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs to require the shared channel contract
      spellcheck: false,
      devTools: true
    }
  });

  win.once('ready-to-show', () => {
    if (!settings.get('general', 'startMinimized')) win.show();
  });

  win.on('maximize', () => win.webContents.send('sosis:event:windowState', { maximized: true }));
  win.on('unmaximize', () => win.webContents.send('sosis:event:windowState', { maximized: false }));

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('sosis://')) e.preventDefault();
  });

  win.loadURL('sosis://app/src/index.html');

  if (settings.get('advanced', 'devTools')) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
  return win;
}

module.exports = { registerSchemes, registerProtocol, createMainWindow, MIME };
