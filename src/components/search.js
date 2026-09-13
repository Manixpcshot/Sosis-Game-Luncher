/** Search + sort + view toolbar (spec §13, §14). Instant, no reloads. */
import { h, icon } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { state, setState } from '../lib/store.js';

export const SORT_OPTIONS = [
  { id: 'nameAsc', key: 'sort.nameAsc' },
  { id: 'nameDesc', key: 'sort.nameDesc' },
  { id: 'recentlyPlayed', key: 'sort.recentlyPlayed' },
  { id: 'mostPlayed', key: 'sort.mostPlayed' },
  { id: 'recentlyAdded', key: 'sort.recentlyAdded' },
  { id: 'playTime', key: 'sort.playTime' }
];

export function sortGames(games, sortId) {
  const list = [...games];
  switch (sortId) {
    case 'nameAsc':
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case 'nameDesc':
      return list.sort((a, b) => b.name.localeCompare(a.name));
    case 'mostPlayed':
      return list.sort((a, b) => (b.launchCount || 0) - (a.launchCount || 0));
    case 'recentlyAdded':
      return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    case 'playTime':
      return list.sort((a, b) => (b.totalPlayTime || 0) - (a.totalPlayTime || 0));
    case 'recentlyPlayed':
    default:
      return list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
  }
}

export function searchToolbar({ onAdd, showAdd = true } = {}) {
  const input = h('input', {
    type: 'search',
    'data-i18n-placeholder': 'library.searchPlaceholder',
    value: state.search,
    oninput: (e) => {
      setState({ search: e.target.value });
    },
    'aria-label': t('library.searchPlaceholder')
  });

  const select = h(
    'select',
    {
      class: 'select',
      'aria-label': t('library.sortBy'),
      onchange: (e) => {
        setState({ sort: e.target.value });
        if (state.settings) {
          window.sosis.settings.set('library', { defaultSort: e.target.value });
        }
      }
    },
    SORT_OPTIONS.map((o) => h('option', { value: o.id, 'data-i18n': o.key, selected: state.sort === o.id }))
  );
  select.value = state.sort;

  const gridBtn = h(
    'button',
    {
      class: 'icon-btn' + (state.view !== 'list' ? ' active' : ''),
      onclick: () => setView('grid'),
      'data-i18n-title': 'library.gridView'
    },
    [icon('grid', 16)]
  );
  const listBtn = h(
    'button',
    {
      class: 'icon-btn' + (state.view === 'list' ? ' active' : ''),
      onclick: () => setView('list'),
      'data-i18n-title': 'library.listView'
    },
    [icon('list', 16)]
  );

  const bar = h('div', { class: 'toolbar' }, [
    h('div', { class: 'search-box grow', style: { maxWidth: '360px' } }, [icon('search', 15), input]),
    select,
    gridBtn,
    listBtn,
    h('div', { class: 'grow' }),
    showAdd
      ? h('button', { class: 'btn btn-primary', onclick: () => onAdd && onAdd() }, [
          icon('plus', 15),
          h('span', { 'data-i18n': 'library.addGame' })
        ])
      : null
  ]);
  return bar;
}

function setView(view) {
  setState({ view });
  window.sosis.settings.set('library', { defaultView: view });
}
