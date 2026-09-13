'use strict';
/**
 * SettingsManager — typed defaults + persistence on top of StorageManager.
 * All user preferences live here; the renderer only ever sees sanitized values
 * (secrets such as the AI API key are masked before leaving the main process).
 */

const DEFAULTS = {
  general: {
    runAtLogin: false,
    closeToTray: true,
    startMinimized: false,
    hardwareAcceleration: true,
    checkUpdatesOnStart: true,
    updateChannel: 'stable' // stable | beta
  },
  appearance: {
    theme: 'dark', // dark | light
    accent: 'cyan', // cyan | violet | magenta | green | amber | blue | custom
    customAccent: '#22d3ee',
    uiScale: 100, // 80..130 (%)
    reduceMotion: false,
    backgroundGlow: true,
    density: 'comfortable' // comfortable | compact
  },
  language: {
    locale: 'en' // en | fa
  },
  library: {
    defaultSort: 'recentlyPlayed', // nameAsc|nameDesc|recentlyPlayed|mostPlayed|recentlyAdded|playTime
    defaultView: 'grid', // grid | list
    confirmBeforeRemove: true,
    trackMode: 'smart', // smart (process tree polling on Windows) | basic (child exit only)
    pollIntervalMs: 5000
  },
  ai: {
    provider: 'openai-compatible', // openai-compatible
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    hasKey: false, // informational only; the key itself never lives here
    includeLibraryContext: true,
    temperature: 0.7,
    systemPrompt: ''
  },
  downloads: {
    folder: '', // empty = userData/downloads
    concurrentDownloads: 3,
    autoUpdate: false
  },
  notifications: {
    enabled: true,
    gameStarted: true,
    sessionFinished: true,
    updatesAvailable: true
  },
  overlay: {
    enabled: true,
    position: 'top-right', // top-left|top-right|bottom-left|bottom-right
    opacity: 80, // 20..100
    scale: 'medium', // small|medium|large
    showFps: true,
    margin: 24
  },
  advanced: {
    devTools: false,
    smartTracking: true,
    logLevel: 'info'
  }
};

const SECTION_KEYS = Object.keys(DEFAULTS);

class SettingsManager {
  constructor(storage) {
    this.storage = storage;
    this.cache = this._load();
  }

  _load() {
    const out = {};
    for (const section of SECTION_KEYS) {
      const stored = this.storage.backend.settingGet('section:' + section, null);
      out[section] = Object.assign({}, DEFAULTS[section], stored && typeof stored === 'object' ? stored : {});
    }
    return out;
  }

  get(section, key) {
    if (key === undefined) return this.cache[section];
    return this.cache[section] ? this.cache[section][key] : undefined;
  }

  all() {
    return JSON.parse(JSON.stringify(this.cache));
  }

  /** Sanitized snapshot for the renderer: AI key replaced by a mask. */
  forRenderer() {
    const copy = this.all();
    if (copy.ai) {
      delete copy.ai.apiKey;
      copy.ai.hasKey = !!this.storage.backend.secretGet('ai.apiKey');
    }
    return copy;
  }

  set(section, patch) {
    if (!DEFAULTS[section]) throw new Error('Unknown settings section: ' + section);
    const current = this.cache[section] || {};
    const next = Object.assign({}, current, patch || {});
    // Clamp / coerce a few values defensively (spec §43).
    if (section === 'appearance') {
      next.uiScale = Math.max(80, Math.min(130, Number(next.uiScale) || 100));
    }
    if (section === 'overlay') {
      next.opacity = Math.max(10, Math.min(100, Number(next.opacity) || 80));
      next.margin = Math.max(0, Math.min(120, Number(next.margin) || 24));
    }
    this.cache[section] = next;
    this.storage.backend.settingSet('section:' + section, next);
    return this.forRenderer();
  }

  reset(section) {
    if (section) {
      this.cache[section] = JSON.parse(JSON.stringify(DEFAULTS[section] || {}));
      this.storage.backend.settingSet('section:' + section, this.cache[section]);
    } else {
      this.cache = JSON.parse(JSON.stringify(DEFAULTS));
      for (const s of SECTION_KEYS) this.storage.backend.settingSet('section:' + s, this.cache[s]);
    }
    return this.forRenderer();
  }
}

module.exports = { SettingsManager, DEFAULTS };
