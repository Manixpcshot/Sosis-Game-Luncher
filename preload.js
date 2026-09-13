'use strict';
/**
 * Sosis Launcher — preload bridge (spec §63).
 *
 * contextIsolation: true, nodeIntegration: false. The renderer receives a
 * small, typed API surface (window.sosis) backed by ipcRenderer.invoke.
 * No Node primitives, no fs, no child_process ever reach the UI.
 */
const { contextBridge, ipcRenderer } = require('electron');
const { CH } = require('./src/shared/channels');

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

/** Subscribe to a main->renderer event; returns an unsubscribe function. */
function on(channel, handler) {
  const wrapped = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const api = {
  meta: {
    boot: () => invoke(CH.APP_BOOT),
    info: () => invoke(CH.APP_META)
  },
  window: {
    minimize: () => invoke(CH.WIN_MINIMIZE),
    toggleMaximize: () => invoke(CH.WIN_MAXIMIZE),
    close: () => invoke(CH.WIN_CLOSE),
    isMaximized: () => invoke(CH.WIN_IS_MAXIMIZED),
    onState: (cb) => on(CH.EVT_WINDOW_STATE, cb)
  },
  shell: {
    openPath: (p) => invoke(CH.SHELL_OPEN_PATH, p),
    showItemInFolder: (p) => invoke(CH.SHELL_SHOW_ITEM, p),
    openExternal: (url) => invoke(CH.SHELL_OPEN_EXTERNAL, url)
  },
  games: {
    list: () => invoke(CH.GAMES_LIST),
    pickExe: () => invoke(CH.GAMES_PICK_EXE),
    add: (payload) => invoke(CH.GAMES_ADD, payload),
    update: (id, patch) => invoke(CH.GAMES_UPDATE, { id, patch }),
    remove: (id) => invoke(CH.GAMES_REMOVE, { id }),
    setFavorite: (id, favorite) => invoke(CH.GAMES_SET_FAVORITE, { id, favorite }),
    locateExe: (id) => invoke(CH.GAMES_LOCATE_EXE, { id }),
    openFolder: (id) => invoke(CH.GAMES_OPEN_FOLDER, { id }),
    pickImage: () => invoke(CH.GAMES_PICK_IMAGE),
    setArt: (payload) => invoke(CH.GAMES_SET_ART, payload),
    searchImages: (payload) => invoke(CH.GAMES_SEARCH_IMAGES, payload),
    launch: (id) => invoke(CH.GAMES_LAUNCH, { id }),
    stopTracking: (id) => invoke(CH.GAMES_STOP_TRACKING, { id }),
    onChanged: (cb) => on(CH.EVT_GAMES_CHANGED, cb)
  },
  sessions: {
    active: () => invoke(CH.SESSIONS_ACTIVE),
    onStarted: (cb) => on(CH.EVT_SESSION_STARTED, cb),
    onEnded: (cb) => on(CH.EVT_SESSION_ENDED, cb)
  },
  settings: {
    get: () => invoke(CH.SETTINGS_GET),
    set: (section, patch) => invoke(CH.SETTINGS_SET, { section, patch }),
    reset: (section) => invoke(CH.SETTINGS_RESET, { section })
  },
  i18n: {
    get: (locale) => invoke(CH.I18N_GET, { locale })
  },
  ai: {
    getSettings: () => invoke(CH.AI_SETTINGS_GET),
    saveSettings: (patch) => invoke(CH.AI_SETTINGS_SAVE, patch),
    test: () => invoke(CH.AI_TEST),
    chat: (requestId, messages) => invoke(CH.AI_CHAT, { requestId, messages }),
    abort: (requestId) => invoke(CH.AI_CHAT_ABORT, { requestId }),
    onChunk: (cb) => on(CH.EVT_AI_CHUNK, cb)
  },
  overlay: {
    get: () => invoke(CH.OVERLAY_GET),
    set: (patch) => invoke(CH.OVERLAY_SET, patch),
    preview: () => invoke(CH.OVERLAY_PREVIEW)
  },
  updates: {
    check: () => invoke(CH.UPDATE_CHECK),
    download: () => invoke(CH.UPDATE_DOWNLOAD),
    install: () => invoke(CH.UPDATE_INSTALL),
    onProgress: (cb) => on(CH.EVT_UPDATE_PROGRESS, cb),
    onState: (cb) => on(CH.EVT_UPDATE_STATE, cb)
  },
  notifications: {
    test: () => invoke(CH.NOTIFY_TEST)
  },
  shortcuts: {
    createForGame: (id, kind) => invoke(CH.SHORTCUT_CREATE_GAME, { id, kind }),
    createForLauncher: (kind) => invoke(CH.SHORTCUT_CREATE_LAUNCHER, { kind })
  },
  storage: {
    info: () => invoke(CH.STORAGE_INFO),
    export: (opts) => invoke(CH.STORAGE_EXPORT, opts),
    import: () => invoke(CH.STORAGE_IMPORT)
  },
  downloads: {
    get: () => invoke(CH.DOWNLOADS_GET),
    set: (patch) => invoke(CH.DOWNLOADS_SET, patch),
    openFolder: () => invoke(CH.DOWNLOADS_OPEN_FOLDER),
    onChanged: (cb) => on('sosis:event:downloadsChanged', cb),
    onProgress: (cb) => on('sosis:event:downloadsProgress', cb)
  },
  dialog: {
    confirm: (opts) => invoke(CH.DIALOG_CONFIRM, opts),
    message: (opts) => invoke(CH.DIALOG_MESSAGE, opts)
  },
  system: {
    openLogs: () => invoke(CH.SYS_LOGS_OPEN),
    relaunch: () => invoke(CH.SYS_RELAUNCH)
  }
};

contextBridge.exposeInMainWorld('sosis', api);
