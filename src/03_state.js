/*
 * Run state: one plain object rebuilt from scratch on every restart, plus the
 * cross-run preferences (best score, mute) that are stored separately.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});
  var B = R.BALANCE;

  /* Values that survive a restart. */
  R.meta = { best: 0, muted: false };

  R.loadMeta = function () {
    var best = parseInt(R.util.storeGet(R.STORAGE.BEST), 10);
    R.meta.best = isFinite(best) && best > 0 ? best : 0;
    R.meta.muted = R.util.storeGet(R.STORAGE.MUTED) === '1';
  };

  R.saveBest = function (score) {
    if (score > R.meta.best) {
      R.meta.best = score;
      R.util.storeSet(R.STORAGE.BEST, String(score));
      return true;
    }
    return false;
  };

  /* Builds the cell-kind array and the ordered path for the fixed map. */
  R.buildBoard = function () {
    var cells = B.COLS * B.ROWS;
    var kind = new Uint8Array(cells);
    var path = [];
    var i;
    for (i = 0; i < R.MAP.path.length; i++) {
      var c = R.MAP.path[i][0];
      var r = R.MAP.path[i][1];
      path.push({ c: c, r: r, i: r * B.COLS + c });
      kind[r * B.COLS + c] = R.ROAD;
    }
    kind[R.MAP.spawn[1] * B.COLS + R.MAP.spawn[0]] = R.SPAWN;
    kind[R.MAP.core[1] * B.COLS + R.MAP.core[0]] = R.CORE;
    return { kind: kind, path: path };
  };

  /* Number of road cells the LIT counter is measured against. */
  R.roadCellCount = function (kind) {
    var n = 0;
    for (var i = 0; i < kind.length; i++) {
      if (kind[i] === R.ROAD || kind[i] === R.SPAWN) n++;
    }
    return n;
  };

  R.resetState = function (seed) {
    var board = R.buildBoard();
    var cells = B.COLS * B.ROWS;
    var s = {
      phase: 'title',
      pausedFrom: null,
      endless: false,
      wave: 0,
      countdown: B.FIRST_COUNTDOWN,
      waveTime: 0,
      time: 0,
      speed: 1,
      gold: B.START_GOLD,
      goldEarned: 0,
      coreHp: B.CORE_HP,
      coreLevel: 1,
      score: 0,
      wavesCleared: 0,
      grid: { cols: B.COLS, rows: B.ROWS, kind: board.kind },
      roadCells: R.roadCellCount(board.kind),
      path: board.path,
      pieces: new Map(),
      nextPieceId: 1,
      routeVersion: 0,
      lampsPlaced: 0,
      enemies: [],
      nextEnemyId: 1,
      spawnQueue: [],
      spawnCursor: 0,
      waveEnemiesTotal: 0,
      waveEnemiesLeft: 0,
      /* The beam result object owns its own pooled segment records. */
      beam: R.beam.makeResult(),
      leaksBy: { mote: 0, runner: 0, swarmling: 0, brute: 0, bruteking: 0, umbra: 0 },
      damageBy: { mote: 0, runner: 0, swarmling: 0, brute: 0, bruteking: 0, umbra: 0 },
      ui: {
        selectedType: 'mirror',
        selectedPieceId: null,
        moveMode: false,
        drag: null,
        hintsShown: {},
        helpOpen: false,
        undo: null,
        lastResult: null
      },
      unlocked: { mirror: true, splitter: false, reflector: false, lamp: false },
      rngSeed: seed >>> 0,
      events: []
    };
    s.rng = R.util.makeRng(s.rngSeed);
    return s;
  };

  /* Score is recomputed whenever it is displayed so it is always consistent. */
  R.computeScore = function (s) {
    return Math.round(s.goldEarned + 50 * s.wavesCleared + 10 * Math.max(0, s.coreHp));
  };

  /*
   * Feedback events are drained by the renderer, the HUD and the audio system.
   * `type` names the event, so payloads use `enemy` and `piece` for the kind of
   * thing involved and never carry a `type` key of their own.
   */
  R.emit = function (s, type, data) {
    if (s.events.length < 256) {
      var e = data || {};
      e.type = type;
      s.events.push(e);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
