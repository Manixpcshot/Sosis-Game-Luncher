'use strict';
/**
 * Sosis Launcher — Electron main entry point.
 *
 * Boot order (spec §42): storage -> language -> theme -> games -> settings ->
 * UI. Every step is fault-tolerant: a corrupted database, missing locale or
 * broken settings file degrades gracefully instead of crashing.
 */
const { app, Tray, Menu, nativeImage, BrowserWindow } = require('electron');
const path = require('path');

const logUtil = require('./src/main/util/log');
const paths = require('./src/main/util/paths');
const { registerSchemes, registerProtocol, createMainWindow } = require('./src/main/ui/window');
const { StorageManager } = require('./src/main/managers/StorageManager');
const { SettingsManager } = require('./src/main/managers/SettingsManager');
const { SecretsManager } = require('./src/main/managers/SecretsManager');
const { TranslationManager } = require('./src/main/managers/TranslationManager');
const { GameManager } = require('./src/main/managers/GameManager');
const { ProcessManager } = require('./src/main/managers/ProcessManager');
const { SessionManager } = require('./src/main/managers/SessionManager');
const { OverlayManager } = require('./src/main/managers/OverlayManager');
const { AIManager } = require('./src/main/managers/AIManager');
const { UpdateManager } = require('./src/main/managers/UpdateManager');
const { AccountManager } = require('./src/main/managers/AccountManager');
const { DownloadsManager } = require('./src/main/managers/DownloadsManager');
const { NotificationManager } = require('./src/main/managers/NotificationManager');
const { ShortcutManager } = require('./src/main/managers/ShortcutManager');
const { StoreManager } = require('./src/main/managers/StoreManager');
const netState = require('./src/main/net');
const { CH } = require('./src/shared/channels');
const { registerIpc } = require('./src/main/ipc');

app.setName('Sosis Launcher');

// Must happen before app is ready.
registerSchemes();

// Global safety nets: log + keep running (spec §43).
process.on('uncaughtException', (err) => {
  try {
    logUtil.makeLogger('fatal').error('uncaughtException:', err);
  } catch {}
});
process.on('unhandledRejection', (reason) => {
  try {
    logUtil.makeLogger('fatal').error('unhandledRejection:', reason);
  } catch {}
});

// Single instance (spec §40/UX): focus the existing window instead of running twice.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  let mainWindow = null;
  let tray = null;
  let quitting = false;
  const ctx = {};

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (!app.isPackaged && process.argv.includes('--dev')) {
    // dev flag reserved for tooling
  }

  app.whenReady().then(async () => {
    paths.init(app);
    logUtil.init(paths.userData);
    const log = logUtil.makeLogger('main');
    log.info('=== Sosis Launcher boot', app.getVersion(), process.platform, process.arch, '===');

    if (!app.isPackaged) {
      // friendly dev identity
    }

    registerProtocol(app);

    // 1) Storage (with recovery)
    const storage = new StorageManager();
    storage.init();

    // 2) Settings + language + theme
    const settings = new SettingsManager(storage);
    if (!settings.get('general', 'hardwareAcceleration')) {
      app.disableHardwareAcceleration();
    }

    // 3) Secrets / translations / domain managers
    const secrets = new SecretsManager(storage, require('electron').safeStorage);
    const translations = new TranslationManager(app);
    const games = new GameManager(storage);
    const proc = new ProcessManager();
    const sessions = new SessionManager(games, proc);
    const overlay = new OverlayManager(settings);
    const ai = new AIManager(settings, secrets, games);
    const updates = new UpdateManager(settings);
    const downloads = new DownloadsManager(settings);
    const account = new AccountManager(settings, secrets);
    const store = new StoreManager(account, downloads);
    netState.bind(account);
    const notifications = new NotificationManager(settings, translations);
    const shortcuts = new ShortcutManager();

    Object.assign(ctx, {
      app,
      storage,
      settings,
      secrets,
      translations,
      games,
      proc,
      sessions,
      overlay,
      ai,
      updates,
      downloads,
      account,
      store,
      notifications,
      shortcuts,
      getMain: () => mainWindow
    });

    // Session lifecycle side-effects: overlay + notifications (spec §28, §38)
    sessions.on('started', ({ gameId }) => {
      const game = games.get(gameId);
      if (!game) return;
      overlay.show(gameId, game.name, Date.now());
      notifications.notify('gameStarted', { name: game.name });
    });
    sessions.on('ended', ({ gameId, seconds }) => {
      overlay.hide();
      const game = games.get(gameId);
      notifications.notify('sessionFinished', {
        name: game ? game.name : '',
        time: formatClock(seconds)
      });
      // push the finished session to the Sosis Web Platform (leaderboard etc.)
      if (game) account.syncSession(game.name, seconds).catch(() => {});
    });

    // 4) Main window + IPC
    mainWindow = createMainWindow(ctx);
    registerIpc(ctx);

    // Offline-mode awareness: probe on boot + on window focus (throttled 30s).
    netState.onChange((ns) => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(CH.NET_STATE, ns);
      } catch {}
    });
    setTimeout(() => {
      netState.probe(true).catch(() => {});
    }, 1200);
    app.on('browser-window-focus', () => {
      netState.probe(false).catch(() => {});
    });

    mainWindow.on('close', (e) => {
      if (!quitting && settings.get('general', 'closeToTray') && tray) {
        e.preventDefault();
        mainWindow.hide();
      }
    });

    // 5) Tray
    try {
      const iconPath = path.join(app.getAppPath(), 'assets', 'icons', 'tray.png');
      const icon = nativeImage.createFromPath(iconPath);
      tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
      tray.setToolTip('Sosis Launcher');
      const locale = settings.get('language', 'locale');
      const bundle = translations.get(locale).messages;
      const t = (k, d) => bundle[k] || d;
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: t('tray.show', 'Show Sosis Launcher'), click: () => mainWindow && mainWindow.show() },
          {
            label: t('tray.checkUpdates', 'Check for updates'),
            click: () => updates.check()
          },
          { type: 'separator' },
          {
            label: t('tray.quit', 'Quit'),
            click: () => {
              quitting = true;
              app.quit();
            }
          }
        ])
      );
      tray.on('double-click', () => mainWindow && mainWindow.show());
    } catch (err) {
      log.warn('tray unavailable:', err && err.message);
    }

    // 6) Startup update pipeline: check -> auto download -> verify -> install
    //    -> the installer relaunches the app with the new version applied.
    if (settings.get('general', 'checkUpdatesOnStart')) {
      setTimeout(async () => {
        const ns = await netState.probe(true).catch(() => ({ internet: false, server: false }));
        if (!ns || !ns.internet || !ns.server) {
          log.info('offline mode — skipping startup update check');
          return;
        }
        updates
          .autoCheckAndApply()
          .then((r) => {
            if (r && r.ok && r.updateAvailable && !r.installing) {
              notifications.notify('updateAvailable', { version: r.latest });
            }
          })
          .catch(() => {});
      }, 6000);
    }

    log.info('boot complete');
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'win32' && process.platform !== 'darwin') app.quit();
    else if (process.platform === 'darwin') app.quit();
    // On Windows keep running in tray when closeToTray is enabled.
    else if (!(ctx.settings && ctx.settings.get('general', 'closeToTray'))) app.quit();
  });

  app.on('before-quit', () => {
    quitting = true;
    try {
      if (ctx.overlay) ctx.overlay.dispose();
      if (ctx.proc) ctx.proc.dispose();
      if (ctx.sessions) ctx.sessions.dispose();
      if (ctx.storage) ctx.storage.close();
    } catch {}
  });

  app.on('activate', () => {
    if (mainWindow) mainWindow.show();
  });
}

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}
