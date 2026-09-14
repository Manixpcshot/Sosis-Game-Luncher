#!/usr/bin/env node
'use strict';
/**
 * Builds the compressed app payload consumed by the tiny web installer
 * (build/web-setup.nsi -> dist/SosisLauncherWebSetup.exe):
 *
 *   dist/win-unpacked  ->  dist/sosis-payload.zip + dist/sosis-payload.sha256
 *
 * Then stages every host-side artifact into installer/payload/ so the folder
 * can be uploaded as-is into the host `datasetup/` directory (cPanel File
 * Manager, or Admin panel -> Files tab):
 *   sosis-payload.zip, sosis-payload.sha256, SosisLauncherWebSetup.exe,
 *   SosisLauncherSetup.exe, index.json (= dist/datasetup-manifest.json)
 *
 * Pure Node (no external tools): minimal ZIP writer with deflate + CRC-32.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'dist', 'win-unpacked');
const OUT_ZIP = path.join(ROOT, 'dist', 'sosis-payload.zip');
const OUT_SHA = path.join(ROOT, 'dist', 'sosis-payload.sha256');
const STAGE = path.join(__dirname, 'payload');

if (!fs.existsSync(SRC)) {
  console.error('dist/win-unpacked not found - build the app first (npm run dist or electron-builder --win dir).');
  process.exit(1);
}

// ------------------------------------------------------------- zip writer
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosDateTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff
  };
}
function walk(dir, base, out) {
  out = out || [];
  const names = fs.readdirSync(dir).sort();
  for (const name of names) {
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (fs.statSync(full).isDirectory()) walk(full, rel, out);
    else out.push({ full, rel });
  }
  return out;
}

const entries = walk(SRC, '');
const chunks = [];
const central = [];
let offset = 0;
let done = 0;
for (const entry of entries) {
  const data = fs.readFileSync(entry.full);
  const crc = crc32(data);
  const comp = zlib.deflateRawSync(data, { level: 6 });
  const useComp = comp.length < data.length;
  const body = useComp ? comp : data;
  const method = useComp ? 8 : 0;
  const dt = dosDateTime(fs.statSync(entry.full).mtime);
  const nameBuf = Buffer.from(entry.rel, 'utf8');

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(0x0800, 6); // UTF-8 filename
  lh.writeUInt16LE(method, 8);
  lh.writeUInt16LE(dt.time, 10);
  lh.writeUInt16LE(dt.date, 12);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(body.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(nameBuf.length, 26);
  chunks.push(lh, nameBuf, body);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0x0800, 8);
  cd.writeUInt16LE(method, 10);
  cd.writeUInt16LE(dt.time, 12);
  cd.writeUInt16LE(dt.date, 14);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(body.length, 20);
  cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(nameBuf.length, 28);
  cd.writeUInt32LE(offset, 42);
  central.push(cd, nameBuf);

  offset += lh.length + nameBuf.length + body.length;
  done++;
  if (done % 20 === 0) process.stdout.write('.');
}
const centralBuf = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(entries.length, 8);
eocd.writeUInt16LE(entries.length, 10);
eocd.writeUInt32LE(centralBuf.length, 12);
eocd.writeUInt32LE(offset, 16);
fs.writeFileSync(OUT_ZIP, Buffer.concat(chunks.concat([centralBuf, eocd])));

const sha = crypto.createHash('sha256').update(fs.readFileSync(OUT_ZIP)).digest('hex');
fs.writeFileSync(OUT_SHA, sha + '  sosis-payload.zip\n');
console.log('\nsosis-payload.zip:', fs.statSync(OUT_ZIP).size, 'bytes (' + entries.length + ' files), sha256', sha);

// ------------------------------------------------------------- staging
fs.mkdirSync(STAGE, { recursive: true });
const stage = [
  [OUT_ZIP, 'sosis-payload.zip'],
  [OUT_SHA, 'sosis-payload.sha256'],
  [path.join(ROOT, 'dist', 'SosisLauncherWebSetup.exe'), 'SosisLauncherWebSetup.exe'],
  [path.join(ROOT, 'dist', 'SosisLauncherSetup.exe'), 'SosisLauncherSetup.exe'],
  [path.join(ROOT, 'dist', 'datasetup-manifest.json'), 'index.json']
];
for (const pair of stage) {
  if (fs.existsSync(pair[0])) {
    fs.copyFileSync(pair[0], path.join(STAGE, pair[1]));
    console.log('  staged', pair[1]);
  } else {
    console.log('  missing (skipped):', pair[0]);
  }
}
console.log('\nUpload the contents of installer/payload/ into the host `datasetup/` folder');
console.log('(Admin panel -> Files tab, or cPanel File Manager). The web installer then');
console.log('downloads  https://app.sosis-shop.top/datasetup/sosis-payload.zip  at install time.');
