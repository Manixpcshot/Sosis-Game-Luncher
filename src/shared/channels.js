/**
 * Sosis Launcher — IPC channel contract.
 * Single source of truth shared by preload.js (renderer bridge) and
 * src/main/ipc.js (main-process handlers). Keeping the list here prevents
 * channel-name drift between processes.
 *
 * This module must stay dependency-free (plain CommonJS) so both the
 * sandboxed preload and the main process can require it.
 */
'use strict';

const CH = {
  // App / window chrome
  APP_BOOT: 'sosis:app:boot',
  APP_META: 'sosis:app:meta',
  WIN_MINIMIZE: 'sosis:window:minimize',
  WIN_MAXIMIZE: 'sosis:window:maximize',
  WIN_CLOSE: 'sosis:window:close',
  WIN_IS_MAXIMIZED: 'sosis:window:isMaximized',
  EVT_WINDOW_STATE: 'sosis:event:windowState',

  // Shell helpers
  SHELL_OPEN_PATH: 'sosis:shell:openPath',
  SHELL_SHOW_ITEM: 'sosis:shell:showItemInFolder',
  SHELL_OPEN_EXTERNAL: 'sosis:shell:openExternal',

  // Games / library
  GAMES_LIST: 'sosis:games:list',
  GAMES_ADD: 'sosis:games:add',
  GAMES_UPDATE: 'sosis:games:update',
  GAMES_REMOVE: 'sosis:games:remove',
  GAMES_SET_FAVORITE: 'sosis:games:setFavorite',
  GAMES_LOCATE_EXE: 'sosis:games:locateExe',
  GAMES_OPEN_FOLDER: 'sosis:games:openFolder',
  GAMES_PICK_EXE: 'sosis:games:pickExe',
  GAMES_PICK_IMAGE: 'sosis:games:pickImage',
  GAMES_SET_ART: 'sosis:games:setArt',
  GAMES_SEARCH_IMAGES: 'sosis:games:searchImages',
  GAMES_LAUNCH: 'sosis:games:launch',
  GAMES_STOP_TRACKING: 'sosis:games:stopTracking',
  EVT_GAMES_CHANGED: 'sosis:event:gamesChanged',

  // Sessions / play time
  SESSIONS_ACTIVE: 'sosis:sessions:active',
  EVT_SESSION_STARTED: 'sosis:event:sessionStarted',
  EVT_SESSION_ENDED: 'sosis:event:sessionEnded',

  // Settings
  SETTINGS_GET: 'sosis:settings:get',
  SETTINGS_SET: 'sosis:settings:set',
  SETTINGS_RESET: 'sosis:settings:reset',

  // Translations
  I18N_GET: 'sosis:i18n:get',

  // AI assistant
  AI_SETTINGS_GET: 'sosis:ai:settingsGet',
  AI_SETTINGS_SAVE: 'sosis:ai:settingsSave',
  AI_TEST: 'sosis:ai:test',
  AI_CHAT: 'sosis:ai:chat',
  AI_CHAT_ABORT: 'sosis:ai:chatAbort',
  EVT_AI_CHUNK: 'sosis:event:aiChunk',

  // Overlay
  OVERLAY_GET: 'sosis:overlay:get',
  OVERLAY_SET: 'sosis:overlay:set',
  OVERLAY_PREVIEW: 'sosis:overlay:preview',
  OVERLAY_STATE: 'sosis:overlay:state', // main -> overlay window
  OVERLAY_READY: 'sosis:overlay:ready', // overlay -> main

  // Updates
  UPDATE_CHECK: 'sosis:update:check',
  UPDATE_DOWNLOAD: 'sosis:update:download',
  UPDATE_INSTALL: 'sosis:update:install',
  EVT_UPDATE_PROGRESS: 'sosis:event:updateProgress',
  EVT_UPDATE_STATE: 'sosis:event:updateState',

  // Notifications
  NOTIFY_TEST: 'sosis:notify:test',

  // Shortcuts
  SHORTCUT_CREATE_GAME: 'sosis:shortcut:createGame',
  SHORTCUT_CREATE_LAUNCHER: 'sosis:shortcut:createLauncher',

  // Storage / import-export
  STORAGE_INFO: 'sosis:storage:info',
  STORAGE_EXPORT: 'sosis:storage:export',
  STORAGE_IMPORT: 'sosis:storage:import',

  // Downloads
  DOWNLOADS_GET: 'sosis:downloads:get',
  DOWNLOADS_SET: 'sosis:downloads:set',
  DOWNLOADS_OPEN_FOLDER: 'sosis:downloads:openFolder',

  // Dialogs
  DIALOG_CONFIRM: 'sosis:dialog:confirm',
  DIALOG_MESSAGE: 'sosis:dialog:message',

  // System / diagnostics
  SYS_LOGS_OPEN: 'sosis:sys:openLogs',
  SYS_RELAUNCH: 'sosis:sys:relaunch'
};

module.exports = { CH };
