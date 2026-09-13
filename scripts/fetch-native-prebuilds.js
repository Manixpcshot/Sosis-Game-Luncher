#!/usr/bin/env node
'use strict';
/**
 * Cross-build helper (spec §58/§41): fetch the official better-sqlite3
 * prebuilt binary for the Electron ABI we ship with, so a package built on
 * another OS still contains a working SQLite native module.
 *
 * On Windows a normal `npm install && npm run dist` lets electron-builder
 * rebuild/prebuild natively; this script is only needed for cross builds
 * (e.g. CI on Linux) and for local development against Electron.
 *
 *   node scripts/fetch-native-prebuilds.js            # win32-x64 (default)
 *   node scripts/fetch-native-prebuilds.js linux-x64  # extra platform
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const TARGETS = process.argv.slice(2).length ? process.argv.slice(2) : ['win32-x64'];

async function electronAbi() {
  const version = require(path.join(ROOT, 'node_modules', 'electron', 'package.json')).version;
  const res = await fetch('https://releases.electronjs.org/releases.json');
  const list = await res.json();
  const entry = list.find((r) => r.version === version);
  if (!entry || !entry.modules) throw new Error('Could not resolve ABI for electron ' + version);
  return { version, abi: String(entry.modules) };
}

function get(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { 'user-agent': 'sosis-build' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          file.close();
          return get(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          file.close();
          return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
      })
      .on('error', reject);
  });
}

(async () => {
  const sqliteVersion = require(path.join(ROOT, 'node_modules', 'better-sqlite3', 'package.json')).version;
  const { version, abi } = await electronAbi();
  console.log(`electron ${version} -> ABI ${abi}; better-sqlite3 ${sqliteVersion}`);
  for (const target of TARGETS) {
    const [platform, arch] = target.split('-');
    const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${sqliteVersion}/better-sqlite3-v${sqliteVersion}-electron-v${abi}-${platform}-${arch}.tar.gz`;
    const tmp = path.join(ROOT, 'node_modules', '.sosis-prebuild.tar.gz');
    console.log('fetching', url);
    try {
      await get(url, tmp);
    } catch (err) {
      console.warn('⚠ prebuild unavailable for', target, '-', err.message);
      console.warn('  Windows builds will rebuild natively; runtime falls back to JSON storage if missing.');
      continue;
    }
    const destDir = path.join(ROOT, 'node_modules', 'better-sqlite3', 'build', 'Release');
    fs.mkdirSync(destDir, { recursive: true });
    const tmpDir = path.join(ROOT, 'node_modules', '.prebuild-tmp');
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    cp.execSync(`tar -xzf "${tmp}" -C "${tmpDir}"`);
    const candidate = path.join(tmpDir, 'build', 'Release', 'better_sqlite3.node');
    if (!fs.existsSync(candidate)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      throw new Error('prebuild tarball layout unexpected for ' + target);
    }
    fs.copyFileSync(candidate, path.join(destDir, 'better_sqlite3.node'));
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmp, { force: true });
    console.log('✓ installed prebuilt native module for', target, '->', path.join(destDir, 'better_sqlite3.node'));
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
