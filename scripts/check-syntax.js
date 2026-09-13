#!/usr/bin/env node
'use strict';
/**
 * Static validation (spec §68): syntax-check every JS file, validate locale
 * JSON and verify en/fa key parity + that every t('key') used in the renderer
 * exists in both locales.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', 'dist', 'release', '.git', 'out', 'build']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) out.push(full);
  }
  return out;
}

let failures = 0;

// 1) syntax
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  const res = cp.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (res.status !== 0) {
    failures++;
    console.error('SYNTAX FAIL', rel);
    console.error(res.stderr);
  }
}
console.log('syntax: checked', walk(ROOT).length, 'files,', failures, 'failures');

// 2) locales
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'en.json'), 'utf8'));
const fa = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'fa.json'), 'utf8'));
const enKeys = Object.keys(en).sort();
const faKeys = Object.keys(fa).sort();
const missingFa = enKeys.filter((k) => !(k in fa));
const missingEn = faKeys.filter((k) => !(k in en));
if (missingFa.length || missingEn.length) {
  failures++;
  console.error('LOCALE PARITY FAIL');
  if (missingFa.length) console.error(' missing in fa.json:', missingFa.join(', '));
  if (missingEn.length) console.error(' missing in en.json:', missingEn.join(', '));
} else {
  console.log('locales: en/fa parity OK (' + enKeys.length + ' keys)');
}

// 3) every t('...') / data-i18n="..." in src + overlay exists in locales
const used = new Set();
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.html')) {
      const src = fs.readFileSync(full, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1]);
      for (const m of src.matchAll(/data-i18n(?:-title|-placeholder)?="([^"]+)"/g)) used.add(m[1]);
      for (const m of src.matchAll(/'data-i18n(?:-title|-placeholder)?':\s*'([^']+)'/g)) used.add(m[1]);
    }
  }
}
scan(path.join(ROOT, 'src'));
scan(path.join(ROOT, 'overlay'));
const unknown = [...used].filter((k) => !(k in en) && !k.includes('{'));
if (unknown.length) {
  failures++;
  console.error('UNKNOWN I18N KEYS:', unknown.join(', '));
} else {
  console.log('i18n usage: all', used.size, 'referenced keys exist');
}

if (failures) {
  console.error('VALIDATION FAILED');
  process.exit(1);
}
console.log('VALIDATION OK');
