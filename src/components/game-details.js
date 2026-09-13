/**
 * Game Details view (spec §8): banner, icon, name, description, stats,
 * paths and every management action.
 */
import { h, icon } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { playTime, clock, relativeDay, artUrl } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { confirmDialog, openModal } from '../lib/modal.js';
import { sessionFor, state } from '../lib/store.js';
import { openArtPicker } from './art-picker.js';

export function renderGameDetails(game, root, { onBack, onRefresh }) {
  const session = sessionFor(game.id);
  const bannerUrl = artUrl(game.banner) || artUrl(game.cover);
  const iconUrl = artUrl(game.icon);

  const playBtn = h(
    'button',
    {
      class: 'btn btn-primary',
      onclick: () => launch(game),
      disabled: !!session
    },
    [icon('play', 15), h('span', { text: session ? t('library.running') + ' ' + clock(session.elapsedSeconds) : t('library.play') })]
  );
  if (session) {
    const label = playBtn.querySelector('span');
    const timer = setInterval(() => {
      const s = sessionFor(game.id);
      if (!s) {
        clearInterval(timer);
        return;
      }
      label.textContent = t('library.running') + ' ' + clock((Date.now() - s.startedAt) / 1000);
    }, 1000);
  }

  const hero = h('div', { class: 'details-hero' }, [
    bannerUrl ? h('img', { class: 'banner', src: bannerUrl, alt: '', onerror: (e) => e.target.remove() }) : null,
    h('div', { class: 'hero-scrim' }),
    h('div', { class: 'hero-content' }, [
      iconUrl ? h('img', { class: 'hero-icon', src: iconUrl, alt: '' }) : h('div', { class: 'hero-icon' }, [icon('gamepad', 34)]),
      h('div', { class: 'hero-title grow' }, [
        h('h2', { text: game.name }),
        h('div', { class: 'hero-sub' }, [
          h('span', { text: relativeDay(game.lastPlayed, t) }),
          ' · ',
          h('span', { text: playTime(game.totalPlayTime) })
        ])
      ]),
      h('div', { class: 'row' }, [
        h(
          'button',
          {
            class: 'icon-btn',
            onclick: async () => {
              const next = !game.favorite;
              const res = await window.sosis.games.setFavorite(game.id, next);
              if (res.ok) {
                toast.success(next ? t('library.favorited') : t('library.unfavorited'));
                onRefresh();
              }
            },
            'data-i18n-title': game.favorite ? 'library.unfavorite' : 'library.favorite'
          },
          [icon('star', 16)]
        ),
        playBtn
      ])
    ])
  ]);

  const stats = h('div', { class: 'stat-cards' }, [
    statCard(playTime(game.totalPlayTime), 'details.totalPlayTime'),
    statCard(session ? clock(session.elapsedSeconds) : '—', 'details.currentSession'),
    statCard(String(game.launchCount || 0), 'details.launchCount')
  ]);

  const infoPanel = h('div', { class: 'panel' }, [
    h('h3', { 'data-i18n': 'details.information' }),
    h('div', { class: 'info-list' }, [
      infoRow('details.lastPlayed', relativeDay(game.lastPlayed, t)),
      infoRow('details.addedOn', new Date(game.createdAt).toLocaleDateString()),
      infoRow('details.exePath', game.exePath, true),
      infoRow('details.gameFolder', game.gameFolder, true)
    ]),
    h('div', { class: 'action-row' }, [
      h('button', { class: 'btn btn-sm', onclick: () => window.sosis.games.openFolder(game.id) }, [
        icon('folder', 14),
        h('span', { 'data-i18n': 'details.openFolder' })
      ]),
      h('button', { class: 'btn btn-sm', onclick: () => locateExe(game, onRefresh) }, [
        icon('crosshair', 14),
        h('span', { 'data-i18n': 'details.locateExe' })
      ]),
      h('button', { class: 'btn btn-sm', onclick: () => openArtPicker(game, onRefresh) }, [
        icon('image', 14),
        h('span', { 'data-i18n': 'details.findArt' })
      ])
    ])
  ]);

  const managePanel = h('div', { class: 'panel' }, [
    h('h3', { 'data-i18n': 'details.manage' }),
    h('div', { class: 'col' }, [
      h('button', { class: 'btn', onclick: () => editGame(game, onRefresh) }, [
        icon('edit', 15),
        h('span', { 'data-i18n': 'details.editGame' })
      ]),
      h('button', { class: 'btn', onclick: () => createShortcut(game) }, [
        icon('shortcut', 15),
        h('span', { 'data-i18n': 'details.createShortcut' })
      ]),
      h('button', { class: 'btn btn-danger', onclick: () => removeGame(game, onBack) }, [
        icon('trash', 15),
        h('span', { 'data-i18n': 'details.removeGame' })
      ])
    ]),
    h('p', { class: 'muted small mt', 'data-i18n': 'details.removeNote' })
  ]);

  const descPanel = h('div', { class: 'panel' }, [
    h('h3', { 'data-i18n': 'details.description' }),
    game.description
      ? h('p', { class: 'muted', style: { lineHeight: '1.7', margin: '0' }, text: game.description })
      : h('p', { class: 'muted small', style: { margin: '0' }, 'data-i18n': 'details.noDescription' })
  ]);

  root.appendChild(
    h('div', { class: 'page-enter' }, [
      h('div', { class: 'page-header' }, [
        h('button', { class: 'btn btn-ghost btn-sm', onclick: onBack }, [
          icon(document.documentElement.dir === 'rtl' ? 'chevronRight' : 'chevronLeft', 14),
          h('span', { 'data-i18n': 'details.back' })
        ])
      ]),
      hero,
      stats,
      h('div', { class: 'details-grid' }, [h('div', { class: 'col' }, [descPanel]), h('div', { class: 'col' }, [infoPanel, managePanel])])
    ])
  );

  async function launch(g) {
    const res = await window.sosis.games.launch(g.id);
    if (res.ok) {
      toast.success(t('library.launched', { name: g.name }));
      onRefresh();
    } else if (res.code === 'EXE_NOT_FOUND') {
      toast.error(t('errors.exeMissing'));
      const fix = await confirmDialog({
        message: t('errors.exeMissing'),
        detail: g.exePath,
        confirmLabel: t('details.locateExe'),
        cancelLabel: t('common.cancel')
      });
      if (fix) locateExe(g, onRefresh);
    } else if (res.code === 'ALREADY_RUNNING') {
      toast.info(t('library.alreadyRunning'));
    } else {
      toast.error(t('errors.launchFailed', { error: res.error || '' }));
    }
  }
}

function statCard(num, labelKey) {
  return h('div', { class: 'stat-card' }, [h('div', { class: 'num', text: num }), h('div', { class: 'lbl', 'data-i18n': labelKey })]);
}

function infoRow(key, value, mono = false) {
  return h('div', { class: 'info-row' }, [
    h('span', { class: 'k', 'data-i18n': key }),
    h('span', { class: 'v' + (mono ? ' path-chip' : ''), text: value || '—', title: value || '' })
  ]);
}

async function locateExe(game, onRefresh) {
  const res = await window.sosis.games.locateExe(game.id);
  if (res.ok && !res.data.canceled) {
    toast.success(t('details.exeUpdated'));
    onRefresh();
  }
}

function editGame(game, onRefresh) {
  const nameInput = h('input', { class: 'text-input', value: game.name });
  const descInput = h('textarea', { class: 'text-input', rows: 4 }, game.description || '');
  openModal({
    title: t('details.editGame'),
    sub: game.exePath,
    body: h('div', { class: 'col' }, [
      h('label', { class: 'small muted', 'data-i18n': 'details.gameName' }),
      nameInput,
      h('label', { class: 'small muted', 'data-i18n': 'details.description' }),
      descInput
    ]),
    actions: [
      { label: t('common.cancel'), kind: 'btn-ghost', onClick: () => {} },
      {
        label: t('common.save'),
        kind: 'btn-primary',
        onClick: async () => {
          const res = await window.sosis.games.update(game.id, {
            name: nameInput.value.trim() || game.name,
            description: descInput.value
          });
          if (res.ok) {
            toast.success(t('common.saved'));
            onRefresh();
          } else toast.error(res.error);
        }
      }
    ]
  });
}

async function createShortcut(game) {
  const res = await window.sosis.shortcuts.createForGame(game.id, 'both');
  if (res.ok && res.data.ok) toast.success(t('details.shortcutCreated'));
  else if (res.ok && res.data.error === 'unsupported-platform') toast.info(t('details.shortcutUnsupported'));
  else toast.error(t('details.shortcutFailed'));
}

async function removeGame(game, onBack) {
  if (state.settings && state.settings.library.confirmBeforeRemove) {
    const confirmed = await confirmDialog({
      message: t('details.removeConfirm', { name: game.name }),
      detail: t('details.removeConfirmDetail'),
      confirmLabel: t('details.removeGame'),
      cancelLabel: t('common.cancel'),
      type: 'warning'
    });
    if (!confirmed) return;
  }
  const res = await window.sosis.games.remove(game.id);
  if (res.ok) {
    toast.success(t('details.removed'));
    onBack();
  } else toast.error(res.error);
}
