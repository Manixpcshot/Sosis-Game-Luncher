/** Library game card (spec §7): cover, icon, name, stats, favorite, play. */
import { h, icon } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { playTime, clock, relativeDay, artUrl } from '../lib/format.js';
import { sessionFor } from '../lib/store.js';

let tickTimer = null;

export function startSessionTicks() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    document.querySelectorAll('[data-session-start]').forEach((el) => {
      const started = Number(el.getAttribute('data-session-start'));
      el.textContent = clock((Date.now() - started) / 1000);
    });
  }, 1000);
}

export function gameCard(game, { onOpen, onPlay, onFavorite, list = false } = {}) {
  const session = sessionFor(game.id);
  const coverUrl = artUrl(game.cover) || artUrl(game.banner);
  const iconUrl = artUrl(game.icon);
  const initials = (game.name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const playBtn = h(
    'button',
    {
      class: 'btn btn-primary btn-sm',
      onclick: (e) => {
        e.stopPropagation();
        onPlay && onPlay(game);
      },
      'data-i18n-title': session ? 'library.running' : 'library.play'
    },
    [icon('play', 13), h('span', { 'data-i18n': session ? 'library.running' : 'library.play' })]
  );
  if (session) playBtn.setAttribute('disabled', 'disabled');

  const favBtn = h(
    'button',
    {
      class: 'fav-btn' + (game.favorite ? ' faved' : ''),
      onclick: (e) => {
        e.stopPropagation();
        onFavorite && onFavorite(game);
      },
      'data-i18n-title': game.favorite ? 'library.unfavorite' : 'library.favorite',
      'aria-pressed': String(!!game.favorite)
    },
    [icon('star', 17)]
  );
  if (game.favorite) favBtn.querySelector('svg').setAttribute('fill', 'currentColor');

  const cover = h('div', { class: 'card-cover' }, [
    coverUrl
      ? h('img', { class: 'cover', src: coverUrl, alt: '', loading: 'lazy', onerror: (e) => e.target.remove() })
      : h('div', { class: 'cover-fallback', text: initials }),
    iconUrl ? h('img', { class: 'game-icon', src: iconUrl, alt: '', onerror: (e) => e.target.remove() }) : null,
    session
      ? h('div', { class: 'card-running-badge' }, [
          h('span', { class: 'dot', style: { width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' } }),
          h('span', { 'data-session-start': String(session.startedAt), text: clock(session.elapsedSeconds) })
        ])
      : null
  ]);

  const stats = h('div', { class: 'card-stats' }, [
    h('div', { class: 'stat' }, [h('span', { 'data-i18n': 'library.playTime' }), h('b', { text: playTime(game.totalPlayTime) })]),
    h('div', { class: 'stat' }, [h('span', { 'data-i18n': 'library.lastPlayed' }), h('b', { text: relativeDay(game.lastPlayed, t) })]),
    list
      ? h('div', { class: 'stat' }, [h('span', { 'data-i18n': 'library.launches' }), h('b', { text: String(game.launchCount || 0) })])
      : null
  ]);

  const card = h(
    'article',
    {
      class: 'game-card',
      tabindex: '0',
      role: 'button',
      'aria-label': game.name,
      onclick: () => onOpen && onOpen(game),
      onkeydown: (e) => {
        if (e.key === 'Enter') onOpen && onOpen(game);
      }
    },
    [
      cover,
      h('div', { class: 'card-body' }, [
        h('div', { class: 'card-title', text: game.name, title: game.name }),
        stats,
        h('div', { class: 'card-actions' }, [favBtn, playBtn])
      ])
    ]
  );
  return card;
}
