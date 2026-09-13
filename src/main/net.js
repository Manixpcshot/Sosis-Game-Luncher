'use strict';
/**
 * net — online/offline awareness for the whole app (offline mode).
 * Probes: 1) Chromium internet state (net.isOnline) 2) the Sosis Web Platform
 * (quick /api/site/config fetch with a short timeout). Cheap and event-driven:
 * re-probe at most every 30s (window focus / manual refresh), never polling.
 */
const { net } = require('electron');
const { makeLogger } = require('./util/log');

const log = makeLogger('net');

const state = { internet: true, server: null, checkedAt: 0 };
const listeners = [];
let accountRef = null;

function bind(account) {
  accountRef = account;
}

function onChange(fn) {
  listeners.push(fn);
}

async function probe(force = false) {
  if (!force && Date.now() - state.checkedAt < 30000) return { ...state };
  const beforeInternet = state.internet;
  const beforeServer = state.server;
  state.internet = net.isOnline();
  if (!state.internet) {
    state.server = false;
  } else if (accountRef) {
    try {
      state.server = await accountRef.quickProbe(6000);
    } catch {
      state.server = false;
    }
  } else {
    state.server = null;
  }
  state.checkedAt = Date.now();
  if (beforeInternet !== state.internet || beforeServer !== state.server) {
    log.info('state changed:', JSON.stringify(state));
    for (const fn of listeners) {
      try {
        fn({ ...state });
      } catch {}
    }
  }
  return { ...state };
}

module.exports = { state, probe, bind, onChange };
