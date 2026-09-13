'use strict';
/** Tiny JSON database with atomic writes (server/data/db.json). */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'db.json');

const DEFAULTS = {
  users: [],
  tokens: {},
  games: {},
  sessions: [],
  site: {
    downloadEnabled: true,
    latestVersion: '1.1.0',
    notes: '',
    installerFile: 'SosisLauncherSetup.exe'
  },
  admin: null // {salt, passHash} created on first run
};

let db = null;

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'downloads'), { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'avatars'), { recursive: true });
  if (fs.existsSync(FILE)) {
    try {
      db = Object.assign({}, DEFAULTS, JSON.parse(fs.readFileSync(FILE, 'utf8')));
      db.site = Object.assign({}, DEFAULTS.site, db.site || {});
      return db;
    } catch (err) {
      const backup = FILE + '.corrupt-' + Date.now();
      fs.renameSync(FILE, backup);
      console.error('[db] corrupted db backed up to', backup);
    }
  }
  db = JSON.parse(JSON.stringify(DEFAULTS));
  save();
  return db;
}

let saveTimer = null;
function save() {
  // debounced atomic write
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, FILE);
  }, 120);
}

function get() {
  if (!db) load();
  return db;
}

module.exports = { get, save, load, DATA_DIR, DOWNLOADS_DIR: () => path.join(DATA_DIR, 'downloads'), AVATARS_DIR: () => path.join(DATA_DIR, 'avatars') };
