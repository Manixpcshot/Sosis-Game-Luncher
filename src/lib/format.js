/** Formatting helpers shared by cards, details, overlay-independent UI. */

/** 45720 -> "12h 42m" ; <1h -> "42m" ; 0 -> "0m" */
export function playTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** 3738 -> "01:02:18" (current session clock) */
export function clock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

export function bytes(n) {
  if (!n && n !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = Number(n);
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function speed(bytesPerSec) {
  return `${bytes(bytesPerSec)}/s`;
}

export function eta(seconds) {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return '--:--';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Relative day label keys: today / yesterday / never / absolute date */
export function relativeDay(ts, t) {
  if (!ts) return t('time.never');
  const d = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOfToday - day) / 86400000);
  if (diff === 0) return t('time.today');
  if (diff === 1) return t('time.yesterday');
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function artUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^https?:/i.test(pathOrUrl)) return pathOrUrl;
  // absolute fs path -> sosis://userdata/... (art + icons are whitelisted)
  const normalized = String(pathOrUrl).replace(/\\/g, '/');
  const idx = normalized.indexOf('/art/');
  if (idx >= 0) return 'sosis://userdata' + normalized.slice(idx);
  return null;
}
