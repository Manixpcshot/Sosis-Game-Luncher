/** Toast feedback (spec §59). */
import { h, icon, clear } from './dom.js';

const REGION = () => document.getElementById('toastRegion');

function show(kind, message, ms = 3800) {
  const region = REGION();
  if (!region) return;
  const iconName = kind === 'success' ? 'check' : kind === 'error' ? 'warn' : 'info';
  const el = h('div', { class: `toast ${kind}` }, [
    h('span', { class: 't-icon' }, [icon(iconName, 18)]),
    h('span', { class: 'grow', text: message })
  ]);
  region.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  }, ms);
  // keep at most 4 toasts
  while (region.children.length > 4) region.removeChild(region.firstChild);
}

export const toast = {
  success: (m, ms) => show('success', m, ms),
  error: (m, ms) => show('error', m, ms || 5200),
  info: (m, ms) => show('info', m, ms)
};

export function clearToasts() {
  const region = REGION();
  if (region) clear(region);
}
