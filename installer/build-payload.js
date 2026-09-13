#!/usr/bin/env node
'use strict';
/**
 * Prepares the payload for the Launcher Download Endpoint (spec §46):
 * copies the offline installer + datasetup manifest into installer/payload/
 * so it can be uploaded to https://sosis-shop.top/app/datasetup as-is.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(__dirname, 'payload');

const setup = path.join(DIST, 'SosisLauncherSetup.exe');
const manifest = path.join(DIST, 'datasetup-manifest.json');
if (!fs.existsSync(setup) || !fs.existsSync(manifest)) {
  console.error('Run `npm run dist` first (it also generates the manifests).');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(setup, path.join(OUT, 'SosisLauncherSetup.exe'));
fs.copyFileSync(manifest, path.join(OUT, 'index.json'));
console.log('Payload ready in installer/payload/:');
for (const f of fs.readdirSync(OUT)) console.log('  -', f);
console.log('\nUpload the folder contents so that:');
console.log('  GET https://sosis-shop.top/app/datasetup            -> index.json');
console.log('  GET https://sosis-shop.top/app/datasetup/SosisLauncherSetup.exe -> installer');
