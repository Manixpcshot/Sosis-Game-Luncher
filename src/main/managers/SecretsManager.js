'use strict';
/**
 * SecretsManager — encrypted at-rest storage for sensitive values (spec §16).
 *
 * Primary: Electron `safeStorage` (DPAPI on Windows). The ciphertext is stored
 * in the SQLite/JSON secrets table; plaintext never touches disk or the
 * renderer.
 *
 * Fallback (non-Windows dev machines without a keyring): AES-256-GCM with a
 * randomly generated master key kept in a 0600 file inside userData. This is
 * documented in the README as a dev-only fallback; on Windows safeStorage is
 * always available.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { makeLogger } = require('../util/log');
const paths = require('../util/paths');

const log = makeLogger('secrets');

class SecretsManager {
  constructor(storage, electronSafeStorage) {
    this.storage = storage;
    this.safe = electronSafeStorage || null;
    this.method = 'none';
    this._init();
  }

  _init() {
    try {
      if (this.safe && this.safe.isEncryptionAvailable && this.safe.isEncryptionAvailable()) {
        this.method = 'safeStorage';
        return;
      }
    } catch (err) {
      log.warn('safeStorage probe failed:', err);
    }
    // Fallback: local master key file.
    try {
      this.masterKeyPath = path.join(paths.userData, 'master.key');
      if (!fs.existsSync(this.masterKeyPath)) {
        const key = crypto.randomBytes(32);
        fs.writeFileSync(this.masterKeyPath, key.toString('hex'), { mode: 0o600 });
      }
      this.masterKey = Buffer.from(fs.readFileSync(this.masterKeyPath, 'utf8').trim(), 'hex');
      this.method = 'aes-256-gcm';
    } catch (err) {
      log.error('Secret fallback unavailable:', err);
      this.method = 'none';
    }
  }

  _encrypt(plaintext) {
    if (this.method === 'safeStorage') {
      return 'ss:' + this.safe.encryptString(plaintext).toString('base64');
    }
    if (this.method === 'aes-256-gcm') {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
      const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return 'aes:' + JSON.stringify({
        iv: iv.toString('base64'),
        t: cipher.getAuthTag().toString('base64'),
        d: enc.toString('base64')
      });
    }
    throw new Error('No encryption method available');
  }

  _decrypt(payload) {
    if (!payload) return null;
    try {
      if (payload.startsWith('ss:')) {
        if (this.method !== 'safeStorage') return null;
        return this.safe.decryptString(Buffer.from(payload.slice(3), 'base64'));
      }
      if (payload.startsWith('aes:')) {
        const o = JSON.parse(payload.slice(4));
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, Buffer.from(o.iv, 'base64'));
        decipher.setAuthTag(Buffer.from(o.t, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(o.d, 'base64')), decipher.final()]).toString('utf8');
      }
      return null;
    } catch (err) {
      log.warn('Decrypt failed for a stored secret:', err && err.message);
      return null;
    }
  }

  set(key, plaintext) {
    if (plaintext === null || plaintext === undefined || plaintext === '') {
      this.storage.backend.secretSet(key, null);
      return { ok: true, removed: true };
    }
    try {
      this.storage.backend.secretSet(key, this._encrypt(plaintext));
      return { ok: true, method: this.method };
    } catch (err) {
      log.error('Secret store failed:', err);
      return { ok: false, error: err.message };
    }
  }

  get(key) {
    return this._decrypt(this.storage.backend.secretGet(key));
  }

  has(key) {
    return !!this.storage.backend.secretGet(key);
  }

  describe() {
    return { method: this.method };
  }
}

module.exports = { SecretsManager };
