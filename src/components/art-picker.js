/**
 * Game art picker (spec §19): AI-assistant-driven artwork suggestions.
 * Candidates come from public metadata APIs or user-pasted URLs; NOTHING is
 * downloaded until the user explicitly picks one image for cover or banner.
 */
import { h, icon, clear } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';

const PROVIDERS = [
  { id: 'steam', key: 'art.providerSteam' },
  { id: 'itunes', key: 'art.providerItunes' },
  { id: 'rawg', key: 'art.providerRawg' },
  { id: 'custom', key: 'art.providerCustom' }
];

export function openArtPicker(game, onDone) {
  const grid = h('div', { class: 'image-grid' });
  const status = h('div', { class: 'muted small' });
  const providerSelect = h(
    'select',
    { class: 'select' },
    PROVIDERS.map((p) => h('option', { value: p.id, 'data-i18n': p.key }))
  );
  const customInput = h('textarea', {
    class: 'text-input hidden',
    rows: 3,
    placeholder: t('art.customHint')
  });
  customInput.setAttribute('data-i18n-placeholder', 'art.customHint');
  providerSelect.addEventListener('change', () => {
    customInput.classList.toggle('hidden', providerSelect.value !== 'custom');
  });

  const searchBtn = h('button', { class: 'btn btn-primary btn-sm', onclick: () => runSearch() }, [
    icon('search', 14),
    h('span', { 'data-i18n': 'art.search' })
  ]);

  const localBtn = h('button', { class: 'btn btn-sm', onclick: () => localFlow('cover') }, [
    icon('folder', 14),
    h('span', { 'data-i18n': 'art.fromFile' })
  ]);

  async function localFlow(kind) {
    const res = await window.sosis.games.pickImage();
    if (res.ok && !res.data.canceled) {
      const set = await window.sosis.games.setArt({ id: game.id, kind, source: 'path', value: res.data.path });
      if (set.ok) {
        toast.success(t('art.applied'));
        onDone && onDone();
      } else toast.error(set.error);
    }
  }

  async function apply(kind, source, value) {
    status.textContent = t('art.downloading');
    const set = await window.sosis.games.setArt({ id: game.id, kind, source, value });
    if (set.ok) {
      toast.success(t('art.applied'));
      onDone && onDone();
      closeModal();
    } else {
      toast.error(t('art.applyFailed', { error: set.error || '' }));
      status.textContent = t('art.applyFailed', { error: set.error || '' });
    }
  }

  async function runSearch() {
    clear(grid);
    status.textContent = t('art.searching');
    searchBtn.setAttribute('disabled', 'disabled');
    const customUrls = customInput.value
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await window.sosis.games.searchImages({
      name: game.name,
      provider: providerSelect.value,
      customUrls
    });
    searchBtn.removeAttribute('disabled');
    if (!res.ok) {
      status.textContent = t('art.searchFailed', { error: res.error || '' });
      return;
    }
    const results = (res.data && res.data.results) || [];
    if (!results.length) {
      status.textContent = t('art.noResults');
      return;
    }
    status.textContent = t('art.resultsHint');
    for (const item of results) grid.appendChild(tile(item));
  }

  function tile(item) {
    const img = h('img', { src: item.url, alt: item.label || '', loading: 'lazy' });
    const el = h('div', { class: 'image-tile', title: item.label || item.url }, [
      img,
      h('div', { class: 'tile-src', text: item.source }),
      h('div', { class: 'tile-actions' }, [
        h(
          'button',
          {
            class: 'btn btn-sm',
            onclick: (e) => {
              e.stopPropagation();
              apply('cover', 'url', item.url);
            }
          },
          h('span', { 'data-i18n': 'art.setCover' })
        ),
        h(
          'button',
          {
            class: 'btn btn-sm',
            onclick: (e) => {
              e.stopPropagation();
              apply('banner', 'url', item.url);
            }
          },
          h('span', { 'data-i18n': 'art.setBanner' })
        )
      ])
    ]);
    img.addEventListener('error', () => el.classList.add('broken'));
    return el;
  }

  const closeModal = openModal({
    title: t('art.title', { name: game.name }),
    sub: t('art.subtitle'),
    wide: true,
    body: h('div', { class: 'col' }, [
      h('div', { class: 'row' }, [providerSelect, searchBtn, h('div', { class: 'grow' }), localBtn]),
      customInput,
      status,
      grid,
      h('p', { class: 'muted small', 'data-i18n': 'art.copyrightNote' }),
      h('div', { class: 'row' }, [
        h('button', { class: 'btn btn-sm btn-ghost', onclick: () => apply('cover', 'clear', null) }, [
          h('span', { text: t('art.clearCover') })
        ])
      ])
    ]),
    actions: [{ label: t('common.close'), kind: 'btn-ghost', onClick: () => {} }]
  });
}
