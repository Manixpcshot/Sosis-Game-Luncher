/** Tiny DOM helpers — no framework, no build step. */

/** h('div', {class:'x', onclick: fn}, [children...]) */
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = String(value);
    else if (key === 'html') el.innerHTML = String(value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'disabled' || key === 'checked' || key === 'value' || key === 'selected') el[key] = value;
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else if (child instanceof Node) el.appendChild(child);
    else el.appendChild(document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

/** Inline SVG icon factory (stroke-based, currentColor). */
export function icon(name, size = 18) {
  const paths = ICONS[name] || ICONS.dot;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths;
  return svg;
}

export const ICONS = {
  library: '<path d="M4 5a2 2 0 0 1 2-2h3v18H6a2 2 0 0 1-2-2z"/><path d="M11 3h4v18h-4z"/><path d="M17.5 3.6l2.6.7-4.4 16.4-2.6-.7z"/>',
  favorites: '<path d="M12 3.6l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z"/>',
  ai: '<path d="M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1 3 4 4 4 0 0 1-3 4v1a4 4 0 0 1-8 0v-1a4 4 0 0 1-3-4 4 4 0 0 1 3-4V7a4 4 0 0 1 4-4z"/><circle cx="9.5" cy="11" r="0.6" fill="currentColor"/><circle cx="14.5" cy="11" r="0.6" fill="currentColor"/>',
  downloads: '<path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><path d="M4 18h16"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12z"/>',
  play: '<path d="M7 4.8v14.4L19 12z" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  star: '<path d="M12 3.6l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  crosshair: '<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15l-5-5-9 9"/>',
  link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chevronLeft: '<path d="M14 6l-6 6 6 6"/>',
  chevronRight: '<path d="M10 6l6 6-6 6"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.7" fill="currentColor"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.7" fill="currentColor"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
  gamepad: '<path d="M6 9h4M8 7v4"/><circle cx="15.5" cy="8.5" r="0.8" fill="currentColor"/><circle cx="18" cy="11" r="0.8" fill="currentColor"/><path d="M7 5h10a5 5 0 0 1 5 5v4a4 4 0 0 1-7 2.6L14 16h-4l-1 .6A4 4 0 0 1 2 14v-4a5 5 0 0 1 5-5z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.4 3.8 5.3 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.3-3.8-8.5s1.3-6.1 3.8-8.5z"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-.8 2-1.7 0-1.4-1.2-1.8-1.2-3 0-1.2 1-2 2.4-2H17a4 4 0 0 0 4-4c0-4-4-7.3-9-7.3z"/><circle cx="7.5" cy="10.5" r="1" fill="currentColor"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/><circle cx="16.5" cy="10" r="1" fill="currentColor"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  database: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  info2: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.7" fill="currentColor"/>',
  shortcut: '<path d="M9 15l6-6"/><path d="M10 6l1.5-1.5a4 4 0 0 1 6 6L16 12"/><path d="M14 18l-1.5 1.5a4 4 0 0 1-6-6L8 12"/>',
  dot: '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>'
};
