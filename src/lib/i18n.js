/**
 * Central translation system on the renderer side (spec §22).
 * Components never hard-code visible text: they call t(key) or mark nodes
 * with data-i18n / data-i18n-title / data-i18n-placeholder.
 */
let messages = {};
let fallback = {};
let locale = 'en';
let direction = 'ltr';

export function loadBundle(bundle) {
  messages = bundle.messages || {};
  fallback = bundle.fallback || {};
  locale = bundle.locale || 'en';
  direction = bundle.direction || 'ltr';
  document.documentElement.lang = locale;
  document.documentElement.dir = direction;
  applyToDocument();
}

export function currentLocale() {
  return locale;
}
export function currentDirection() {
  return direction;
}

export function t(key, vars) {
  let str = messages[key];
  if (str === undefined) str = fallback[key];
  if (str === undefined) str = key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      str = str.replace(new RegExp('\\{' + name + '\\}', 'g'), String(value));
    }
  }
  return str;
}

/** Re-translate every static node in the document (used on language switch). */
export function applyToDocument(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const label = t(el.getAttribute('data-i18n-title'));
    el.setAttribute('title', label);
    el.setAttribute('aria-label', label);
    el.setAttribute('data-tip', label);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
}
