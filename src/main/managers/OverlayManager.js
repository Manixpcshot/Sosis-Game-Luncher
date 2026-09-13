'use strict';
/**
 * OverlayManager — the in-game overlay (spec §31-39).
 *
 * The overlay is a SEPARATE, independent, transparent, click-through Electron
 * window. Nothing is injected into game processes: no DLLs, no hooks, no
 * memory access. It renders exactly two data points: FPS and session play
 * time. FPS is measured safely from the overlay's own compositor frame rate
 * (see README "Overlay FPS limitations"); when unavailable it shows "--"
 * instead of crashing or guessing (spec §39).
 */
const path = require('path');
const { BrowserWindow, screen, ipcMain } = require('electron');
const { makeLogger } = require('../util/log');
const { CH } = require('../../shared/channels');

const log = makeLogger('overlay');

const BASE_SIZE = { w: 232, h: 92 };
const SCALE_FACTORS = { small: 0.85, medium: 1, large: 1.2 };

class OverlayManager {
  constructor(settings) {
    this.settings = settings;
    this.win = null;
    this.ready = false;
    this.visible = false;
    this.state = null; // {gameId, gameName, startedAt}
    this.previewTimer = null;
    ipcMain.on(CH.OVERLAY_READY, () => {
      this.ready = true;
      this._pushState();
    });
  }

  get config() {
    return this.settings.get('overlay');
  }

  _create() {
    if (this.win) return this.win;
    const cfg = this.config;
    const factor = SCALE_FACTORS[cfg.scale] || 1;
    this.win = new BrowserWindow({
      width: Math.round(BASE_SIZE.w * factor),
      height: Math.round(BASE_SIZE.h * factor),
      x: 0,
      y: 0,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      focusable: false,
      alwaysOnTop: true,
      hasShadow: false,
      fullscreenable: false,
      webPreferences: {
        preload: path.join(__dirname, '..', '..', '..', 'overlay', 'overlay-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false
      }
    });
    this.win.setAlwaysOnTop(true, 'screen-saver', 1);
    this.win.setIgnoreMouseInputs(true); // never steal input from a game
    this.win.on('closed', () => {
      this.win = null;
      this.ready = false;
      this.visible = false;
    });
    this.win.webContents.once('did-finish-load', () => {
      this.ready = true;
      this._pushState();
    });
    this.win.loadURL('sosis://app/overlay/overlay.html');
    screen.on('display-metrics-changed', () => this._position());
    return this.win;
  }

  _position() {
    if (!this.win) return;
    const cfg = this.config;
    const factor = SCALE_FACTORS[cfg.scale] || 1;
    const w = Math.round(BASE_SIZE.w * factor);
    const h = Math.round(BASE_SIZE.h * factor);
    this.win.setSize(w, h);
    const wa = screen.getPrimaryDisplay().workArea;
    const m = cfg.margin;
    let x = wa.x + m;
    let y = wa.y + m;
    switch (cfg.position) {
      case 'top-left':
        x = wa.x + m;
        y = wa.y + m;
        break;
      case 'top-right':
        x = wa.x + wa.width - w - m;
        y = wa.y + m;
        break;
      case 'bottom-left':
        x = wa.x + m;
        y = wa.y + wa.height - h - m;
        break;
      case 'bottom-right':
      default:
        x = wa.x + wa.width - w - m;
        y = wa.y + wa.height - h - m;
        break;
    }
    this.win.setPosition(Math.round(x), Math.round(y));
    try {
      this.win.setOpacity(Math.max(0.1, Math.min(1, cfg.opacity / 100)));
    } catch {}
  }

  _pushState() {
    if (!this.win || !this.ready) return;
    const cfg = this.config;
    this.win.webContents.send(CH.OVERLAY_STATE, {
      session: this.state,
      showFps: cfg.showFps,
      scale: cfg.scale,
      opacity: cfg.opacity
    });
  }

  /** Show the overlay for a running game session. */
  show(gameId, gameName, startedAt) {
    if (!this.config.enabled) return { ok: false, reason: 'disabled' };
    this.state = { gameId, gameName, startedAt };
    const win = this._create();
    this._position();
    if (!win.isVisible()) win.showInactive();
    this.visible = true;
    this._pushState();
    log.info('Overlay shown for', gameName);
    return { ok: true };
  }

  hide() {
    this.state = null;
    if (this.win && this.win.isVisible()) this.win.hide();
    this.visible = false;
  }

  /** Temporary preview from Settings > Overlay (auto-hides). */
  preview(seconds = 6) {
    const startedAt = Date.now() - 754000; // looks like a live session (00:12:34)
    this.show('preview', 'Sosis Launcher', startedAt);
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      if (this.state && this.state.gameId === 'preview') this.hide();
    }, seconds * 1000);
    return { ok: this.config.enabled };
  }

  applySettings() {
    if (!this.win) return;
    this._position();
    this._pushState();
    if (!this.config.enabled && this.visible && (!this.state || this.state.gameId === 'preview')) this.hide();
  }

  dispose() {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    if (this.win) {
      try {
        this.win.close();
      } catch {}
    }
    this.win = null;
  }
}

module.exports = { OverlayManager };
