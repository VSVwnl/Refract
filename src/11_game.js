/*
 * Boot and the main loop. Simulation runs on a fixed timestep so behaviour is
 * identical on any display refresh rate; rendering happens once per frame and
 * only reads state.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});
  var T = R.TIMING;

  R.state = null;
  R.running = false;

  var accumulator = 0;
  var lastFrame = 0;
  var loopStarted = false;

  /* ---------- fatal errors ---------- */

  R.fatal = function (message) {
    var el = document.getElementById('fatal');
    if (el) {
      el.textContent = message;
      el.hidden = false;
    }
  };

  /* ---------- tab icon (drawn at runtime; no image files) ---------- */

  function installFavicon() {
    var cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 64;
    var g = cv.getContext('2d');
    g.fillStyle = '#0b0f1e';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#ffc247';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(8, 54);
    g.lineTo(38, 54);
    g.lineTo(56, 12);
    g.stroke();
    g.strokeStyle = '#cfe3ff';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(30, 62);
    g.lineTo(48, 44);
    g.stroke();
    var link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = cv.toDataURL('image/png');
    document.head.appendChild(link);
  }

  /* ---------- layout ---------- */

  var layoutQueued = false;

  R.layout = function () {
    R.render.applyLayout();
  };

  function queueLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    global.requestAnimationFrame(function () {
      layoutQueued = false;
      R.layout();
    });
  }

  /* ---------- run lifecycle ---------- */

  R.newRun = function (seed) {
    var s = R.resetState(seed === undefined ? (Date.now() & 0x7fffffff) : seed);
    R.state = s;
    return s;
  };

  /* ---------- simulation ---------- */

  R.simStep = function (s, dt) {
    s.time += dt;
  };

  function stepPhysics(s, dt) {
    R.simStep(s, dt);
  }

  /* ---------- main loop ---------- */

  function frame(now) {
    global.requestAnimationFrame(frame);
    var s = R.state;
    if (!s) return;

    var dtReal = (now - lastFrame) / 1000;
    lastFrame = now;
    if (!(dtReal > 0)) dtReal = 0;
    if (dtReal > T.MAX_FRAME_DT) dtReal = T.MAX_FRAME_DT;

    if (R.isSimulating(s)) {
      accumulator += dtReal;
      var steps = 0;
      while (accumulator >= T.FIXED_STEP && steps < T.MAX_STEPS_PER_FRAME) {
        for (var k = 0; k < s.speed; k++) stepPhysics(s, T.FIXED_STEP);
        accumulator -= T.FIXED_STEP;
        steps++;
      }
      if (accumulator > T.FIXED_STEP * T.MAX_STEPS_PER_FRAME) accumulator = 0;
    } else {
      accumulator = 0;
    }

    R.render.draw(s, dtReal);
    s.events.length = 0;
  }

  R.isSimulating = function (s) {
    return s.phase === 'building' || s.phase === 'wave';
  };

  /* ---------- pause on tab hide ---------- */

  function onVisibility() {
    var s = R.state;
    if (!s) return;
    if (document.hidden && R.isSimulating(s)) {
      R.pause();
    }
    accumulator = 0;
  }

  R.pause = function () {
    var s = R.state;
    if (!s || !R.isSimulating(s)) return;
    s.pausedFrom = s.phase;
    s.phase = 'paused';
  };

  R.resume = function () {
    var s = R.state;
    if (!s || s.phase !== 'paused') return;
    s.phase = s.pausedFrom || 'building';
    s.pausedFrom = null;
    accumulator = 0;
  };

  /* ---------- boot ---------- */

  R.boot = function () {
    if (!global.THREE) {
      R.fatal('This build needs the Three.js file in vendor/ to run.');
      return;
    }

    R.loadMeta();
    var s = R.newRun();

    R.render.applyLayout();
    if (!R.render.init(s)) {
      R.fatal('This device cannot run WebGL.');
      return;
    }
    R.render.applyLayout();

    installFavicon();

    global.addEventListener('resize', queueLayout, { passive: true });
    global.addEventListener('orientationchange', queueLayout, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    /* The board is live from the first frame; the title screen arrives in a later phase. */
    s.phase = 'building';

    if (!loopStarted) {
      loopStarted = true;
      lastFrame = global.performance ? global.performance.now() : Date.now();
      global.requestAnimationFrame(frame);
    }
    R.running = true;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { R.boot(); });
  } else {
    R.boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
