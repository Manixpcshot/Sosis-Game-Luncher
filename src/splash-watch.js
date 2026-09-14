/**
 * splash-watch.js — classic (non-module) watchdog for the boot splash.
 *
 * It is deliberately NOT an ES module and has zero imports: even if the
 * whole app.js module graph fails to compile/load (the exact failure mode
 * that once left the app stuck on the splash forever), this file still runs
 * and gives the user:
 *   1. a visible error message (what actually broke),
 *   2. an "Enter offline" button (hand-off to app.js if it booted, else a
 *      one-time reload of the renderer),
 *   3. automatic reveal of the button if boot takes longer than 6 seconds.
 */
(function () {
  'use strict';

  var splash = document.getElementById('bootSplash');
  var btn = document.getElementById('bootOfflineBtn');
  var errBox = document.getElementById('bootError');
  var timer = null;

  function revealButton() {
    if (btn) btn.classList.remove('hidden');
  }

  function showError(msg) {
    if (errBox) {
      errBox.textContent = String(msg || '').slice(0, 400);
      errBox.classList.remove('hidden');
    }
    revealButton();
  }

  function isBooted() {
    return !!window.__sosisBooted || (splash && splash.classList.contains('hidden'));
  }

  window.addEventListener('error', function (e) {
    if (isBooted()) return;
    var where = e && e.filename ? ' (' + String(e.filename).split('/').pop() + ':' + (e.lineno || '?') + ')' : '';
    showError(((e && e.message) || 'Script error') + where);
  });

  window.addEventListener('unhandledrejection', function (e) {
    if (isBooted()) return;
    var r = e && e.reason;
    var msg = (r && (r.message || r.stack)) || String(r || 'Unhandled rejection');
    showError(msg.split('\n').slice(0, 3).join(' | '));
  });

  timer = setTimeout(function () {
    if (!isBooted()) revealButton();
  }, 6000);

  if (btn) {
    btn.addEventListener('click', function () {
      // Preferred path: app.js booted (maybe slowly) and registered a real
      // offline entry that renders the app from local data.
      if (typeof window.__sosisEnterOffline === 'function') {
        try { window.__sosisEnterOffline(); return; } catch (err) { showError(err && err.message); }
      }
      // app.js never came up: one automatic retry, then surface guidance.
      try {
        if (!sessionStorage.getItem('sosisSplashReloaded')) {
          sessionStorage.setItem('sosisSplashReloaded', '1');
          window.location.reload();
          return;
        }
      } catch (err) { /* sessionStorage unavailable — fall through */ }
      showError('Launcher failed to start. / اجرای برنامه ناموفق بود. (boot module did not load)');
    });
  }

  window.__sosisSplashWatch = {
    cancel: function () { if (timer) { clearTimeout(timer); timer = null; } },
    showError: showError,
    revealButton: revealButton
  };
})();
