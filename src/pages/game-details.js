/** Game details page (spec §8). */
import { clear } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { state } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { emptyState } from '../components/empty-state.js';
import { renderGameDetails } from '../components/game-details.js';

export function gameDetailsPage(root, gameId) {
  const render = () => {
    clear(root);
    const game = state.games.find((g) => g.id === gameId);
    if (!game) {
      root.appendChild(emptyState({ iconName: 'warn', titleKey: 'errors.gameNotFound', bodyKey: 'errors.gameNotFoundBody' }));
      return;
    }
    renderGameDetails(game, root, {
      onBack: () => (location.hash = '#/library'),
      onRefresh: async () => {
        const list = await window.sosis.games.list();
        if (list.ok) {
          const { setState } = await import('../lib/store.js');
          setState({ games: list.data });
        }
        render();
      }
    });
  };
  render();
  return { refresh: render };
}

export function notifyLaunchError(info) {
  toast.error(t('errors.launchFailed', { error: info.error || '' }));
}
