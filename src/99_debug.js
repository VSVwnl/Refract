/*
 * Development tools. This file is excluded from the release build; nothing
 * else in the game references it. It is only activated when the page URL
 * contains debug=1.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});

  /* debug=1 installs the automation API; debug=2 also shows the panel. */
  function debugLevel() {
    try {
      var m = /(?:^|[?&])debug=(\d)(?:&|$)/.exec(global.location.search.slice(1));
      return m ? Number(m[1]) : 0;
    } catch (err) {
      return 0;
    }
  }

  var level = debugLevel();
  if (!level) return;

  var panel = null;
  var readout = null;
  var frames = 0;
  var fpsAcc = 0;
  var fps = 0;

  function api() {
    return {
      get state() { return R.state; },

      place: function (type, c, r, orient) {
        var p = R.pieces.place(R.state, type, c, r, orient);
        return p ? p.id : null;
      },

      flip: function (c, r) {
        return R.pieces.flip(R.state, c, r);
      },

      setGold: function (n) {
        R.state.gold = n;
        return n;
      },

      setSpeed: function (n) {
        R.state.speed = n;
        return n;
      },

      restart: function (seed) {
        R.newRun(seed);
        return R.state.rngSeed;
      },

      /* Speed 0 stops the frame loop from stepping, so step() owns the clock. */
      freeze: function (on) {
        R.state.speed = on === false ? 1 : 0;
        return R.state.speed;
      },

      step: function (seconds) {
        var s = R.state;
        var dt = R.TIMING.FIXED_STEP;
        var n = Math.round(seconds / dt);
        for (var i = 0; i < n; i++) {
          R.simStep(s, dt);
          s.events.length = 0;
        }
        return s.time;
      },

      /* Advance until a predicate holds or the budget runs out. */
      stepUntil: function (source, maxSeconds) {
        var s = R.state;
        var dt = R.TIMING.FIXED_STEP;
        var done = new Function('s', 'R', 'return (' + source + ');');
        var n = Math.round((maxSeconds || 120) / dt);
        for (var i = 0; i < n; i++) {
          if (done(s, R)) return s.time;
          R.simStep(s, dt);
          s.events.length = 0;
        }
        return s.time;
      },

      nextWave: function () {
        if (R.state.phase === 'building') R.startWave(R.state);
        return R.state.wave;
      },

      snapshot: function () {
        var s = R.state;
        var pieces = [];
        var it = s.pieces.values();
        var e = it.next();
        while (!e.done) {
          pieces.push({ type: e.value.type, c: e.value.c, r: e.value.r, orient: e.value.orient, dir: e.value.dir });
          e = it.next();
        }
        pieces.sort(function (a, b) { return (a.r * 8 + a.c) - (b.r * 8 + b.c); });
        return {
          phase: s.phase,
          wave: s.wave,
          wavesCleared: s.wavesCleared,
          endless: s.endless,
          countdown: Math.round(s.countdown * 100) / 100,
          time: Math.round(s.time * 100) / 100,
          gold: s.gold,
          goldEarned: s.goldEarned,
          coreHp: s.coreHp,
          coreLevel: s.coreLevel,
          score: R.computeScore(s),
          lit: s.beam.litRoadCount,
          segments: s.beam.segCount,
          totalPower: Math.round(s.beam.totalPower * 100) / 100,
          pieces: pieces,
          enemies: s.enemies.length,
          unlocked: JSON.parse(JSON.stringify(s.unlocked)),
          leaksBy: JSON.parse(JSON.stringify(s.leaksBy)),
          render: R.render.info()
        };
      }
    };
  }

  function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'debugPanel';
    panel.style.cssText = [
      'position:absolute', 'left:2px', 'bottom:2px', 'z-index:40',
      'font:10px/1.35 monospace', 'color:#9fe', 'background:rgba(0,0,0,0.62)',
      'padding:4px 6px', 'border-radius:4px', 'pointer-events:none',
      'white-space:pre'
    ].join(';');
    readout = document.createElement('div');
    panel.appendChild(readout);
    document.getElementById('app').appendChild(panel);
  }

  function update(dtReal) {
    if (!readout) return;
    frames++;
    fpsAcc += dtReal;
    if (fpsAcc >= 0.5) {
      fps = Math.round(frames / fpsAcc);
      frames = 0;
      fpsAcc = 0;
    }
    var s = R.state;
    var info = R.render.info() || { calls: 0 };
    readout.textContent =
      'fps ' + fps + '  t ' + s.time.toFixed(1) + '  ' + s.phase +
      '\nwave ' + s.wave + '  foes ' + s.enemies.length + '  seg ' + s.beam.segCount +
      '\nlit ' + s.beam.litRoadCount + '  calls ' + info.calls + '  seed ' + s.rngSeed;
  }

  R.debug = {
    install: function () {
      global.__REFRACT = api();
      if (level >= 2) buildPanel();
    },
    frame: update
  };
})(typeof window !== 'undefined' ? window : globalThis);
