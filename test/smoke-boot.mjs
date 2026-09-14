/**
 * Smoke test: boots the REAL renderer (src/app.js + all pages) inside jsdom
 * with a stubbed window.sosis bridge and real Settings/Translation payloads.
 * Catches any runtime error that would leave the app stuck on the splash.
 * Run: node test/smoke-boot.mjs   (requires jsdom: npm i --no-save jsdom)
 */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');

// ---- real settings + i18n payloads (same code as main process) ----
const { SettingsManager } = require_(path.join(ROOT, 'src/main/managers/SettingsManager.js'));
const { TranslationManager } = require_(path.join(ROOT, 'src/main/managers/TranslationManager.js'));
const fakeStorage = { backend: { settingGet: () => null, settingSet: () => {}, secretGet: () => null } };
const settings = new SettingsManager(fakeStorage).forRenderer();
const i18n = new TranslationManager({}).get('en');

const payload = {
  meta: { version: '1.2.1', platform: 'win32', arch: 'x64', appName: 'Sosis Launcher', isPackaged: true },
  settings,
  i18n,
  games: [],
  sessions: [],
  storage: { backend: 'json', path: 'C:/fake', sizeBytes: 0 },
  overlay: settings.overlay,
  online: { internet: true, server: true, checkedAt: Date.now() }
};

// ---- jsdom with the REAL index.html ----
const html = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;

for (const k of ['document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'CustomEvent', 'Event', 'MouseEvent', 'KeyboardEvent', 'FileReader', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'DOMParser']) {
  if (window[k] !== undefined) globalThis[k] = window[k];
}
globalThis.window = window;
globalThis.location = window.location;
globalThis.history = window.history;
if (!window.matchMedia) {
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}
globalThis.matchMedia = window.matchMedia;

// ---- stub the preload bridge ----
const off = () => () => {};
const okc = (data) => async () => ({ ok: true, data });
window.sosis = {
  meta: { boot: okc(payload), info: okc(payload.meta) },
  window: { minimize() {}, toggleMaximize() {}, close() {}, isMaximized: okc(false), onState: off },
  shell: { openPath() {}, showItemInFolder() {}, openExternal() {} },
  games: { onChanged: off, onArt: off, list: okc([]), add: okc({}), get: okc(null), update: okc({}), remove: okc(true), pickExe: okc(null), launch: okc(true), createShortcut: okc(true), artCandidates: okc([]), setArt: okc(true), import: okc({}), export: okc('') },
  sessions: { onStarted: off, onEnded: off, active: okc([]) },
  settings: { get: okc(settings), set: okc(settings), reset: okc(settings) },
  ai: { onChunk: off, chat: okc({}), test: okc({ ok: true }), cancel() {} },
  updates: { onProgress: off, onState: off, check: okc({ updateAvailable: false }), download() {}, install() {} },
  downloads: { get: okc({ settings: { effectiveFolder: 'C:/dl', concurrentDownloads: 3, autoUpdate: true }, jobs: [] }), set: okc(settings.downloads), openFolder() {}, onChanged: off, onProgress: off },
  dialog: { confirm: okc(true), message: okc(true) },
  account: { state: okc({ loggedIn: false, user: null, server: 'https://app.sosis-shop.top' }), login: okc({}), register: okc({}), logout: okc({}), uploadAvatar: okc({}), syncNow: okc({}), leaderboard: okc({ users: [] }), popular: okc({ games: [] }), ping: okc({ ok: true, config: {} }) },
  store: { catalog: okc({ ok: true, offline: false, games: [], meta: { loggedIn: false, credit: 0 }, server: 'https://app.sosis-shop.top' }), claim: okc({}), buy: okc({}), payment: okc({}), payments: okc({ payments: [] }), install: okc({}) },
  net: { probe: okc({ internet: true, server: true }), onState: off },
  system: { openLogs() {}, relaunch() {} }
};

// emulate splash-watch.js (classic script the harness does not auto-run)
window.__sosisSplashWatch = { cancel() {}, showError(m) { failures.push(['splash-watch', m]); }, revealButton() {} };

// ---- capture every failure ----
const failures = [];
process.on('unhandledRejection', (e) => failures.push(['unhandledRejection', e && (e.stack || e.message || String(e))]));
window.addEventListener('error', (e) => failures.push(['window.error', (e.error && e.error.stack) || e.message]));
const origError = console.error;
console.error = (...a) => { const m = a.map(String).join(' '); if (m.includes('MODULE_TYPELESS_PACKAGE_JSON') || m.includes('trace-warnings')) return; failures.push(['console.error', m]); };

await import(new URL('../src/app.js', import.meta.url).href);
await new Promise((r) => setTimeout(r, 1200));

const splash = window.document.getElementById('bootSplash');
const view = window.document.getElementById('view');
const sidebar = window.document.getElementById('sidebar');
const splashHidden = splash.classList.contains('hidden');

console.error = origError;
console.log('splash hidden :', splashHidden);
console.log('sidebar items :', sidebar.querySelectorAll('.nav-item').length);
console.log('view children :', view.children.length);
console.log('view html len :', view.innerHTML.length);
if (failures.length) {
  console.log('\nFAILURES (' + failures.length + '):');
  for (const [kind, msg] of failures.slice(0, 6)) console.log('---', kind, '\n', String(msg).slice(0, 1200));
}
// ---- offline entry must never leave a black shell ----
window.__sosisEnterOffline();
await new Promise((r) => setTimeout(r, 80));
if (!splash.classList.contains('hidden')) failures.push(['offline-entry', 'splash not hidden after enterOffline with data']);
if (view.children.length === 0) failures.push(['offline-entry', 'empty view = black screen after enterOffline']);

// ---- visit every page ----
for (const hash of ['#store', '#library', '#favorites', '#leaderboard', '#profile', '#ai', '#downloads', '#settings']) {
  window.location.hash = hash;
  window.dispatchEvent(new window.Event('hashchange'));
  await new Promise((r) => setTimeout(r, 120));
  if (view.children.length === 0) failures.push(['page-empty', hash]);
}
console.log('pages visited : 8');

if (!splashHidden || failures.length || view.children.length === 0) {
  console.log('\nSMOKE FAIL');
  process.exit(1);
}
console.log('\nSMOKE OK — renderer boots, splash hides, library renders');
process.exit(0);
