'use strict';
/**
 * TranslationManager — central i18n (spec §22).
 * Loads locales/fa.json + locales/en.json once at boot and serves them to the
 * renderer over IPC. No user-visible string is hard-coded in components.
 */
const fs = require('fs');
const path = require('path');
const { makeLogger } = require('../util/log');

const log = makeLogger('i18n');

const SUPPORTED = ['en', 'fa'];
const RTL = new Set(['fa']);

class TranslationManager {
  constructor(app) {
    this.bundles = {};
    const dir = path.join(__dirname, '..', '..', '..', 'locales');
    for (const locale of SUPPORTED) {
      try {
        const file = path.join(dir, locale + '.json');
        this.bundles[locale] = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (err) {
        log.error('Failed to load locale', locale, err);
        this.bundles[locale] = {};
      }
    }
    // In packaged builds the locales sit next to the app files; asar is transparent to fs.
    if (!Object.keys(this.bundles.en).length) {
      const alt = path.join(app.getAppPath(), 'locales');
      for (const locale of SUPPORTED) {
        try {
          this.bundles[locale] = JSON.parse(fs.readFileSync(path.join(alt, locale + '.json'), 'utf8'));
        } catch {}
      }
    }
  }

  get(locale) {
    const loc = SUPPORTED.includes(locale) ? locale : 'en';
    return {
      locale: loc,
      direction: RTL.has(loc) ? 'rtl' : 'ltr',
      messages: this.bundles[loc] || {},
      fallback: this.bundles.en || {},
      available: SUPPORTED.map((code) => ({ code, name: this.bundles[code] ? this.bundles[code].languageName : code }))
    };
  }

  isRTL(locale) {
    return RTL.has(locale);
  }
}

module.exports = { TranslationManager, SUPPORTED };
