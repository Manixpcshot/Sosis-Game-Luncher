/**
 * MAIN-PROCESS BOOT TEST (runtime).
 * Stubs the `electron` module, loads the REAL main.js, lets app.whenReady()
 * build every manager + register IPC, then INVOKES the APP_BOOT handler and
 * asserts it returns ok:true with a sane payload.
 *
 * This is the layer that catches bugs static checks cannot see — e.g. a
 * wrong relative require() inside a lazily-called IPC handler
 * ("Cannot find module '../net'" shipped once because of exactly that).
 *
 * Run: node test/main-boot.mjs
 */
import Module from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sosis-mainboot-'));

// ---------------------------------------------------------- permissive stub
function permissive(name) {
  const fn = function () { return permissive(name + '()'); };
  return new Proxy(fn, {
    get(t, prop) {
      if (prop === 'then') return undefined;           // not a thenable
      if (prop === Symbol.toPrimitive) return () => name;
      if (prop === 'isEmpty') return () => true;
      if (!(prop in t)) t[prop] = permissive(name + '.' + String(prop));
      return t[prop];
    },
    apply() { return permissive(name + '()'); },
    construct() { return permissive('new ' + name); }
  });
}

const handlers = new Map();
const userData = path.join(TMP, 'userData');
fs.mkdirSync(userData, { recursive: true });

const appStub = {
  on() {}, once() {}, removeListener() {}, off() {},
  whenReady: () => Promise.resolve(),
  getVersion: () => '1.3.0-test',
  getName: () => 'Sosis Launcher',
  setName() {}, setPath() {},
  getPath: (n) => (n === 'userData' ? userData : path.join(TMP, n || 'x')),
  getAppPath: () => ROOT,
  isPackaged: false,
  setLoginItemSettings() {},
  disableHardwareAcceleration() {},
  enableSandbox() {},
  requestSingleInstanceLock: () => true,
  quit() {}, exit() {}, relaunch() {},
  setAppUserModelId() {},
  commandLine: { appendSwitch() {} }
};

const electronStub = {
  app: appStub,
  ipcMain: {
    handle: (ch, fn) => handlers.set(ch, fn),
    on() {}, once() {}, removeHandler() {}, handleOnce() {}
  },
  ipcRenderer: permissive('ipcRenderer'),
  BrowserWindow: class {
    constructor() { this.webContents = { send() {}, on() {}, once() {}, off() {}, openDevTools() {}, getURL: () => 'sosis://app/', setWindowOpenHandler() {}, setUserAgent() {}, getOSProcessId: () => 1, executeJavaScript: () => Promise.resolve(), session: { webRequest: { onHeadersReceived() {} } }, getWebRTCIPHandlingPolicy: () => 'default' }; }
    on() {} once() {} off() {} removeListener() {}
    loadURL() { return Promise.resolve(); }
    loadFile() { return Promise.resolve(); }
    show() {} hide() {} close() {} destroy() {} focus() {} minimize() {} maximize() {} unmaximize() {}
    isMaximized() { return false; } isDestroyed() { return false; } isVisible() { return true; }
    setMinimumSize() {} setSize() {} getSize() { return [1200, 800]; }
    setAlwaysOnTop() {} setFullScreen() {} setMenuBarVisibility() {}
    static getAllWindows() { return []; }
  },
  Tray: class { setToolTip() {} setContextMenu() {} on() {} destroy() {} setImage() {} },
  Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {}, getApplicationMenu: () => null },
  MenuItem: class {},
  nativeImage: { createFromPath: () => ({ isEmpty: () => true, resize: () => ({ isEmpty: () => true }), toDataURL: () => '' }), createEmpty: () => ({ isEmpty: () => true }) },
  nativeTheme: { shouldUseDarkColors: true, on() {} },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 }, scaleFactor: 1 }), getAllDisplays: () => [] },
  shell: { openPath: () => Promise.resolve(''), openExternal: () => Promise.resolve(), showItemInFolder() {}, beep() {} },
  dialog: { showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }), showMessageBox: () => Promise.resolve({ response: 0 }), showErrorBox() {} },
  Notification: class { show() {} on() {} static isSupported() { return false; } },
  protocol: { registerSchemesAsPrivileged() {}, registerBufferProtocol() {}, registerFileProtocol() {}, registerStringProtocol() {}, handle() {}, unhandle() {}, isProtocolHandled: () => false },
  session: { defaultSession: { protocol: { registerBufferProtocol() {}, registerStringProtocol() {} }, webRequest: { onHeadersReceived() {} }, clearCache: (cb) => cb && cb() }, fromPartition: () => ({ protocol: { registerBufferProtocol() {} } }) },
  safeStorage: { isEncryptionAvailable: () => false, encryptString: (s) => Buffer.from(s), decryptString: (b) => b.toString() },
  net: { request: () => ({ on() {}, end() {}, abort() {} }), fetch: () => Promise.reject(new Error('offline-test')) },
  globalShortcut: { register() {}, unregisterAll() {} },
  powerMonitor: { on() {} },
  clipboard: { writeText() {} },
  crashReporter: { start() {} }
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return electronStub;
  return origLoad.call(this, request, parent, isMain);
};

// ---------------------------------------------------------- boot the main process
require_(path.join(ROOT, 'main.js'));
await new Promise((r) => setTimeout(r, 400));   // let whenReady() chain finish

const { CH } = require_(path.join(ROOT, 'src/shared/channels.js'));
const failures = [];
if (!handlers.has(CH.APP_BOOT)) failures.push('APP_BOOT handler was never registered');

if (handlers.has(CH.APP_BOOT)) {
  const res = await handlers.get(CH.APP_BOOT)({ sender: {} });
  if (!res || res.ok !== true) failures.push('APP_BOOT returned not-ok: ' + JSON.stringify(res && res.error));
  else {
    const d = res.data;
    for (const key of ['meta', 'settings', 'i18n', 'games', 'sessions', 'storage', 'online']) {
      if (!(key in d)) failures.push('APP_BOOT payload missing key: ' + key);
    }
    if (!d.i18n || !d.i18n.messages) failures.push('i18n bundle missing messages');
    console.log('APP_BOOT ok — version', d.meta.version, '| games', d.games.length, '| locale', d.i18n.locale, '| online', JSON.stringify(d.online));
  }
}

// a couple of extra handlers that must also answer
for (const ch of [CH.GAMES_LIST, CH.SETTINGS_GET]) {
  if (handlers.has(ch)) {
    const r2 = await handlers.get(ch)({ sender: {} });
    if (!r2 || r2.ok !== true) failures.push(ch + ' returned not-ok');
  }
}
console.log('ipc handlers registered:', handlers.size);

Module._load = origLoad;
fs.rmSync(TMP, { recursive: true, force: true });

if (failures.length) {
  console.error('MAIN-BOOT FAIL:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('MAIN-BOOT OK — main process boots and answers APP_BOOT');
process.exit(0);
