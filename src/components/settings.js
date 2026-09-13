/**
 * Full Settings center (spec §20): General, Appearance, Language, Library,
 * AI Assistant, Downloads, Notifications, Storage, Overlay, Advanced, About.
 */
import { h, icon, clear } from '../lib/dom.js';
import { t, currentLocale } from '../lib/i18n.js';
import { state, setState } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { confirmDialog } from '../lib/modal.js';
import { settingRow, toggle, persist, applyAppearance, selectInput } from './settings-controls.js';
import { overlaySettingsPanel } from './overlay-settings.js';
import { SORT_OPTIONS } from './search.js';

const TABS = [
  { id: 'general', key: 'settings.general', icon: 'settings' },
  { id: 'appearance', key: 'settings.appearance', icon: 'palette' },
  { id: 'language', key: 'settings.language', icon: 'globe' },
  { id: 'library', key: 'settings.library', icon: 'library' },
  { id: 'ai', key: 'settings.ai', icon: 'ai' },
  { id: 'downloads', key: 'settings.downloads', icon: 'downloads' },
  { id: 'notifications', key: 'settings.notifications', icon: 'bell' },
  { id: 'storage', key: 'settings.storage', icon: 'database' },
  { id: 'overlay', key: 'settings.overlay', icon: 'layers' },
  { id: 'advanced', key: 'settings.advanced', icon: 'shield' },
  { id: 'about', key: 'settings.about', icon: 'info2' }
];

let activeTab = 'general';

export function settingsPage(root) {
  const tabsEl = h('div', { class: 'settings-tabs', role: 'tablist' });
  const contentEl = h('div', { class: 'panel', style: { padding: '22px' } });

  function renderTabs() {
    clear(tabsEl);
    for (const tab of TABS) {
      tabsEl.appendChild(
        h(
          'button',
          {
            class: 'settings-tab' + (activeTab === tab.id ? ' active' : ''),
            role: 'tab',
            'aria-selected': String(activeTab === tab.id),
            onclick: () => {
              activeTab = tab.id;
              renderTabs();
              renderContent();
            }
          },
          [icon(tab.icon, 16), h('span', { 'data-i18n': tab.key })]
        )
      );
    }
  }

  function renderContent() {
    clear(contentEl);
    const builder = PANELS[activeTab] || PANELS.general;
    contentEl.appendChild(builder());
  }

  root.appendChild(h('div', { class: 'page-enter settings-layout' }, [tabsEl, contentEl]));
  renderTabs();
  renderContent();
}

/* ------------------------------------------------------------------ panels */

const PANELS = {
  general() {
    const g = state.settings.general;
    return h('div', { class: 'col' }, [
      group('settings.general', [
        settingRow('general.runAtLogin', 'general.runAtLoginDesc', toggle(g.runAtLogin, (v) => persist('general', { runAtLogin: v }))),
        settingRow('general.closeToTray', 'general.closeToTrayDesc', toggle(g.closeToTray, (v) => persist('general', { closeToTray: v }))),
        settingRow('general.startMinimized', 'general.startMinimizedDesc', toggle(g.startMinimized, (v) => persist('general', { startMinimized: v }))),
        settingRow('general.checkUpdates', 'general.checkUpdatesDesc', toggle(g.checkUpdatesOnStart, (v) => persist('general', { checkUpdatesOnStart: v })))
      ])
    ]);
  },

  appearance() {
    const a = state.settings.appearance;
    const accents = ['cyan', 'violet', 'magenta', 'green', 'amber', 'blue'];
    const colors = { cyan: '#22d3ee', violet: '#a78bfa', magenta: '#f472b6', green: '#34d399', amber: '#fbbf24', blue: '#60a5fa' };
    const scaleValue = h('b', { text: a.uiScale + '%' });
    return h('div', { class: 'col' }, [
      group('settings.appearance', [
        settingRow(
          'appearance.theme',
          'appearance.themeDesc',
          selectInput(
            [
              { id: 'dark', key: 'appearance.dark' },
              { id: 'light', key: 'appearance.light' }
            ],
            a.theme,
            (v) => persist('appearance', { theme: v })
          )
        ),
        settingRow(
          'appearance.accent',
          'appearance.accentDesc',
          h(
            'div',
            { class: 'accent-swatches' },
            accents.map((name) =>
              h('button', {
                class: 'swatch' + (a.accent === name ? ' active' : ''),
                style: { background: colors[name] },
                title: name,
                'aria-label': name,
                onclick: () => persist('appearance', { accent: name })
              })
            )
          )
        ),
        settingRow(
          'appearance.uiScale',
          'appearance.uiScaleDesc',
          h('div', { class: 'row' }, [
            h('input', {
              type: 'range',
              class: 'range',
              min: '80',
              max: '130',
              step: '5',
              value: String(a.uiScale),
              oninput: (e) => (scaleValue.textContent = e.target.value + '%'),
              onchange: (e) => persist('appearance', { uiScale: Number(e.target.value) })
            }),
            scaleValue
          ])
        ),
        settingRow('appearance.reduceMotion', 'appearance.reduceMotionDesc', toggle(a.reduceMotion, (v) => persist('appearance', { reduceMotion: v }))),
        settingRow('appearance.backgroundGlow', 'appearance.backgroundGlowDesc', toggle(a.backgroundGlow, (v) => persist('appearance', { backgroundGlow: v })))
      ])
    ]);
  },

  language() {
    const lang = state.settings.language.locale;
    return h('div', { class: 'col' }, [
      group('settings.language', [
        settingRow(
          'language.choose',
          'language.chooseDesc',
          selectInput(
            [
              { id: 'en', key: 'language.english' },
              { id: 'fa', key: 'language.persian' }
            ],
            lang,
            async (v) => {
              const next = await persist('language', { locale: v }, { silent: true });
              if (next) {
                const bundle = await window.sosis.i18n.get(v);
                if (bundle.ok) {
                  const { loadBundle } = await import('../lib/i18n.js');
                  loadBundle(bundle.data);
                  toast.success(t('language.changed'));
                  // full re-render so every static label refreshes
                  window.dispatchEvent(new CustomEvent('sosis:rerender'));
                }
              }
            }
          )
        ),
        h('p', { class: 'muted small', 'data-i18n': 'language.rtlNote' })
      ])
    ]);
  },

  library() {
    const lib = state.settings.library;
    return h('div', { class: 'col' }, [
      group('settings.library', [
        settingRow(
          'library.defaultSort',
          'library.defaultSortDesc',
          selectInput(SORT_OPTIONS.map((o) => ({ id: o.id, key: o.key })), lib.defaultSort, (v) => persist('library', { defaultSort: v }))
        ),
        settingRow(
          'library.defaultView',
          'library.defaultViewDesc',
          selectInput(
            [
              { id: 'grid', key: 'library.gridView' },
              { id: 'list', key: 'library.listView' }
            ],
            lib.defaultView,
            (v) => persist('library', { defaultView: v })
          )
        ),
        settingRow('library.confirmRemove', 'library.confirmRemoveDesc', toggle(lib.confirmBeforeRemove, (v) => persist('library', { confirmBeforeRemove: v }))),
        settingRow(
          'library.trackMode',
          'library.trackModeDesc',
          selectInput(
            [
              { id: 'smart', key: 'library.trackSmart' },
              { id: 'basic', key: 'library.trackBasic' }
            ],
            lib.trackMode,
            (v) => persist('library', { trackMode: v })
          )
        )
      ]),
      h('div', { class: 'row' }, [
        h('button', { class: 'btn btn-sm', onclick: () => exportLibrary() }, [icon('downloads', 14), h('span', { 'data-i18n': 'storage.export' })]),
        h('button', { class: 'btn btn-sm', onclick: () => importLibrary() }, [icon('plus', 14), h('span', { 'data-i18n': 'storage.import' })])
      ])
    ]);
  },

  ai() {
    return aiSettingsPanel();
  },

  downloads() {
    const d = state.settings.downloads;
    const concValue = h('b', { text: String(d.concurrentDownloads) });
    return h('div', { class: 'col' }, [
      group('settings.downloads', [
        settingRow(
          'downloads.folder',
          'downloads.folderDesc',
          h('div', { class: 'row' }, [
            h('span', { class: 'path-chip', text: d.effectiveFolder || '…' }),
            h('button', { class: 'btn btn-sm', onclick: async () => {
                const res = await window.sosis.downloads.openFolder();
                if (res.ok) refreshDownloadsPanel();
              } }, [icon('folder', 14), h('span', { 'data-i18n': 'downloads.openFolder' })])
          ])
        ),
        settingRow(
          'downloads.concurrent',
          'downloads.concurrentDesc',
          h('div', { class: 'row' }, [
            h('input', {
              type: 'range', class: 'range', min: '1', max: '8', step: '1', value: String(d.concurrentDownloads),
              oninput: (e) => (concValue.textContent = e.target.value),
              onchange: (e) => persist('downloads', { concurrentDownloads: Number(e.target.value) })
            }),
            concValue
          ])
        ),
        settingRow('downloads.autoUpdate', 'downloads.autoUpdateDesc', toggle(d.autoUpdate, (v) => persist('downloads', { autoUpdate: v })))
      ]),
      h('p', { class: 'muted small', 'data-i18n': 'downloads.futureNote' })
    ]);
  },

  notifications() {
    const n = state.settings.notifications;
    return h('div', { class: 'col' }, [
      group('settings.notifications', [
        settingRow('notifications.enable', 'notifications.enableDesc', toggle(n.enabled, (v) => persist('notifications', { enabled: v }))),
        settingRow('notifications.gameStarted', 'notifications.gameStartedDesc', toggle(n.gameStarted, (v) => persist('notifications', { gameStarted: v }))),
        settingRow('notifications.sessionEnd', 'notifications.sessionEndDesc', toggle(n.sessionFinished, (v) => persist('notifications', { sessionFinished: v }))),
        settingRow('notifications.updates', 'notifications.updatesDesc', toggle(n.updatesAvailable, (v) => persist('notifications', { updatesAvailable: v }))),
        h('button', { class: 'btn btn-sm', onclick: async () => {
            const res = await window.sosis.notifications.test();
            if (res.ok && res.data.ok) toast.success(t('notifications.testSent'));
            else toast.info(t('notifications.unsupported'));
          } }, [icon('bell', 14), h('span', { 'data-i18n': 'notifications.test' })])
      ])
    ]);
  },

  storage() {
    const info = state.storage;
    return h('div', { class: 'col' }, [
      group('settings.storage', [
        h('div', { class: 'info-list' }, [
          h('div', { class: 'info-row' }, [h('span', { class: 'k', 'data-i18n': 'storage.backend' }), h('span', { class: 'v', text: info ? info.backend : '—')]),
          h('div', { class: 'info-row' }, [h('span', { class: 'k', 'data-i18n': 'storage.location' }), h('span', { class: 'v path-chip', text: info ? info.path : '—')]),
          h('div', { class: 'info-row' }, [h('span', { class: 'k', 'data-i18n': 'storage.gamesStored' }), h('span', { class: 'v', text: info ? String(info.games) : '—')]),
          h('div', { class: 'info-row' }, [h('span', { class: 'k', 'data-i18n': 'storage.secretsMethod' }), h('span', { class: 'v', text: state.meta && state.meta.secretsMethod ? state.meta.secretsMethod : '—')])
        ]),
        info && info.recovered ? h('p', { class: 'small', style: { color: 'var(--warn)' }, 'data-i18n': 'storage.recoveredNote' }) : null,
        h('div', { class: 'row mt' }, [
          h('button', { class: 'btn btn-sm', onclick: () => exportLibrary() }, [icon('downloads', 14), h('span', { 'data-i18n': 'storage.export' })]),
          h('button', { class: 'btn btn-sm', onclick: () => importLibrary() }, [icon('plus', 14), h('span', { 'data-i18n': 'storage.import' })])
        ])
      ])
    ]);
  },

  overlay() {
    return overlaySettingsPanel();
  },

  advanced() {
    const adv = state.settings.advanced;
    return h('div', { class: 'col' }, [
      group('settings.advanced', [
        settingRow('advanced.hwAccel', 'advanced.hwAccelDesc', toggle(state.settings.general.hardwareAcceleration, async (v) => {
          await persist('general', { hardwareAcceleration: v });
          toast.info(t('advanced.relaunchHint'));
        })),
        settingRow('advanced.devTools', 'advanced.devToolsDesc', toggle(adv.devTools, (v) => persist('advanced', { devTools: v }))),
        h('div', { class: 'row' }, [
          h('button', { class: 'btn btn-sm', onclick: () => window.sosis.system.openLogs() }, [icon('folder', 14), h('span', { 'data-i18n': 'advanced.openLogs' })]),
          h('button', { class: 'btn btn-sm', onclick: () => window.sosis.system.relaunch() }, [icon('refresh', 14), h('span', { 'data-i18n': 'advanced.relaunch' })]),
          h('button', { class: 'btn btn-sm btn-danger', onclick: async () => {
              const ok = await confirmDialog({
                message: t('advanced.resetConfirm'),
                detail: t('advanced.resetConfirmDetail'),
                confirmLabel: t('advanced.reset'),
                cancelLabel: t('common.cancel'),
                type: 'warning'
              });
              if (!ok) return;
              const res = await window.sosis.settings.reset();
              if (res.ok) {
                setState({ settings: res.data });
                applyAppearance(res.data);
                toast.success(t('advanced.resetDone'));
                window.dispatchEvent(new CustomEvent('sosis:rerender'));
              }
            } }, [icon('warn', 14), h('span', { 'data-i18n': 'advanced.reset' })])
        ])
      ]),
      h('p', { class: 'muted small', 'data-i18n': 'advanced.safetyNote' })
    ]);
  },

  about() {
    const meta = state.meta || {};
    return h('div', { class: 'col' }, [
      group('settings.about', [
        h('div', { class: 'row', style: { gap: '16px' } }, [
          h('img', { src: 'sosis://app/assets/icons/icon-64.png', style: { width: '56px', height: '56px', borderRadius: '14px' }, alt: '' }),
          h('div', { class: 'col', style: { gap: '2px' } }, [
            h('div', { style: { fontWeight: '800', fontSize: '16px' }, text: 'Sosis Launcher' }),
            h('div', { class: 'muted small', text: 'v' + meta.version + ' · ' + meta.platform + '/' + meta.arch })
          ])
        ]),
        h('p', { class: 'muted small', 'data-i18n': 'about.blurb' }),
        h('div', { class: 'row' }, [
          h('button', { class: 'btn btn-sm', onclick: () => checkUpdates(true) }, [icon('refresh', 14), h('span', { 'data-i18n': 'about.checkUpdates' })]),
          h('button', { class: 'btn btn-sm', onclick: () => window.sosis.shell.openExternal('https://sosis-shop.top') }, [icon('globe', 14), h('span', { 'data-i18n': 'about.website' })])
        ]),
        h('div', { id: 'aboutUpdateStatus', class: 'muted small' })
      ])
    ]);
  }
};

function group(titleKey, children) {
  return h('div', { class: 'setting-group' }, [h('h4', { 'data-i18n': titleKey }), ...children]);
}

async function exportLibrary() {
  const res = await window.sosis.storage.export({ includeSessions: false });
  if (res.ok && !res.data.canceled) toast.success(t('storage.exported', { count: res.data.games }));
}

async function importLibrary() {
  const res = await window.sosis.storage.import();
  if (res.ok && !res.data.canceled) {
    toast.success(t('storage.imported', { added: res.data.added, skipped: res.data.skipped }));
    const games = await window.sosis.games.list();
    if (games.ok) setState({ games: games.data });
  } else if (res.ok === false) toast.error(res.error);
}

function refreshDownloadsPanel() {
  window.dispatchEvent(new CustomEvent('sosis:rerender'));
}

export async function checkUpdates(verbose) {
  const statusEl = document.getElementById('aboutUpdateStatus');
  if (statusEl) statusEl.textContent = t('updates.checking');
  const res = await window.sosis.updates.check();
  if (!res.ok) {
    if (statusEl) statusEl.textContent = t('updates.checkFailed', { error: res.error });
    if (verbose) toast.error(t('updates.checkFailed', { error: res.error }));
    return;
  }
  const d = res.data;
  if (!d.updateAvailable) {
    if (statusEl) statusEl.textContent = t('updates.upToDate', { version: d.current });
    if (verbose) toast.success(t('updates.upToDate', { version: d.current }));
    return;
  }
  if (statusEl) statusEl.textContent = t('updates.available', { version: d.info.latest });
  if (verbose) toast.info(t('updates.available', { version: d.info.latest }));
}

/* ------------------------------------------------------- AI settings panel */

function aiSettingsPanel() {
  const ai = state.settings.ai;
  const resultBox = h('div', { id: 'aiTestResult' });
  const keyInput = h('input', {
    class: 'text-input mono',
    type: 'password',
    placeholder: ai.hasKey ? t('ai.keyStored') : t('ai.keyPlaceholder'),
    autocomplete: 'off'
  });
  const baseUrlInput = h('input', { class: 'text-input mono', value: ai.baseUrl || '' });
  const modelInput = h('input', { class: 'text-input mono', value: ai.model || '' });

  const saveBtn = h('button', {
    class: 'btn btn-primary btn-sm',
    onclick: async () => {
      const patch = {
        baseUrl: baseUrlInput.value.trim(),
        model: modelInput.value.trim()
      };
      if (keyInput.value.trim()) patch.apiKey = keyInput.value.trim();
      const res = await window.sosis.ai.saveSettings(patch);
      if (res.ok) {
        const settings = await window.sosis.settings.get();
        if (settings.ok) setState({ settings: settings.data });
        keyInput.value = '';
        keyInput.placeholder = res.data.hasKey ? t('ai.keyStored') : t('ai.keyPlaceholder');
        toast.success(t('common.saved'));
      } else toast.error(res.error);
    }
  }, [h('span', { 'data-i18n': 'common.save' })]);

  const testBtn = h('button', {
    class: 'btn btn-sm',
    onclick: async () => {
      clear(resultBox);
      testBtn.setAttribute('disabled', 'disabled');
      testBtn.appendChild(h('span', { class: 'spinner' }));
      const res = await window.sosis.ai.test();
      testBtn.removeAttribute('disabled');
      const spinner = testBtn.querySelector('.spinner');
      if (spinner) spinner.remove();
      if (res.ok && res.data.ok) {
        resultBox.appendChild(h('div', { class: 'test-result ok' }, [icon('check', 15), h('span', { text: t('ai.testSuccess') + (res.data.model ? ' · ' + res.data.model : '') })]));
      } else {
        const detail = res.ok ? res.data : res;
        const msgKey = detail.message || 'ai.errors.unknown';
        const msg = t(msgKey) + (detail.detail ? ' — ' + detail.detail : '');
        resultBox.appendChild(h('div', { class: 'test-result err' }, [icon('x', 15), h('span', { text: t('ai.testFailed') + ': ' + msg })]));
      }
    }
  }, [icon('link', 14), h('span', { 'data-i18n': 'ai.testConnection' })]);

  return h('div', { class: 'col' }, [
    group('settings.ai', [
      settingRow('ai.provider', 'ai.providerDesc', h('span', { class: 'path-chip', text: 'OpenAI Compatible' })),
      settingRow('ai.baseUrl', 'ai.baseUrlDesc', baseUrlInput),
      settingRow('ai.model', 'ai.modelDesc', modelInput),
      settingRow('ai.apiKey', 'ai.apiKeyDesc', h('div', { class: 'row', style: { width: '260px' } }, [keyInput])),
      settingRow('ai.includeLibrary', 'ai.includeLibraryDesc', toggle(ai.includeLibraryContext, (v) => window.sosis.ai.saveSettings({ includeLibraryContext: v }))),
      h('div', { class: 'row' }, [testBtn, saveBtn]),
      resultBox,
      h('p', { class: 'muted small', 'data-i18n': 'ai.securityNote' })
    ])
  ]);
}
