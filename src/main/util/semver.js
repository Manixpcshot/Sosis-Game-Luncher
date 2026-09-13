'use strict';
/** Minimal semver comparison for the update system (no dependencies). */

function parse(version) {
  const m = String(version || '')
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function compare(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;
  return 0;
}

/** True when `latest` is strictly newer than `current`. */
function isNewer(current, latest) {
  return compare(latest, current) > 0;
}

module.exports = { parse, compare, isNewer };
