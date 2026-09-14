#!/usr/bin/env node
'use strict';
/**
 * Generates the update / installer manifests to publish on the server:
 *   dist/latest.json          -> update manifest  (spec §45)
 *   dist/datasetup-manifest.json -> web-installer payload manifest (spec §46-50)
 *
 * Server contract (see installer/README.md):
 *   GET https://sosis-shop.top/app/latest.json
 *   GET https://sosis-shop.top/app/datasetup            (payload manifest)
 *   GET https://sosis-shop.top/app/datasetup/<file>     (payload files)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const BASE_URL = process.env.DOWNLOAD_BASE_URL || 'https://app.sosis-shop.top/datasetup';
const UPDATE_BASE = process.env.SOSIS_UPDATE_URL || 'https://app.sosis-shop.top';

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run `npm run dist` first.');
  process.exit(1);
}

const websetup = path.join(DIST, 'SosisLauncherWebSetup.exe');
const setup = path.join(DIST, 'SosisLauncherSetup.exe');
if (!fs.existsSync(websetup) && !fs.existsSync(setup)) {
  console.error('dist/SosisLauncherWebSetup.exe not found — run `npm run installer:bootstrap` first.');
  process.exit(1);
}
/* Distribution model: the published installer is the TINY web setup; the big
   offline setup is only a local-build fallback and is never published. */
const primary = fs.existsSync(websetup) ? websetup : setup;
const primaryName = path.basename(primary);
const hash = sha256(primary);
const size = fs.statSync(primary).size;

const optional = (file) => {
  const p = path.join(DIST, file);
  if (!fs.existsSync(p)) return null;
  return { url: null, sha256: sha256(p), size: fs.statSync(p).size, path: p };
};
const payload = optional('sosis-payload.zip');
const portable = optional(`SosisLauncher-${pkg.version}-win64-portable.zip`);

const latest = {
  app: 'Sosis Launcher',
  channel: 'stable',
  version: pkg.version,
  download: `${BASE_URL}/${primaryName}`,
  sha256: hash,
  size,
  releasedAt: new Date().toISOString(),
  notes: `Sosis Launcher ${pkg.version}`
};
if (payload) latest.payload = { url: `${BASE_URL}/sosis-payload.zip`, sha256: payload.sha256, size: payload.size };
if (portable) latest.portable = { url: `${UPDATE_BASE}/releases/download/v${pkg.version}/SosisLauncher-${pkg.version}-win64-portable.zip`, sha256: portable.sha256, size: portable.size };
fs.writeFileSync(path.join(DIST, 'latest.json'), JSON.stringify(latest, null, 2));

const datasetup = {
  name: 'Sosis Launcher',
  version: pkg.version,
  baseUrl: BASE_URL,
  files: [
    {
      name: primaryName,
      url: `${BASE_URL}/${primaryName}`,
      sha256: hash,
      size,
      kind: primaryName === 'SosisLauncherWebSetup.exe' ? 'web-installer' : 'installer',
      run: { silent: primaryName === 'SosisLauncherWebSetup.exe' ? ['/S', '/UPDATE=1'] : ['/S'], after: 'launch' }
    }
  ]
};
if (payload) datasetup.files.push({ name: 'sosis-payload.zip', url: `${BASE_URL}/sosis-payload.zip`, sha256: payload.sha256, size: payload.size, kind: 'payload' });
fs.writeFileSync(path.join(DIST, 'datasetup-manifest.json'), JSON.stringify(datasetup, null, 2));

console.log('manifests written:');
console.log('  dist/latest.json            (version', pkg.version + ', sha256', hash.slice(0, 12) + '…)');
console.log('  dist/datasetup-manifest.json');
console.log('Upload both + SosisLauncherWebSetup.exe + sosis-payload.zip to the server endpoints.');
