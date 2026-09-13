/** Sidebar navigation — mirrors to the right automatically in RTL (spec §24). */
import { h, icon, clear } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { state, setState } from '../lib/store.js';

const NAV = [
  { page: 'library', icon: 'library', label: 'nav.library' },
  { page: 'favorites', icon: 'favorites', label: 'nav.favorites' },
  { page: 'leaderboard', icon: 'trophy', label: 'nav.leaderboard' },
  { page: 'profile', icon: 'user', label: 'nav.profile' },
  { page: 'ai', icon: 'ai', label: 'nav.ai' },
  { page: 'downloads', icon: 'downloads', label: 'nav.downloads' }
];

export function renderSidebar() {
  const aside = document.getElementById('sidebar');
  clear(aside);

  const sectionLabel = h('div', { class: 'sidebar-section-label', text: t('nav.sectionBrowse') });
  aside.appendChild(sectionLabel);

  for (const item of NAV) {
    aside.appendChild(
      h(
        'button',
        {
          class: 'nav-item' + (state.route.page === item.page ? ' active' : ''),
          onclick: () => navigate(item.page),
          'data-i18n-title': item.label
        },
        [icon(item.icon, 19), h('span', { class: 'nav-label', 'data-i18n': item.label })]
      )
    );
  }

  aside.appendChild(h('div', { class: 'sidebar-spacer' }));
  aside.appendChild(h('div', { class: 'sidebar-section-label', text: t('nav.sectionSystem') }));
  aside.appendChild(
    h(
      'button',
      {
        class: 'nav-item' + (state.route.page === 'settings' ? ' active' : ''),
        onclick: () => navigate('settings'),
        'data-i18n-title': 'nav.settings'
      },
      [icon('settings', 19), h('span', { class: 'nav-label', 'data-i18n': 'nav.settings' })]
    )
  );
  aside.appendChild(
    h(
      'button',
      {
        class: 'nav-item collapse-btn',
        onclick: () => {
          setState({ sidebarCollapsed: !state.sidebarCollapsed });
          localStorage.setItem('sosis.sidebar.collapsed', state.sidebarCollapsed ? '1' : '0');
          document.getElementById('appShell').classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
          renderSidebar();
        },
        'data-i18n-title': 'nav.collapse'
      },
      [
        h('span', { class: 'collapse-icon' }, [icon(state.sidebarCollapsed ? 'chevronLeft' : 'chevronRight', 17)]),
        h('span', { class: 'nav-label', 'data-i18n': 'nav.collapse' })
      ]
    )
  );

  const footer = h('div', { class: 'sidebar-footer' }, [
    h('span', { class: 'footer-text muted small' }, [
      'v' + (state.meta ? state.meta.version : '1.0.0')
    ])
  ]);
  aside.appendChild(footer);
}

function navigate(page) {
  location.hash = '#/' + page;
}
