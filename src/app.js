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

const PAGES = {
  library: { render: libraryPage, title: 'nav.library' },
  favorites: { render: favoritesPage, title: 'nav.favorites' },
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
    view: data.settings.library.defaultView
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
  setTimeout(() => document.getElementById('bootSplash').classList.add('hidden'), 350);
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
