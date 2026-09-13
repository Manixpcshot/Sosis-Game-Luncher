/** Minimal observable app state. */
const listeners = new Set();

export const state = {
  meta: null,
  settings: null,
  games: [],
  sessions: [],
  storage: null,
  route: { page: 'library', param: null },
  search: '',
  sort: null,
  view: null,
  sidebarCollapsed: localStorage.getItem('sosis.sidebar.collapsed') === '1'
};

export function setState(patch) {
  Object.assign(state, patch);
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error('store listener error', err);
    }
  }
}

export function sessionFor(gameId) {
  return state.sessions.find((s) => s.gameId === gameId) || null;
}
