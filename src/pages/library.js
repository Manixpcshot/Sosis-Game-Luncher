/** Library page (spec §5, §13, §14): search, sort, grid/list, add game. */
import { h, clear, icon } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { state, setState } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { emptyState } from '../components/empty-state.js';
import { gameCard, startSessionTicks } from '../components/game-card.js';
import { searchToolbar, sortGames } from '../components/search.js';

export async function addGameFlow() {
  const pick = await window.sosis.games.pickExe();
  if (!pick.ok || pick.data.canceled) return;
  const { path: exePath, suggestedName } = pick.data;
  const res = await window.sosis.games.add({ exePath, name: suggestedName });
  if (res.ok) {
    toast.success(t('library.added', { name: res.data.name }));
    const games = await window.sosis.games.list();
    if (games.ok) setState({ games: games.data });
  } else {
    toast.error(res.code === 'EXE_NOT_FOUND' ? t('errors.exeMissing') : res.error);
  }
}

export function libraryPage(root, { favoritesOnly = false } = {}) {
  const header = h('div', { class: 'page-header' }, [
    h('div', { class: 'page-heading' }, [
      h('h1', { 'data-i18n': favoritesOnly ? 'nav.favorites' : 'nav.library' }),
      h('p', { 'data-i18n': favoritesOnly ? 'favorites.subtitle' : 'library.subtitle' })
    ])
  ]);

  const toolbar = favoritesOnly ? null : searchToolbar({ onAdd: addGameFlow });
  const gridWrap = h('div');

  root.appendChild(h('div', { class: 'page-enter' }, [header, toolbar, gridWrap]));
  render();
  startSessionTicks();

  function render() {
    clear(gridWrap);
    let games = favoritesOnly ? state.games.filter((g) => g.favorite) : state.games;
    const q = state.search.trim().toLowerCase();
    if (q && !favoritesOnly) games = games.filter((g) => g.name.toLowerCase().includes(q));
    games = sortGames(games, state.sort);

    if (!state.games.length) {
      gridWrap.appendChild(
        emptyState({
          iconName: 'library',
          titleKey: 'library.emptyTitle',
          bodyKey: 'library.emptyBody',
          actionLabelKey: 'library.addGame',
          onAction: addGameFlow
        })
      );
      return;
    }
    if (favoritesOnly && !games.length) {
      gridWrap.appendChild(emptyState({ iconName: 'favorites', titleKey: 'favorites.emptyTitle', bodyKey: 'favorites.emptyBody' }));
      return;
    }
    if (!games.length) {
      gridWrap.appendChild(emptyState({ iconName: 'search', titleKey: 'search.emptyTitle', bodyKey: 'search.emptyBody' }));
      return;
    }

    const grid = h('div', { class: 'game-grid' + (state.view === 'list' ? ' list-view' : '') });
    for (const game of games) {
      grid.appendChild(
        gameCard(game, {
          onOpen: (g) => (location.hash = '#/game/' + g.id),
          onPlay: (g) => play(g),
          onFavorite: async (g) => {
            const res = await window.sosis.games.setFavorite(g.id, !g.favorite);
            if (res.ok) {
              const list = await window.sosis.games.list();
              if (list.ok) setState({ games: list.data });
            }
          }
        })
      );
    }
    gridWrap.appendChild(grid);
  }

  async function play(game) {
    const res = await window.sosis.games.launch(game.id);
    if (res.ok) {
      toast.success(t('library.launched', { name: game.name }));
    } else if (res.code === 'ALREADY_RUNNING') {
      toast.info(t('library.alreadyRunning'));
    } else if (res.code === 'EXE_NOT_FOUND') {
      toast.error(t('errors.exeMissing'));
    } else {
      toast.error(t('errors.launchFailed', { error: res.error || '' }));
    }
  }

  return { refresh: render };
}
