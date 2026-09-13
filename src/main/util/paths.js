'use strict';
/** Central path helpers. All persistent data lives under Electron userData. */
const path = require('path');

let userData = null;

function init(app) {
  userData = app.getPath('userData');
  return userData;
}

function ensure(dir) {
  const fs = require('fs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = {
  init,
  ensure,
  get userData() {
    return userData;
  },
  get dbDir() {
    return ensure(path.join(userData, 'database'));
  },
  get dbFile() {
    return path.join(this.dbDir, 'sosis-launcher.db');
  },
  get jsonFallbackFile() {
    return path.join(this.dbDir, 'sosis-launcher.json');
  },
  get artDir() {
    return ensure(path.join(userData, 'art'));
  },
  get iconDir() {
    return ensure(path.join(userData, 'art', 'icons'));
  },
  get coverDir() {
    return ensure(path.join(userData, 'art', 'covers'));
  },
  get secretsFile() {
    return path.join(userData, 'secrets.bin');
  },
  get downloadsDir() {
    return ensure(path.join(userData, 'downloads'));
  },
  get updatesDir() {
    return ensure(path.join(userData, 'updates'));
  }
};
