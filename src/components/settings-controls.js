/** Shared settings widgets: rows, toggles, persistence with feedback. */
import { h } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { state, setState } from '../lib/store.js';
import { toast } from '../lib/toast.js';

export function settingRow(titleKey, descKey, control) {
  return h('div', { class: 'setting-row' }, [
    h('div', { class: 'setting-info' }, [
      h('div', { class: 'setting-title', 'data-i18n': titleKey }),
      descKey ? h('div', { class: 'setting-desc', 'data-i18n': descKey }) : null
    ]),
    h('div', { class: 'setting-control' }, [control])
  ]);
}

export function toggle(checked, onChange) {
  const input = h('input', {
    type: 'checkbox',
    checked: !!checked,
    onchange: (e) => onChange(e.target.checked)
  });
  return h('label', { class: 'switch' }, [input, h('span', { class: 'track' }, [h('span', { class: 'thumb' })])]);
}

export async function persist(section, patch, { silent = false } = {}) {
  const res = await window.sosis.settings.set(section, patch);
  if (res.ok) {
    setState({ settings: res.data });
    applyAppearance(res.data);
    if (!silent) toast.success(t('common.saved'));
    return res.data;
  }
  toast.error(res.error || t('errors.generic'));
  return null;
}

/** Apply theme/accent/scale/direction instantly (spec §25, §23). */
export function applyAppearance(settings) {
  const body = document.body;
  body.classList.toggle('theme-dark', settings.appearance.theme !== 'light');
  body.classList.toggle('theme-light', settings.appearance.theme === 'light');
  body.setAttribute('data-accent', settings.appearance.accent || 'cyan');
  body.classList.toggle('reduce-motion', !!settings.appearance.reduceMotion);
  body.classList.toggle('bg-glow', !!settings.appearance.backgroundGlow);
  document.documentElement.style.setProperty('--ui-scale', String((settings.appearance.uiScale || 100) / 100));
}

export function selectInput(options, value, onChange) {
  const el = h(
    'select',
    { class: 'select', onchange: (e) => onChange(e.target.value) },
    options.map((o) => h('option', { value: o.id, 'data-i18n': o.key, selected: o.id === value }))
  );
  el.value = value;
  return el;
}
