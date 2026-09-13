'use strict';
/**
 * Overlay renderer — ultra-light.
 *  - Session clock: computed locally from `startedAt` (1 tick/sec, no IPC).
 *  - FPS: measured from this window's own compositor frame rate via rAF.
 *    This is the safe, injection-free measurement (see README). When frames
 *    stop (throttling/minimize) we show "--" instead of a wrong number.
 * Nothing else is displayed (spec §32).
 */
(function () {
  const fpsValue = document.getElementById('fpsValue');
  const timeValue = document.getElementById('timeValue');
  const fpsRow = document.getElementById('fpsRow');
  const card = document.getElementById('card');

  const SCALE = { small: 0.85, medium: 1, large: 1.2 };
  let startedAt = null;
  let clockTimer = null;

  function pad(n) {
    return String(n).padStart(2, '0');
  }
  function clock(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60);
  }

  function tickClock() {
    if (startedAt == null) {
      timeValue.textContent = '00:00:00';
      return;
    }
    timeValue.textContent = clock((Date.now() - startedAt) / 1000);
  }

  // ---- FPS via rAF (compositor frame rate of this transparent window)
  let frames = 0;
  let lastSample = performance.now();
  let lowCount = 0;
  function frameLoop(now) {
    frames += 1;
    const elapsed = now - lastSample;
    if (elapsed >= 1000) {
      const fps = Math.round((frames * 1000) / elapsed);
      frames = 0;
      lastSample = now;
      if (fps <= 1) {
        lowCount += 1;
        if (lowCount >= 2) fpsValue.textContent = '--';
      } else {
        lowCount = 0;
        fpsValue.textContent = String(fps);
      }
    }
    requestAnimationFrame(frameLoop);
  }
  requestAnimationFrame(frameLoop);

  function applyState(state) {
    if (!state) return;
    const scale = SCALE[state.scale] || 1;
    document.documentElement.style.setProperty('--scale', String(scale));
    if (state.showFps === false) fpsRow.classList.add('hidden');
    else fpsRow.classList.remove('hidden');
    if (state.session && state.session.startedAt) {
      startedAt = state.session.startedAt;
      if (!clockTimer) clockTimer = setInterval(tickClock, 1000);
      tickClock();
    } else {
      startedAt = null;
      if (clockTimer) {
        clearInterval(clockTimer);
        clockTimer = null;
      }
      timeValue.textContent = '00:00:00';
    }
  }

  if (window.sosisOverlay) {
    window.sosisOverlay.onState(applyState);
    window.sosisOverlay.ready();
  }
  card.setAttribute('aria-hidden', 'true');
})();
