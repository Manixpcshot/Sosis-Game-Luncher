'use strict';
/** Unit tests for pure logic (no Electron required). */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { nameFromExe } = require('../src/main/managers/GameManager');
const semver = require('../src/main/util/semver');
const { sha256Buffer } = require('../src/main/util/hash');

test('nameFromExe derives friendly names', () => {
  assert.strictEqual(nameFromExe('C:\\Games\\Call of Duty 3\\cod3.exe'), 'Cod3');
  assert.strictEqual(nameFromExe('/x/my_game2-final (1).exe'), 'My Game2 Final');
  assert.strictEqual(nameFromExe('witcher3.exe'), 'Witcher3');
});

test('semver comparison (isNewer(current, latest))', () => {
  assert.strictEqual(semver.isNewer('1.0.0', '1.0.1'), true);
  assert.strictEqual(semver.isNewer('1.1.9', '1.2.0'), true);
  assert.strictEqual(semver.isNewer('1.9.9', '2.0.0'), true);
  assert.strictEqual(semver.isNewer('1.0.0', '1.0.0'), false);
  assert.strictEqual(semver.isNewer('1.1.0', '1.0.5'), false);
});

test('sha256 is stable', () => {
  assert.strictEqual(sha256Buffer(Buffer.from('sosis')), sha256Buffer(Buffer.from('sosis')));
  assert.notStrictEqual(sha256Buffer(Buffer.from('a')), sha256Buffer(Buffer.from('b')));
});

test('session math: total vs current stay separate', () => {
  const totalBefore = 45720; // 12h 42m
  const sessionSeconds = 3738; // 01:02:18
  const totalAfter = totalBefore + sessionSeconds;
  assert.strictEqual(totalAfter, 49458);
  // formatting
  const playTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  const clock = (s) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
  };
  assert.strictEqual(playTime(totalBefore), '12h 42m');
  assert.strictEqual(clock(sessionSeconds), '01:02:18');
});

test('storage JSON backend round-trip (fallback path)', () => {
  const os = require('os');
  const fs = require('fs');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sosis-')), 'db.json');
  // JsonBackend is internal; emulate via StorageManager with forced fallback
  const { StorageManager } = require('../src/main/managers/StorageManager');
  const paths = require('../src/main/util/paths');
  // point paths at the temp dir through the official init entry point
  paths.init({ getPath: () => path.dirname(file) });
  const sm = new StorageManager();
  // force json by breaking sqlite require temporarily
  const Module = require('module');
  const orig = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === 'better-sqlite3') throw new Error('disabled for test');
    return orig.apply(this, arguments);
  };
  try {
    sm.init();
  } finally {
    Module.prototype.require = orig;
  }
  assert.strictEqual(sm.status.backend, 'json');
  sm.backend.gamePut({
    id: 'g1',
    name: 'Test',
    exePath: '/x/test.exe',
    gameFolder: '/x',
    icon: null,
    cover: null,
    banner: null,
    description: '',
    favorite: false,
    totalPlayTime: 0,
    lastPlayed: null,
    launchCount: 0,
    createdAt: 1,
    updatedAt: 1
  });
  const updated = sm.backend.gameGet('g1');
  assert.strictEqual(updated.name, 'Test');
  sm.backend.gamePut({ ...updated, totalPlayTime: 120, launchCount: 1, favorite: true });
  // reload from disk
  const sm2 = new StorageManager();
  Module.prototype.require = function (id) {
    if (id === 'better-sqlite3') throw new Error('disabled for test');
    return orig.apply(this, arguments);
  };
  try {
    sm2.init();
  } finally {
    Module.prototype.require = orig;
  }
  const persisted = sm2.backend.gameGet('g1');
  assert.strictEqual(persisted.totalPlayTime, 120);
  assert.strictEqual(persisted.favorite, true);
  assert.strictEqual(persisted.launchCount, 1);
});
