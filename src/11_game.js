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
    if (R.state) R.enemies.releaseAll(R.state);
    var s = R.resetState(seed === undefined ? (Date.now() & 0x7fffffff) : seed);
    R.state = s;
    R.beam.recompute(s);
    if (R.ui.reset) R.ui.reset();
    if (R.render.resetSweep) R.render.resetSweep();
    if (R.input.cancel) R.input.cancel();
    accumulator = 0;
    return s;
  };

  /* A fresh run that opens on the title card. */
  R.titleRun = function (seed) {
    var s = R.newRun(seed);
    s.phase = 'title';
    return s;
  };

  /* Leave the title card and start playing. */
  R.startRun = function () {
    var s = R.state;
    if (s.phase !== 'title') return;
    s.phase = 'building';
    s.countdown = R.BALANCE.FIRST_COUNTDOWN;
    R.emit(s, 'runstart', {});
  };

  /* Straight back to the board: the title card is only shown on first load. */
  R.restartRun = function (seed) {
    var s = R.newRun(seed);
    s.phase = 'building';
    s.countdown = R.BALANCE.FIRST_COUNTDOWN;
    R.emit(s, 'runstart', {});
    return s;
  };

  /* Keep playing after a win: generated waves until the core falls. */
  R.continueEndless = function () {
    var s = R.state;
    if (s.phase !== 'won') return;
    s.endless = true;
    s.phase = 'building';
    s.countdown = R.BALANCE.COUNTDOWN;
    R.applyUnlocks(s, s.wave + 1);
    R.emit(s, 'endless', { wave: s.wave + 1 });
  };

  R.endRun = function (s, won) {
    s.score = R.computeScore(s);
    s.phase = won ? 'won' : 'lost';
    R.saveBest(s.score);
    R.emit(s, won ? 'win' : 'lose', { score: s.score, wave: s.wave });
  };

  /* ---------- wave flow ---------- */

  R.applyUnlocks = function (s, upcomingWave) {
    var table = R.BALANCE.UNLOCK_WAVE;
    for (var type in table) {
      if (!s.unlocked[type] && upcomingWave >= table[type]) {
        s.unlocked[type] = true;
        R.emit(s, 'unlock', { type: type });
      }
    }
  };

  R.startWave = function (s) {
    s.wave++;
    s.spawnQueue = R.enemies.buildQueue(s.wave);
    s.spawnCursor = 0;
    s.waveEnemiesTotal = s.spawnQueue.length;
    s.waveTime = 0;
    s.countdown = 0;
    s.phase = 'wave';
    R.emit(s, 'wavestart', { wave: s.wave, count: s.waveEnemiesTotal });
  };

  /* Gold on offer for skipping the rest of the countdown. */
  R.earlyCallBonus = function (s) {
    if (s.phase !== 'building') return 0;
    return Math.ceil(Math.max(0, s.countdown) * R.BALANCE.EARLY_CALL_RATE);
  };

  R.callWaveEarly = function (s) {
    if (s.phase !== 'building') return;
    var bonus = R.earlyCallBonus(s);
    s.gold += bonus;
    s.goldEarned += bonus;
    R.startWave(s);
    R.emit(s, 'earlycall', { bonus: bonus });
  };

  R.finishWave = function (s) {
    var bonus = R.BALANCE.WAVE_CLEAR_BASE + R.BALANCE.WAVE_CLEAR_PER_WAVE * s.wave;
    s.wavesCleared++;
    s.gold += bonus;
    s.goldEarned += bonus;
    R.emit(s, 'waveclear', { wave: s.wave, bonus: bonus });
    if (!s.endless && s.wave >= R.BALANCE.WAVES.length) {
      R.endRun(s, true);
      return;
    }
    s.phase = 'building';
    s.countdown = R.BALANCE.COUNTDOWN;
    R.applyUnlocks(s, s.wave + 1);
  };

  /* ---------- simulation ---------- */

  /*
   * One fixed step, in the order the systems depend on each other:
   * countdown, spawning, movement, light and damage, deaths and leaks,
   * then the phase transitions those results imply.
   */
  R.simStep = function (s, dt) {
    s.time += dt;

    if (s.phase === 'building') {
      s.countdown -= dt;
      if (s.countdown <= 0) R.startWave(s);
    }

    if (s.phase === 'wave') {
      s.waveTime += dt;
      R.enemies.spawnStep(s, dt);
    }

    R.enemies.moveStep(s, dt);
    R.beam.solve(s, R.enemies.occupancy(s), dt, s.beam);
    R.enemies.resolveStep(s);

    if (s.coreHp <= 0 && s.phase !== 'lost') {
      s.coreHp = 0;
      R.endRun(s, false);
      return;
    }

    if (s.phase === 'wave' && R.enemies.waveComplete(s)) R.finishWave(s);
  };

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
        for (var k = 0; k < s.speed; k++) R.simStep(s, T.FIXED_STEP);
        accumulator -= T.FIXED_STEP;
        steps++;
      }
      if (accumulator > T.FIXED_STEP * T.MAX_STEPS_PER_FRAME) accumulator = 0;
    } else {
      accumulator = 0;
    }

    R.ui.frame(s, dtReal);
    R.render.draw(s, dtReal);
    if (R.debug) R.debug.frame(dtReal);
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
    var s = R.titleRun();

    R.ui.init();
    R.render.applyLayout();
    if (!R.render.init(s)) {
      R.fatal('This device cannot run WebGL.');
      return;
    }
    R.render.applyLayout();
    R.input.init();
    if (R.debug) R.debug.install();

    installFavicon();

    /* A page opened in a background tab starts paused rather than silently idle. */
    if (document.hidden) onVisibility();

    global.addEventListener('resize', queueLayout, { passive: true });
    global.addEventListener('orientationchange', queueLayout, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

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
