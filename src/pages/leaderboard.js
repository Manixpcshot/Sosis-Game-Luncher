/**
 * Leaderboard page — online play-time ranking + most popular games,
 * aggregated by the Sosis Web Platform from synced sessions.
 */
import { h, clear, icon } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { playTime } from '../lib/format.js';
import { toast } from '../lib/toast.js';

export function leaderboardPage(root) {
  const boardList = h('ol', { class: 'board-list' });
  const popularList = h('ol', { class: 'board-list' });
  const status = h('div', { class: 'muted small', style: { minHeight: '18px' } });
  let server = '';

  const refreshBtn = h('button', { class: 'btn btn-sm', onclick: () => load(true) }, [
    icon('refresh', 14),
    h('span', { 'data-i18n': 'board.refresh' })
  ]);

  root.appendChild(
    h('div', { class: 'page-enter' }, [
      h('div', { class: 'page-header' }, [
        h('div', { class: 'page-heading' }, [h('h1', { 'data-i18n': 'board.title' }), h('p', { 'data-i18n': 'board.subtitle' })]),
        refreshBtn
      ]),
      status,
      h('div', { class: 'details-grid' }, [
        h('div', { class: 'panel' }, [h('h3', { 'data-i18n': 'board.playersTitle' }), boardList]),
        h('div', { class: 'panel' }, [h('h3', { 'data-i18n': 'board.popularTitle' }), popularList])
      ])
    ])
  );

  load(false);

  async function load(verbose) {
    clear(boardList);
    clear(popularList);
    status.textContent = '…';
    const [lb, pop, st] = await Promise.all([
      window.sosis.account.leaderboard(),
      window.sosis.account.popular(),
      window.sosis.account.state()
    ]);
    server = (st && st.server) || '';
    status.textContent = '';
    if (!lb.ok && !pop.ok) {
      status.textContent = t('board.offline');
      if (verbose) toast.error(t('board.offline'));
      boardList.appendChild(h('li', { class: 'muted small', 'data-i18n': 'board.empty' }));
      popularList.appendChild(h('li', { class: 'muted small', 'data-i18n': 'board.empty' }));
      return;
    }
    const users = (lb.ok && lb.users) || [];
    const games = (pop.ok && pop.games) || [];
    if (!users.length) boardList.appendChild(h('li', { class: 'muted small', 'data-i18n': 'board.empty' }));
    users.forEach((u, i) => {
      boardList.appendChild(
        h('li', { class: 'board-row' }, [
          h('span', { class: 'rank' + (i < 3 ? ' top' + (i + 1) : ''), text: String(i + 1) }),
          u.avatar
            ? h('img', {
                class: 'board-avatar',
                src: server + u.avatar,
                alt: '',
                onerror: (e) => e.target.remove()
              })
            : h('span', { class: 'board-avatar fallback', text: (u.username || '?')[0].toUpperCase() }),
          h('span', { class: 'grow', text: u.username }),
          h('span', { class: 'board-val', text: playTime(u.totalPlayTime) })
        ])
      );
    });
    if (!games.length) popularList.appendChild(h('li', { class: 'muted small', 'data-i18n': 'board.empty' }));
    games.forEach((g, i) => {
      popularList.appendChild(
        h('li', { class: 'board-row' }, [
          h('span', { class: 'rank' + (i < 3 ? ' top' + (i + 1) : ''), text: String(i + 1) }),
          h('span', { class: 'grow', text: g.name }),
          h('span', { class: 'board-val', text: `${g.launches} ${t('board.launches')} · ${g.players} ${t('board.players')}` })
        ])
      );
    });
  }

  return { refresh: () => load(false) };
}
