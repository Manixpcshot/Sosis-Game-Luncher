'use strict';
/**
 * IPC router — every renderer<->main channel in one audited place (spec §63).
 * Handlers validate input, never throw across the bridge and always answer
 * with { ok, data? , error? } so the UI can render precise feedback (spec §59).
 */
const fs = require('fs');
const path = require('path');
const { ipcMain, dialog, shell, app } = require('electron');
const { CH } = require('../shared/channels');
const { makeLogger } = require('./util/log');
const { nameFromExe } = require('./managers/GameManager');

const log = makeLogger('ipc');

function ok(data) {
  return { ok: true, data };
}
function fail(error, code) {
  return { ok: false, error: String(error && error.message ? error.message : error), code };
}

async function guard(fn) {
  try {
    return await fn();
  } catch (err) {
    log.error('IPC handler error:', err);
    return fail(err);
  }
}

function send(win, channel, payload) {
  try {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  } catch {}
}

function registerIpc(ctx) {
  const {
    storage,
    settings,
    secrets,
    translations,
    games,
    sessions,
    overlay,
    ai,
    updates,
    downloads,
    notifications,
    shortcuts,
    getMain
  } = ctx;

  // ------------------------------------------------------------- boot/meta
  ipcMain.handle(CH.APP_BOOT, () =>
    guard(() => {
      const locale = settings.get('language', 'locale');
      return ok({
        meta: {
          version: app.getVersion(),
          platform: process.platform,
          arch: process.arch,
          appName: 'Sosis Launcher',
          isPackaged: app.isPackaged
        },
        settings: settings.forRenderer(),
        i18n: translations.get(locale),
        games: games.list(),
        sessions: sessions.active(),
        storage: storage.info(),
        overlay: settings.get('overlay')
      });
    })
  );

  ipcMain.handle(CH.APP_META, () =>
    guard(() =>
      ok({
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged,
        secretsMethod: secrets.describe().method
      })
    )
  );

  // ------------------------------------------------------------- window
  ipcMain.handle(CH.WIN_MINIMIZE, () => guard(() => (getMain()?.minimize(), ok(true))));
  ipcMain.handle(CH.WIN_MAXIMIZE, () =>
    guard(() => {
      const w = getMain();
      if (!w) return ok(false);
      if (w.isMaximized()) w.unmaximize();
      else w.maximize();
      return ok(w.isMaximized());
    })
  );
  ipcMain.handle(CH.WIN_CLOSE, () => guard(() => (getMain()?.close(), ok(true))));
  ipcMain.handle(CH.WIN_IS_MAXIMIZED, () => guard(() => ok(!!getMain()?.isMaximized())));

  // ------------------------------------------------------------- shell
  ipcMain.handle(CH.SHELL_OPEN_PATH, (_e, p) =>
    guard(async () => {
      if (!p || typeof p !== 'string') return fail('invalid path');
      const result = await shell.openPath(p);
      return result ? fail(result) : ok(true);
    })
  );
  ipcMain.handle(CH.SHELL_SHOW_ITEM, (_e, p) =>
    guard(() => {
      if (!p || typeof p !== 'string' || !fs.existsSync(p)) return fail('file-missing');
      shell.showItemInFolder(p);
      return ok(true);
    })
  );
  ipcMain.handle(CH.SHELL_OPEN_EXTERNAL, (_e, url) =>
    guard(() => {
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return fail('invalid-url');
      shell.openExternal(url);
      return ok(true);
    })
  );

  // ------------------------------------------------------------- games
  ipcMain.handle(CH.GAMES_LIST, () => guard(() => ok(games.list())));

  ipcMain.handle(CH.GAMES_PICK_EXE, () =>
    guard(async () => {
      const win = getMain();
      const res = await dialog.showOpenDialog(win, {
        title: 'Select game executable',
        properties: ['openFile'],
        filters: [{ name: 'Executable', extensions: ['exe'] }, { name: 'All files', extensions: ['*'] }]
      });
      if (res.canceled || !res.filePaths.length) return ok({ canceled: true });
      return ok({ canceled: false, path: res.filePaths[0], suggestedName: nameFromExe(res.filePaths[0]) });
    })
  );

  ipcMain.handle(CH.GAMES_ADD, (_e, payload) =>
    guard(async () => {
      const { exePath, name, description } = payload || {};
      const game = await games.add({ exePath, name, description });
      return ok(game);
    })
  );

  ipcMain.handle(CH.GAMES_UPDATE, (_e, payload) =>
    guard(() => ok(games.update(payload.id, payload.patch || {})))
  );

  ipcMain.handle(CH.GAMES_REMOVE, (_e, payload) =>
    guard(() => {
      // Library entry only — game files are NEVER deleted (spec §65).
      if (sessions.describe(payload && payload.id)) return fail('game-running');
      return ok(games.remove(payload && payload.id));
    })
  );

  ipcMain.handle(CH.GAMES_SET_FAVORITE, (_e, payload) =>
    guard(() => ok(games.setFavorite(payload.id, payload.favorite)))
  );

  ipcMain.handle(CH.GAMES_LOCATE_EXE, (_e, payload) =>
    guard(async () => {
      const win = getMain();
      const res = await dialog.showOpenDialog(win, {
        title: 'Locate game executable',
        properties: ['openFile'],
        filters: [{ name: 'Executable', extensions: ['exe'] }]
      });
      if (res.canceled || !res.filePaths.length) return ok({ canceled: true });
      const game = games.update(payload.id, { exePath: res.filePaths[0] });
      return ok({ canceled: false, game });
    })
  );

  ipcMain.handle(CH.GAMES_OPEN_FOLDER, (_e, payload) =>
    guard(async () => {
      const game = games.get(payload && payload.id);
      if (!game) return fail('not-found');
      const dir = game.gameFolder && fs.existsSync(game.gameFolder) ? game.gameFolder : path.dirname(game.exePath);
      const err = await shell.openPath(dir);
      return err ? fail(err) : ok(dir);
    })
  );

  ipcMain.handle(CH.GAMES_PICK_IMAGE, (_e, payload) =>
    guard(async () => {
      const win = getMain();
      const res = await dialog.showOpenDialog(win, {
        title: 'Choose image',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
      });
      if (res.canceled || !res.filePaths.length) return ok({ canceled: true });
      // Copy into the app art cache so library art survives file moves.
      const src = res.filePaths[0];
      const dest = path.join(paths.coverDir, 'local-' + Date.now() + path.extname(src));
      fs.copyFileSync(src, dest);
      return ok({ canceled: false, path: dest });
    })
  );

  ipcMain.handle(CH.GAMES_SET_ART, (_e, payload) =>
    guard(async () => {
      const { id, kind, source, value } = payload || {};
      if (!['cover', 'banner', 'icon'].includes(kind)) return fail('invalid-kind');
      let finalPath = null;
      if (source === 'path') {
        if (!value || !fs.existsSync(value)) return fail('file-missing');
        finalPath = value;
      } else if (source === 'url') {
        const cached = await ai.cacheImage(value, id, kind);
        if (!cached.ok) return fail(cached.error);
        finalPath = cached.path;
      } else if (source === 'clear') {
        finalPath = null;
      } else {
        return fail('invalid-source');
      }
      return ok(games.update(id, { [kind]: finalPath }));
    })
  );

  ipcMain.handle(CH.GAMES_SEARCH_IMAGES, (_e, payload) =>
    guard(async () => {
      const { name, provider, customUrls, rawgKey } = payload || {};
      return ok(await ai.searchImages(name, provider || 'steam', customUrls || [], rawgKey || ''));
    })
  );

  ipcMain.handle(CH.GAMES_LAUNCH, (_e, payload) =>
    guard(() => {
      const game = games.get(payload && payload.id);
      if (!game) return fail('not-found');
      if (!fs.existsSync(game.exePath)) return fail('exe-missing', 'EXE_NOT_FOUND');
      const result = sessions.start(game);
      return result.ok ? ok(result.session) : fail(result.error, result.code);
    })
  );

  ipcMain.handle(CH.GAMES_STOP_TRACKING, (_e, payload) =>
    guard(() => ok(sessions.proc.stopTracking(payload && payload.id)))
  );

  ipcMain.handle(CH.SESSIONS_ACTIVE, () => guard(() => ok(sessions.active())));

  // ------------------------------------------------------------- settings
  ipcMain.handle(CH.SETTINGS_GET, () => guard(() => ok(settings.forRenderer())));
  ipcMain.handle(CH.SETTINGS_SET, (_e, payload) =>
    guard(() => {
      const { section, patch } = payload || {};
      const next = settings.set(section, patch);
      applySideEffects(ctx, section, patch);
      return ok(next);
    })
  );
  ipcMain.handle(CH.SETTINGS_RESET, (_e, payload) =>
    guard(() => {
      const next = settings.reset(payload && payload.section);
      applySideEffects(ctx, null, null);
      return ok(next);
    })
  );

  // ------------------------------------------------------------- i18n
  ipcMain.handle(CH.I18N_GET, (_e, payload) => guard(() => ok(translations.get((payload && payload.locale) || 'en'))));

  // ------------------------------------------------------------- AI
  ipcMain.handle(CH.AI_SETTINGS_GET, () => guard(() => ok(ai.getSettings())));
  ipcMain.handle(CH.AI_SETTINGS_SAVE, (_e, payload) => guard(() => ok(ai.saveSettings(payload || {}))));
  ipcMain.handle(CH.AI_TEST, () => guard(() => ok(await_ai_test(ai))));
  ipcMain.handle(CH.AI_CHAT, (_e, payload) =>
    guard(async () => {
      const { requestId, messages } = payload || {};
      const result = await ai.chat({
        requestId,
        messages,
        onChunk: (delta) => send(getMain(), CH.EVT_AI_CHUNK, { requestId, delta })
      });
      return result.ok ? ok(result) : fail(result.message || result.code, result.code);
    })
  );
  ipcMain.handle(CH.AI_CHAT_ABORT, (_e, payload) => guard(() => ok(ai.abort(payload && payload.requestId))));

  // ------------------------------------------------------------- overlay
  ipcMain.handle(CH.OVERLAY_GET, () => guard(() => ok(settings.get('overlay'))));
  ipcMain.handle(CH.OVERLAY_SET, (_e, payload) =>
    guard(() => {
      const next = settings.set('overlay', payload || {});
      overlay.applySettings();
      return ok(next);
    })
  );
  ipcMain.handle(CH.OVERLAY_PREVIEW, () => guard(() => ok(overlay.preview(6))));

  // ------------------------------------------------------------- updates
  ipcMain.handle(CH.UPDATE_CHECK, () => guard(async () => ok(await updates.check())));
  ipcMain.handle(CH.UPDATE_DOWNLOAD, () => guard(async () => ok(await updates.downloadUpdate())));
  ipcMain.handle(CH.UPDATE_INSTALL, () => guard(() => ok(updates.install())));

  // ------------------------------------------------------------- misc
  ipcMain.handle(CH.NOTIFY_TEST, () => guard(() => ok(notifications.notify('test'))));
  ipcMain.handle(CH.SHORTCUT_CREATE_GAME, (_e, payload) =>
    guard(() => {
      const game = games.get(payload && payload.id);
      if (!game) return fail('not-found');
      return ok(shortcuts.createForGame(game, (payload && payload.kind) || 'both'));
    })
  );
  ipcMain.handle(CH.SHORTCUT_CREATE_LAUNCHER, (_e, payload) =>
    guard(() => ok(shortcuts.createForLauncher((payload && payload.kind) || 'both')))
  );

  ipcMain.handle(CH.STORAGE_INFO, () => guard(() => ok(storage.info())));
  ipcMain.handle(CH.STORAGE_EXPORT, (_e, payload) =>
    guard(async () => {
      const win = getMain();
      const res = await dialog.showSaveDialog(win, {
        title: 'Export library',
        defaultPath: 'sosis-library-export.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (res.canceled || !res.filePath) return ok({ canceled: true });
      const payloadOut = {
        app: 'Sosis Launcher',
        version: 1,
        exportedAt: new Date().toISOString(),
        games: games.list(),
        sessions: (payload && payload.includeSessions ? games.list().flatMap((g) => games.sessions(g.id)) : [])
      };
      fs.writeFileSync(res.filePath, JSON.stringify(payloadOut, null, 2), 'utf8');
      return ok({ canceled: false, file: res.filePath, games: payloadOut.games.length });
    })
  );
  ipcMain.handle(CH.STORAGE_IMPORT, () =>
    guard(async () => {
      const win = getMain();
      const res = await dialog.showOpenDialog(win, {
        title: 'Import library',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (res.canceled || !res.filePaths.length) return ok({ canceled: true });
      let data;
      try {
        data = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'));
      } catch {
        return fail('invalid-file');
      }
      if (!data || !Array.isArray(data.games)) return fail('invalid-file');
      const existing = new Set(games.list().map((g) => g.exePath));
      let added = 0;
      let skipped = 0;
      for (const g of data.games) {
        if (!g || typeof g.exePath !== 'string') {
          skipped++;
          continue;
        }
        if (existing.has(g.exePath)) {
          skipped++;
          continue;
        }
        try {
          await games.add({ exePath: g.exePath, name: g.name, description: g.description });
          added++;
        } catch {
          skipped++;
        }
      }
      return ok({ canceled: false, added, skipped });
    })
  );

  ipcMain.handle(CH.DOWNLOADS_GET, () =>
    guard(() => ok({ settings: downloads.getSettings(), jobs: downloads.listJobs() }))
  );
  ipcMain.handle(CH.DOWNLOADS_SET, (_e, payload) => guard(() => ok(downloads.setSettings(payload || {}))));
  ipcMain.handle(CH.DOWNLOADS_OPEN_FOLDER, () => guard(() => ok(downloads.openFolder())));

  // ------------------------------------------------------------- dialogs
  ipcMain.handle(CH.DIALOG_CONFIRM, (_e, payload) =>
    guard(async () => {
      const win = getMain();
      const p = payload || {};
      const res = await dialog.showMessageBox(win, {
        type: p.type || 'question',
        title: p.title || 'Sosis Launcher',
        message: p.message || '',
        detail: p.detail || '',
        buttons: [p.confirmLabel || 'Confirm', p.cancelLabel || 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      return ok({ confirmed: res.response === 0 });
    })
  );
  ipcMain.handle(CH.DIALOG_MESSAGE, (_e, payload) =>
    guard(async () => {
      const win = getMain();
      const p = payload || {};
      await dialog.showMessageBox(win, {
        type: p.type || 'info',
        title: p.title || 'Sosis Launcher',
        message: p.message || '',
        detail: p.detail || '',
        buttons: [p.label || 'OK']
      });
      return ok(true);
    })
  );

  ipcMain.handle(CH.SYS_LOGS_OPEN, () =>
    guard(async () => {
      const logs = require('./util/log').dir;
      if (!logs) return fail('no-logs');
      paths.ensure(logs);
      const err = await shell.openPath(logs);
      return err ? fail(err) : ok(logs);
    })
  );
  ipcMain.handle(CH.SYS_RELAUNCH, () =>
    guard(() => {
      app.relaunch();
      app.quit();
      return ok(true);
    })
  );

  // ------------------------------------------------------------- events -> renderer
  games.on('changed', (info) => send(getMain(), CH.EVT_GAMES_CHANGED, info));
  sessions.on('started', (info) => send(getMain(), CH.EVT_SESSION_STARTED, info));
  sessions.on('ended', (info) =>
    send(getMain(), CH.EVT_SESSION_ENDED, {
      gameId: info.gameId,
      seconds: info.seconds,
      startedAt: info.startedAt,
      endedAt: info.endedAt
    })
  );
  sessions.on('launch-error', (info) => send(getMain(), CH.EVT_SESSION_ENDED, { ...info, launchError: true }));
  updates.on('progress', (p) => send(getMain(), CH.EVT_UPDATE_PROGRESS, p));
  updates.on('state', (s) => send(getMain(), CH.EVT_UPDATE_STATE, s));
  downloads.on('changed', (jobs) => send(getMain(), 'sosis:event:downloadsChanged', jobs));
  downloads.on('progress', (p) => send(getMain(), 'sosis:event:downloadsProgress', p));
}

async function await_ai_test(ai) {
  return ai.test();
}

/** React to settings changes that affect the main process. */
function applySideEffects(ctx, section, patch) {
  const { settings, overlay, app: electronApp } = ctx;
  try {
    if (!section || section === 'general') {
      const runAtLogin = settings.get('general', 'runAtLogin');
      electronApp.setLoginItemSettings({ openAtLogin: !!runAtLogin, openAsHidden: false });
    }
    if (!section || section === 'overlay') overlay.applySettings();
  } catch (err) {
    log.warn('settings side-effect failed:', err && err.message);
  }
}

const paths = require('./util/paths');

module.exports = { registerIpc };
