/** Reusable empty state (spec §60). */
import { h, icon } from '../lib/dom.js';

export function emptyState({ iconName = 'library', titleKey, bodyKey, actionLabelKey, onAction }) {
  return h('div', { class: 'empty-state' }, [
    h('div', { class: 'empty-icon' }, [icon(iconName, 34)]),
    h('h3', { 'data-i18n': titleKey }),
    bodyKey ? h('p', { 'data-i18n': bodyKey }) : null,
    onAction
      ? h('button', { class: 'btn btn-primary', onclick: onAction }, [
          icon('plus', 15),
          h('span', { 'data-i18n': actionLabelKey || 'library.addGame' })
        ])
      : null
  ]);
}
