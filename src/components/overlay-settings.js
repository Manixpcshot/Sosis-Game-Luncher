/** Settings > Overlay panel (spec §34-37) with live preview. */
import { h, icon } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { state } from '../lib/store.js';
import { settingRow, toggle, persist } from './settings-controls.js';

const POSITIONS = [
  { id: 'top-left', key: 'overlay.posTopLeft' },
  { id: 'top-right', key: 'overlay.posTopRight' },
  { id: 'bottom-left', key: 'overlay.posBottomLeft' },
  { id: 'bottom-right', key: 'overlay.posBottomRight' }
];
const SCALES = [
  { id: 'small', key: 'overlay.scaleSmall' },
  { id: 'medium', key: 'overlay.scaleMedium' },
  { id: 'large', key: 'overlay.scaleLarge' }
];

export function overlaySettingsPanel() {
  const cfg = state.settings.overlay;

  const enableToggle = toggle(cfg.enabled, async (v) => {
    await persist('overlay', { enabled: v });
  });

  const positionSelect = h(
    'select',
    {
      class: 'select',
      onchange: (e) => persist('overlay', { position: e.target.value })
    },
    POSITIONS.map((p) => h('option', { value: p.id, 'data-i18n': p.key, selected: cfg.position === p.id }))
  );
  positionSelect.value = cfg.position;

  const scaleSelect = h(
    'select',
    {
      class: 'select',
      onchange: (e) => persist('overlay', { scale: e.target.value })
    },
    SCALES.map((s) => h('option', { value: s.id, 'data-i18n': s.key, selected: cfg.scale === s.id }))
  );
  scaleSelect.value = cfg.scale;

  const opacityValue = h('b', { text: cfg.opacity + '%' });
  const opacityRange = h('input', {
    type: 'range',
    class: 'range',
    min: '20',
    max: '100',
    step: '5',
    value: String(cfg.opacity),
    oninput: (e) => {
      opacityValue.textContent = e.target.value + '%';
    },
    onchange: (e) => persist('overlay', { opacity: Number(e.target.value) })
  });

  const marginValue = h('b', { text: cfg.margin + 'px' });
  const marginRange = h('input', {
    type: 'range',
    class: 'range',
    min: '0',
    max: '120',
    step: '4',
    value: String(cfg.margin),
    oninput: (e) => {
      marginValue.textContent = e.target.value + 'px';
    },
    onchange: (e) => persist('overlay', { margin: Number(e.target.value) })
  });

  return h('div', { class: 'col' }, [
    settingRow('overlay.enable', 'overlay.enableDesc', enableToggle),
    settingRow('overlay.position', 'overlay.positionDesc', positionSelect),
    settingRow('overlay.scale', 'overlay.scaleDesc', scaleSelect),
    settingRow('overlay.opacity', 'overlay.opacityDesc', h('div', { class: 'row' }, [opacityRange, opacityValue])),
    settingRow('overlay.margin', 'overlay.marginDesc', h('div', { class: 'row' }, [marginRange, marginValue])),
    settingRow(
      'overlay.showFps',
      'overlay.showFpsDesc',
      toggle(cfg.showFps, (v) => persist('overlay', { showFps: v }))
    ),
    h('div', { class: 'row' }, [
      h('button', { class: 'btn', onclick: () => window.sosis.overlay.preview() }, [
        icon('monitor', 15),
        h('span', { 'data-i18n': 'overlay.preview' })
      ]),
      h('span', { class: 'muted small', 'data-i18n': 'overlay.previewHint' })
    ]),
    h('p', { class: 'muted small', 'data-i18n': 'overlay.safetyNote' })
  ]);
}
