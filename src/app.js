'use strict';
/**
 * Sosis Launcher renderer bootstrap.
 * Boot (spec §42): fetch everything from main in one call -> apply language,
 * theme, games, settings -> render Library. Hash router, zero reloads.
 */
import { h, clear, icon } from './lib/dom.js';
import { loadBundle, t, applyToDocument } from './lib/i18n.js';
import { state, setState, subscribe } from './lib/store.js';
import { applyAppearance } from './components/settings-controls.js';
import { renderSidebar } from './components/sidebar.js';
import { toast } from './lib/toast.js';
import { clock } from './lib/format.js';
import { startSessionTicks } from './components/game-card.js';

import { libraryPage } from './pages/library.js';
import { favoritesPage } from './pages/favorites.js';
import { gameDetailsPage } from './pages/game-details.js';
import { settingsPageRoute } from './pages/settings.js';
import { aiPage } from './pages/ai.js';
import { downloadsPage } from './pages/downloads.js';
import { profilePage } from './pages/profile.js';
import { leaderboardPage } from './pages/leaderboard.js';
import { storePage } from './pages/store.js';

const PAGES = {
  store: { render: storePage, title: 'nav.store' },
  library: { render: libraryPage, title: 'nav.library' },
  favorites: { render: favoritesPage, title: 'nav.favorites' },
  leaderboard: { render: leaderboardPage, title: 'nav.leaderboard' },
  profile: { render: profilePage, title: 'nav.profile' },
  game: { render: (root, param) => gameDetailsPage(root, param), title: 'nav.library' },
  ai: { render: aiPage, title: 'nav.ai' },
  downloads: { render: downloadsPage, title: 'nav.downloads' },
  settings: { render: settingsPageRoute, title: 'nav.settings' }
};

let currentPage = null;

async function boot() {
  const res = await window.sosis.meta.boot();
  if (!res.ok) {
    document.getElementById('bootSplash').innerHTML = '<div class="boot-name">Sosis Launcher</div><div class="muted">Boot failed: ' + res.error + '</div>';
    return;
  }
  const data = res.data;
  loadBundle(data.i18n);
  setState({
    meta: data.meta,
    settings: data.settings,
    games: data.games,
    sessions: data.sessions,
    storage: data.storage,
    sort: data.settings.library.defaultSort,
    view: data.settings.library.defaultView,
    online: data.online || null
  });
  applyAppearance(data.settings);
  document.getElementById('appShell').classList.toggle('sidebar-collapsed', state.sidebarCollapsed);

  wireTitlebar();
  wireEvents();
  renderSidebar();
  subscribe(() => renderSidebar());
  window.addEventListener('sosis:rerender', () => route(true));
  window.addEventListener('hashchange', () => route(false));

  route(false);
  startSessionTicks();
  updateNetBanner(data.online, true);
  const wasOffline = data.online && (data.online.internet === false || data.online.server === false);
  if (wasOffline) {
    const splash = document.getElementById('bootSplash');
    splash.appendChild(h('div', { class: 'boot-offline', text: t('splash.offline') }));
  }
  setTimeout(() => document.getElementById('bootSplash').classList.add('hidden'), wasOffline ? 1100 : 350);
}

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, param] = hash.split('/');
  if (!PAGES[page]) return { page: 'library', param: null };
  return { page, param: param || null };
}

function route(force = false) {
  const next = parseRoute();
  if (!force && currentPage && currentPage.page === next.page && currentPage.param === next.param) return;
  currentPage = next;
  setState({ route: next });
  const view = document.getElementById('view');
  clear(view);
  if (currentPage.dispose) currentPage.dispose();
  const def = PAGES[next.page];
  const handle = def.render(view, next.param);
  currentPage.handle = handle;
  if (handle && handle.dispose) currentPage.dispose = handle.dispose;
  document.getElementById('pageTitle').textContent = t(def.title);
  applyToDocument(view);
  view.scrollTop = 0;
  view.focus({ preventScroll: true });
}

function wireTitlebar() {
  document.getElementById('btnMinimize').addEventListener('click', () => window.sosis.window.minimize());
  document.getElementById('btnMaximize').addEventListener('click', () => window.sosis.window.toggleMaximize());
  document.getElementById('btnClose').addEventListener('click', () => window.sosis.window.close());
  window.sosis.window.onState((s) => {
    document.body.classList.toggle('maximized', !!s.maximized);
  });
}

function wireEvents() {
  // Library changes
  window.sosis.games.onChanged(async () => {
    const list = await window.sosis.games.list();
    if (list.ok) setState({ games: list.data });
    if (currentPage && currentPage.handle && currentPage.handle.refresh) currentPage.handle.refresh();
  });

  // Sessions
  window.sosis.sessions.onStarted(async (info) => {
    const active = await window.sosis.sessions.active();
    if (active.ok) setState({ sessions: active.data });
    updateGlobalPill();
    if (currentPage && currentPage.handle && currentPage.handle.refresh) currentPage.handle.refresh();
  });
  window.sosis.sessions.onEnded(async (info) => {
    const active = await window.sosis.sessions.active();
    if (active.ok) setState({ sessions: active.data });
    updateGlobalPill();
    if (info.launchError) {
      toast.error(t('errors.launchFailed', { error: info.error || '' }));
    } else {
      toast.success(t('library.sessionSaved', { time: clock(info.seconds) }));
    }
    const list = await window.sosis.games.list();
    if (list.ok) setState({ games: list.data });
    if (currentPage && currentPage.handle && currentPage.handle.refresh) currentPage.handle.refresh();
  });

  // Settings changes from anywhere keep the store fresh
  subscribe(async (s) => {
    updateGlobalPill();
  });

  // Offline-mode awareness (net state from main process)
  if (window.sosis.net && window.sosis.net.onState) {
    window.sosis.net.onState((ns) => {
      const prev = state.online;
      setState({ online: ns });
      updateNetBanner(ns, false);
      const wasDown = prev && (prev.internet === false || prev.server === false);
      const isUp = ns && ns.internet !== false && ns.server !== false;
      if (wasDown && isUp) {
        toast.success(t('net.back'));
        window.dispatchEvent(new CustomEvent('sosis:rerender'));
      }
    });
  }
}

function updateNetBanner(ns, initial) {
  const shell = document.getElementById('appShell');
  if (!shell) return;
  let banner = document.getElementById('netBanner');
  const offline = ns && (ns.internet === false || ns.server === false);
  if (!offline) {
    if (banner) banner.remove();
    document.body.classList.remove('offline');
    return;
  }
  document.body.classList.add('offline');
  if (!banner) {
    banner = h('div', { id: 'netBanner', class: 'net-banner', role: 'status' }, [
      h('span', { class: 'nb-icon' }, [icon(ns && ns.internet === false ? 'wifiOff' : 'globe', 15)]),
      h('span', { class: 'nb-text', text: ns && ns.internet === false ? t('net.offlineNoInternet') : t('net.offlineNoServer') }),
      h('button', {
        class: 'btn btn-sm btn-ghost nb-retry',
        onclick: async (e) => {
          e.target.disabled = true;
          const fresh = await window.sosis.net.probe();
          e.target.disabled = false;
          if (fresh && fresh.ok) setState({ online: fresh.data });
          updateNetBanner(fresh && fresh.ok ? fresh.data : ns, false);
        }
      }, [h('span', { 'data-i18n': 'net.retry' })])
    ]);
    const body = shell.querySelector('.app-body');
    shell.insertBefore(banner, body);
  } else {
    const txt = banner.querySelector('.nb-text');
    if (txt) txt.textContent = ns && ns.internet === false ? t('net.offlineNoInternet') : t('net.offlineNoServer');
  }
  applyToDocument(banner);
  if (!initial) return;
}

let pillTimer = null;
function updateGlobalPill() {
  const pill = document.getElementById('globalSessionPill');
  const text = document.getElementById('globalSessionText');
  const session = state.sessions[0];
  if (!session) {
    pill.classList.add('hidden');
    if (pillTimer) {
      clearInterval(pillTimer);
      pillTimer = null;
    }
    return;
  }
  pill.classList.remove('hidden');
  const game = state.games.find((g) => g.id === session.gameId);
  const tick = () => {
    text.textContent = `${game ? game.name : ''} · ${clock((Date.now() - session.startedAt) / 1000)}`;
  };
  tick();
  if (!pillTimer) pillTimer = setInterval(tick, 1000);
}

// Global error boundary: show a toast instead of dying (spec §43)
window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
  toast.error(t('errors.generic'));
});
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  toast.error(t('errors.generic'));
});

boot();
