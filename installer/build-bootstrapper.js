#!/usr/bin/env node
'use strict';
/**
 * Builds the WEB installer artifact: installer/bootstrapper/dist/SosisLauncherSetup.exe
 * (spec §46-52). On Windows run:  npm run installer:bootstrap
 */
const cp = require('child_process');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, 'bootstrapper');
if (!fs.existsSync(path.join(dir, 'node_modules'))) {
  console.log('Installing bootstrapper dependencies…');
  cp.execSync('npm install --no-audit --no-fund', { cwd: dir, stdio: 'inherit' });
}
console.log('Building web bootstrapper (SosisLauncherSetup.exe)…');
cp.execSync('npx electron-builder --win --x64', { cwd: dir, stdio: 'inherit' });
console.log('\nArtifact: installer/bootstrapper/dist/SosisLauncherSetup.exe');
console.log('Publish it together with dist/datasetup-manifest.json (see installer/README.md).');
