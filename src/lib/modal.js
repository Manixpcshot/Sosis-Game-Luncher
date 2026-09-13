/** Modal system: glass dialogs + native-backed confirm. */
import { h, clear } from './dom.js';
import { t } from './i18n.js';

const root = () => document.getElementById('modalRoot');

export function openModal({ title, sub, body, actions = [], wide = false, dismissible = true }) {
  const region = root();
  clear(region);
  const close = () => {
    region.classList.remove('open');
    clear(region);
    document.removeEventListener('keydown', onKey);
  };
  function onKey(e) {
    if (e.key === 'Escape' && dismissible) close();
  }
  document.addEventListener('keydown', onKey);

  const scrim = h('div', {
    class: 'modal-scrim',
    onclick: () => {
      if (dismissible) close();
    }
  });
  const modal = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' }, [
    title ? h('h3', { text: title }) : null,
    sub ? h('div', { class: 'modal-sub', text: sub }) : null,
    body,
    actions.length
      ? h(
          'div',
          { class: 'modal-actions' },
          actions.map((a) =>
            h('button', { class: 'btn ' + (a.kind || ''), onclick: () => (a.keepOpen ? a.onClick(close) : (a.onClick(close), close())) }, a.label)
          )
        )
      : null
  ]);
  region.appendChild(scrim);
  region.appendChild(modal);
  region.classList.add('open');
  const focusable = modal.querySelector('button, input, select, textarea, [tabindex]');
  if (focusable) focusable.focus();
  return close;
}

/** Native OS confirm via main process (accessible + localized by caller). */
export async function confirmDialog({ message, detail, confirmLabel, cancelLabel, type = 'question' }) {
  const res = await window.sosis.dialog.confirm({ message, detail, confirmLabel, cancelLabel, type });
  return res.ok && res.data && res.data.confirmed;
}

export function alertDialog({ message, detail, type = 'info' }) {
  return window.sosis.dialog.message({ message, detail, type });
}

export { t };
