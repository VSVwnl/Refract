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
    if (R.render.clearParticles) R.render.clearParticles();
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
    R.refreshSuggestion(s);
    R.beginTutorial(s);
    R.emit(s, 'runstart', {});
  };

  /* Straight back to the board: the title card is only shown on first load. */
  R.restartRun = function (seed) {
    var s = R.newRun(seed);
    s.phase = 'building';
    R.refreshSuggestion(s);
    /*
     * No walkthrough here. Playing again is not a first run: whoever is
     * pressing this button has already been through it once, or skipped it.
     * It belongs to leaving the title card, which is where a first run starts.
     */
    R.emit(s, 'runstart', {});
    return s;
  };

  /* Keep playing after a win: generated waves until the core falls. */
  R.continueEndless = function () {
    var s = R.state;
    if (s.phase !== 'won') return;
    s.endless = true;
    s.phase = 'building';
    R.applyUnlocks(s, s.wave + 1);
    R.emit(s, 'endless', { wave: s.wave + 1 });
  };

  R.endRun = function (s, won) {
    s.score = R.computeScore(s);
    s.phase = won ? 'won' : 'lost';
    R.saveBest(s.score);
    R.emit(s, won ? 'win' : 'lose', { score: s.score, wave: s.wave });
  };

  /* ---------- the opening ---------- */

  /*
   * Before the first piece is placed, the board points at a tile that turns
   * the beam along a road. It is chosen by asking the solver, not written
   * down, so it stays right if the map or the tuning changes. The suggestion
   * clears itself as soon as anything is placed.
   */
  R.refreshSuggestion = function (s) {
    if (s.pieces.size > 0 || s.wave > 0) {
      s.ui.suggest = null;
      return null;
    }
    var best = null;
    for (var c = 0; c < R.BALANCE.COLS; c++) {
      for (var r = 0; r < R.BALANCE.ROWS; r++) {
        if (R.pieces.placementProblem(s, 'mirror', c, r)) continue;
        var orient = R.beam.bestOrientation(s, 'mirror', c, r);
        var res = R.beam.preview(s, 'mirror', c, r, orient, null);
        if (!res) continue;
        var lit = 0;
        for (var i = 0; i < res.lit.length; i++) {
          if (res.lit[i] > 0 && (s.grid.kind[i] === R.ROAD || s.grid.kind[i] === R.SPAWN)) lit++;
        }
        if (!best || lit > best.lit) best = { c: c, r: r, lit: lit };
      }
    }
    s.ui.suggest = best && best.lit > 1 ? { c: best.c, r: best.r } : null;
    return s.ui.suggest;
  };

  /* ---------- the walkthrough ---------- */

  /*
   * A three-step walkthrough shown once, before the first wave of a player's
   * first run. Each step asks for one action and says one short thing; there
   * is no page of text and nothing to dismiss. It never runs during combat,
   * because it is over before the first wave can be started, and planning has
   * no clock, so nothing advances while it is being read.
   */
  R.TUTORIAL_TEXT = {
    place: 'Your core fires a beam. Place a Mirror to redirect it.',
    rotate: 'Tap a piece to rotate it. Aim light along the road.',
    start: 'Enemies absorb light. Send your beam along their path to burn them before they reach the core.'
  };

  R.tutorialActive = function (s) {
    return !!(s && s.ui.tutorial);
  };

  R.tutorialStep = function (s) {
    return s && s.ui.tutorial ? s.ui.tutorial.step : null;
  };

  /* The tile the walkthrough is pointing at, or null. */
  R.tutorialCell = function (s) {
    var t = s && s.ui.tutorial;
    return t && t.cell ? t.cell : null;
  };

  R.beginTutorial = function (s) {
    if (R.meta.taught) return null;
    var cell = R.refreshSuggestion(s);
    if (!cell) return null;
    s.ui.selectedType = 'mirror';
    s.ui.tutorial = { step: 'place', cell: { c: cell.c, r: cell.r }, pieceId: null, needsFlip: false };
    R.emit(s, 'tutorial', { step: 'place' });
    return s.ui.tutorial;
  };

  R.endTutorial = function (s) {
    if (!s.ui.tutorial) return;
    s.ui.tutorial = null;
    s.ui.suggest = null;
    R.markTaught();
    R.emit(s, 'tutorial', { step: null });
  };

  /*
   * Whether the piece just placed would light more road the other way round.
   * Only then is a rotation asked for.
   */
  function wantsFlip(s, piece) {
    var other = piece.orient ? 0 : 1;
    var now = s.beam.litRoadCount;
    var res = R.beam.preview(s, piece.type, piece.c, piece.r, other, R.grid.idx(piece.c, piece.r));
    if (!res) return false;
    var lit = 0;
    for (var i = 0; i < res.lit.length; i++) {
      if (res.lit[i] > 0 && (s.grid.kind[i] === R.ROAD || s.grid.kind[i] === R.SPAWN)) lit++;
    }
    return lit > now;
  }

  /* Driven by what the player does, never by a timer. */
  R.tutorialSaw = function (s, what, data) {
    var t = s.ui.tutorial;
    if (!t) return;

    if (t.step === 'place' && what === 'place') {
      var piece = R.pieces.byId(s, data.id);
      if (!piece) return;
      t.pieceId = piece.id;
      t.cell = { c: piece.c, r: piece.r };
      t.needsFlip = wantsFlip(s, piece);
      t.step = 'rotate';
      R.emit(s, 'tutorial', { step: 'rotate' });
      return;
    }

    if (t.step === 'rotate') {
      /*
       * Turning the piece always satisfies this step. Merely selecting it does
       * too, but only when the route it already makes is the good one, so the
       * walkthrough never asks anyone to rotate away from a working answer.
       */
      if (what === 'flip') { t.needsFlip = false; }
      if (t.needsFlip) return;
      if (what === 'flip' || what === 'select') {
        t.step = 'start';
        t.cell = null;
        s.ui.suggest = null;
        R.emit(s, 'tutorial', { step: 'start' });
      }
    }
  };

  /*
   * Skipping puts the same opening mirror down, so a returning player starts
   * the first wave from the same viable board the walkthrough would have left.
   */
  R.skipTutorial = function (s) {
    var t = s.ui.tutorial;
    if (!t) return false;
    if (!R.pieces.byId(s, t.pieceId) && t.cell) {
      R.pieces.place(s, 'mirror', t.cell.c, t.cell.r);
    }
    R.pieces.deselect(s);
    R.endTutorial(s);
    R.emit(s, 'tutorialskip', {});
    return true;
  };

  /* ---------- run upgrades ---------- */

  /*
   * Upgrades are the part of progression that changes how the network is
   * built, as opposed to core levels, which only make the same network
   * stronger. They are offered at fixed points so a run is reproducible, and
   * an offer never contains an upgrade already taken or one excluded by it.
   */
  /* A seeded pick, so the same run seed always offers the same choices. */
  R.buildUpgradeOffer = function (s) {
    var pool = R.eligibleUpgrades(s);
    var take = Math.min(R.BALANCE.UPGRADE_OFFER, pool.length);
    var offer = [];
    for (var i = 0; i < take; i++) {
      var pick = Math.floor(s.rng() * pool.length);
      if (pick >= pool.length) pick = pool.length - 1;
      offer.push(pool.splice(pick, 1)[0]);
    }
    return offer.length ? offer : null;
  };

  R.chooseUpgrade = function (s, key) {
    if (s.phase !== 'choosing') return false;
    if (!s.upgradeOffer || s.upgradeOffer.indexOf(key) < 0) return false;
    s.upgrades.push(key);
    s.upgradeOffer = null;
    s.phase = 'building';
    R.beam.recompute(s);
    R.emit(s, 'upgraded', { upgrade: key });
    return true;
  };

  /* ---------- wave flow ---------- */

  R.applyUnlocks = function (s, upcomingWave) {
    var table = R.BALANCE.UNLOCK_WAVE;
    for (var type in table) {
      if (!s.unlocked[type] && upcomingWave >= table[type]) {
        s.unlocked[type] = true;
        R.emit(s, 'unlock', { piece: type });
      }
    }
  };

  /*
   * Planning does not run on a clock. Combat is paused between encounters
   * until the player asks for the next one, so reading the formation and
   * rearranging the network are never charged against a timer.
   */
  R.canStartWave = function (s) {
    if (s.phase !== 'building') return false;
    /* The last step of the walkthrough is starting the wave itself. */
    var step = R.tutorialStep(s);
    return step === null || step === 'start';
  };

  R.startWave = function (s) {
    if (!R.canStartWave(s)) return;
    /* Combat begins, so the walkthrough is done with, for good. */
    if (s.ui.tutorial) R.endTutorial(s);
    s.wave++;
    /*
     * A road is opened by the encounter that first uses it, and the strip has
     * already named it during planning, so nothing ever walks out of a portal
     * the player has not been shown.
     */
    var uses = R.enemies.routesFor(s.wave);
    var needed = uses.length ? uses[uses.length - 1] + 1 : 1;
    if (needed > s.routesOpen) {
      s.routesOpen = Math.min(needed, s.routes.length);
      R.emit(s, 'routeopen', { routes: s.routesOpen });
    }
    s.spawnQueue = R.enemies.buildQueue(s.wave);
    s.spawnCursor = 0;
    s.waveEnemiesTotal = s.spawnQueue.length;
    s.waveTime = 0;
    s.phase = 'wave';
    R.emit(s, 'wavestart', { wave: s.wave, count: s.waveEnemiesTotal });
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
    R.applyUnlocks(s, s.wave + 1);

    /*
     * The run pauses on the choice rather than showing it over live combat,
     * so reading three descriptions is never a race.
     */
    if (!s.endless && R.BALANCE.UPGRADE_AFTER.indexOf(s.wave) >= 0) {
      var offer = R.buildUpgradeOffer(s);
      if (offer) {
        s.upgradeOffer = offer;
        s.phase = 'choosing';
        R.emit(s, 'upgradeoffer', { offer: offer });
      }
    }
  };

  /* ---------- simulation ---------- */

  /*
   * One fixed step, in the order the systems depend on each other:
   * spawning, movement, light and damage, deaths and leaks, then the phase
   * transitions those results imply. Planning has no clock of its own, so a
   * step during planning only advances time and refreshes the beam.
   */
  R.simStep = function (s, dt) {
    s.time += dt;

    if (s.phase === 'wave') {
      s.waveTime += dt;
      R.enemies.spawnStep(s, dt);
    }

    R.enemies.moveStep(s, dt);
    R.beam.solve(s, R.enemies.occupancy(s), dt, s.beam);
    R.enemies.resolveStep(s, dt);

    if (s.coreHp <= 0 && s.phase !== 'lost') {
      s.coreHp = 0;
      R.endRun(s, false);
      return;
    }

    /* A boss arrival is fatal on its own, whatever is left of the core. */
    if (s.bossBreached && s.phase !== 'lost') {
      R.endRun(s, false);
      return;
    }

    if (s.phase === 'wave' && R.enemies.waveComplete(s)) R.finishWave(s);
  };

  /* ---------- main loop ---------- */

  /*
   * Turn a variable frame time into whole fixed steps. Keeping this separate
   * from the frame callback means the pacing can be driven with any refresh
   * rate in a test and behave exactly as it does in the browser.
   */
  R.advance = function (s, dtReal) {
    if (!R.isSimulating(s)) {
      accumulator = 0;
      return 0;
    }
    accumulator += dtReal;
    var steps = 0;
    while (accumulator >= T.FIXED_STEP && steps < T.MAX_STEPS_PER_FRAME) {
      for (var k = 0; k < s.speed; k++) R.simStep(s, T.FIXED_STEP);
      accumulator -= T.FIXED_STEP;
      steps++;
    }
    if (accumulator > T.FIXED_STEP * T.MAX_STEPS_PER_FRAME) accumulator = 0;
    return steps;
  };

  function frame(now) {
    global.requestAnimationFrame(frame);
    var s = R.state;
    if (!s) return;

    var dtReal = (now - lastFrame) / 1000;
    lastFrame = now;
    if (!(dtReal > 0)) dtReal = 0;
    if (dtReal > T.MAX_FRAME_DT) dtReal = T.MAX_FRAME_DT;

    /* A boss death freezes everything for a beat. */
    if (R.render.hitStop > 0) {
      R.render.hitStop -= dtReal;
      dtReal = 0;
    }

    R.advance(s, dtReal);

    R.render.handleEvents(s);
    R.audio.handleEvents(s);
    R.audio.frame(s);
    R.ui.frame(s, dtReal);
    R.render.draw(s, dtReal);
    s.events.length = 0;
  }

  R.isSimulating = function (s) {
    return s.phase === 'building' || s.phase === 'wave';
  };

  R.isChoosing = function (s) {
    return !!s && s.phase === 'choosing';
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
    R.audio.init();

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
