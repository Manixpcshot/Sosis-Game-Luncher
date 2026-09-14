#!/usr/bin/env node
'use strict';
/**
 * Builds the TINY WEB INSTALLER: dist/SosisLauncherWebSetup.exe (~315 KB).
 *
 * It compiles build/web-setup.nsi with makensis (NSIS 3.x) - works natively
 * on Windows AND Linux/macOS, no Wine required. The produced bootstrapper
 * downloads the app payload (sosis-payload.zip, see installer/build-payload.js)
 * from the Launcher Download Endpoint at install time, verifies its SHA-256
 * with certutil, extracts it with bsdtar (PowerShell fallback), creates
 * shortcuts + uninstaller and can launch the app.
 *
 * Usage:  npm run installer:bootstrap
 * Env:    MAKENSIS=/path/to/makensis  (optional override)
 */
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'build', 'web-setup.nsi');
const OUT = path.join(ROOT, 'dist', 'SosisLauncherWebSetup.exe');

if (!fs.existsSync(SCRIPT)) {
  console.error('build/web-setup.nsi not found.');
  process.exit(1);
}

const candidates = [
  process.env.MAKENSIS,
  'makensis',
  path.join(os.homedir(), '.cache', 'electron-builder', 'nsis', 'nsis-3.0.4.1', 'linux', 'makensis'),
  path.join(os.homedir(), '.cache', 'electron-builder', 'nsis', 'nsis-3.04.1', 'mac', 'makensis'),
  'C:\\Program Files (x86)\\NSIS\\makensis.exe',
  'C:\\Program Files\\NSIS\\makensis.exe',
  '/usr/bin/makensis',
  '/usr/local/bin/makensis'
].filter(Boolean);

let bin = null;
for (const c of candidates) {
  try {
    cp.execFileSync(c, ['-VERSION'], { stdio: 'pipe', env: Object.assign({}, process.env, { _: c }) });
    bin = c;
    break;
  } catch (e) { /* try next */ }
}
if (!bin) {
  console.error('makensis not found. Install NSIS 3.x (https://nsis.sourceforge.io)');
  console.error('or let electron-builder fetch it once (it caches under ~/.cache/electron-builder/nsis).');
  process.exit(1);
}

console.log('makensis:', bin);
console.log('Compiling', path.relative(ROOT, SCRIPT), '...');
// NOTE: this makensis build derives its data dir from the env var '_' (bash sets it
// automatically; when spawned from Node we must pass it explicitly).
cp.execFileSync(bin, ['-NOCONFIG', '-INPUTCHARSET', 'UTF8', SCRIPT], { stdio: 'inherit', env: Object.assign({}, process.env, { _: bin }) });
if (!fs.existsSync(OUT)) {
  console.error('Build reported success but', OUT, 'is missing.');
  process.exit(1);
}
console.log('\nArtifact:', OUT, '(' + fs.statSync(OUT).size + ' bytes)');
console.log('Publish it together with sosis-payload.zip (npm run installer:payload).');
