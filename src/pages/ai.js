/** AI Assistant page (spec §15, §18). */
import { h } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { state } from '../lib/store.js';
import { aiAssistant } from '../components/ai-assistant.js';
import { emptyState } from '../components/empty-state.js';

export function aiPage(root) {
  const header = h('div', { class: 'page-header' }, [
    h('div', { class: 'page-heading' }, [h('h1', { 'data-i18n': 'nav.ai' }), h('p', { 'data-i18n': 'ai.subtitle' })]),
    h('button', { class: 'btn btn-sm', onclick: () => (location.hash = '#/settings') }, [
      h('span', { 'data-i18n': 'ai.openSettings' })
    ])
  ]);
  root.appendChild(header);
  if (!state.settings.ai.hasKey) {
    root.appendChild(
      h('div', { class: 'page-enter' }, [
        emptyState({
          iconName: 'ai',
          titleKey: 'ai.emptyTitle',
          bodyKey: 'ai.emptyBody',
          actionLabelKey: 'ai.configure',
          onAction: () => (location.hash = '#/settings')
        })
      ])
    );
    return { refresh: () => {} };
  }
  return aiAssistant(root);
}
