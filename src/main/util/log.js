'use strict';
/** Tiny structured logger writing to console + a rotating log file in userData. */
const fs = require('fs');
const path = require('path');

let logDir = null;
let logFile = null;
let stream = null;
const MAX_BYTES = 1024 * 1024; // 1 MB per log file, rotate once

function init(dir) {
  try {
    logDir = path.join(dir, 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    logFile = path.join(logDir, 'sosis-launcher.log');
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_BYTES) {
      fs.renameSync(logFile, logFile + '.1');
    }
    stream = fs.createWriteStream(logFile, { flags: 'a' });
  } catch {
    stream = null;
  }
}

function stamp() {
  return new Date().toISOString();
}

function write(level, tag, args) {
  const line = `[${stamp()}] [${level}] [${tag}] ${args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.stack || a.message;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ')}`;
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](line);
  if (stream) stream.write(line + '\n');
}

function makeLogger(tag) {
  return {
    info: (...a) => write('info', tag, a),
    warn: (...a) => write('warn', tag, a),
    error: (...a) => write('error', tag, a)
  };
}

module.exports = {
  init,
  makeLogger,
  get dir() {
    return logDir;
  },
  get file() {
    return logFile;
  }
};
