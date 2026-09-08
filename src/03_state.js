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

  /*
   * Builds the cell-kind array and one ordered path per road. Roads may share
   * cells; a cell is road if any road uses it, and the core wins over both.
   */
  R.buildBoard = function () {
    var cells = B.COLS * B.ROWS;
    var kind = new Uint8Array(cells);
    var routes = [];

    for (var n = 0; n < R.MAP.mouths.length; n++) {
      var def = R.MAP.mouths[n];
      var cells = def.lead.concat(R.MAP.trunk.slice(def.join || 0));
      var path = [];
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i][0];
        var r = cells[i][1];
        path.push({ c: c, r: r, i: r * B.COLS + c });
        kind[r * B.COLS + c] = R.ROAD;
      }
      routes.push({ name: def.name, spawn: def.spawn.slice(), path: path });
    }

    for (n = 0; n < routes.length; n++) {
      var sp = routes[n].spawn;
      kind[sp[1] * B.COLS + sp[0]] = R.SPAWN;
    }
    kind[R.MAP.core[1] * B.COLS + R.MAP.core[0]] = R.CORE;
    return { kind: kind, routes: routes };
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
      waveTime: 0,
      time: 0,
      speed: 1,
      gold: B.START_GOLD,
      goldEarned: 0,
      coreHp: B.CORE_HP,
      coreLevel: 1,
      /* Enemy type of a boss that reached the core; ends the run when set. */
      bossBreached: null,
      /* Run upgrades taken, in order, and the offer currently on screen. */
      upgrades: [],
      upgradeOffer: null,
      score: 0,
      wavesCleared: 0,
      grid: { cols: B.COLS, rows: B.ROWS, kind: board.kind },
      roadCells: R.roadCellCount(board.kind),
      routes: board.routes,
      /* The road the player has been shown so far; the rest stay dark. */
      routesOpen: 1,
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
      leaksBy: { mote: 0, runner: 0, swarmling: 0, bulwark: 0, bruteking: 0, umbra: 0 },
      damageBy: { mote: 0, runner: 0, swarmling: 0, bulwark: 0, bruteking: 0, umbra: 0 },
      ui: {
        selectedType: 'mirror',
        selectedPieceId: null,
        moveMode: false,
        drag: null,
        hintsShown: {},
        helpOpen: false,
        /* The tile the opening points at, until the first piece is placed. */
        suggest: null,
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

  /* ---------- run upgrades ---------- */

  /*
   * Upgrades taken during a run. The lookups live here rather than with the
   * run lifecycle because the solver and the enemy rules read them on every
   * step, including in the headless tests.
   */
  R.hasUpgrade = function (s, key) {
    return !!s && s.upgrades.indexOf(key) >= 0;
  };

  /*
   * The value an upgrade contributes to one tuning field, or `dflt` when it
   * has not been taken. Callers multiply or add as suits the field, so an
   * upgrade that is absent is always the identity.
   */
  R.upgradeValue = function (s, key, field, dflt) {
    if (!R.hasUpgrade(s, key)) return dflt;
    var def = B.UPGRADES[key];
    return def && def[field] !== undefined ? def[field] : dflt;
  };

  /* Everything not already taken and not excluded by something taken. */
  R.eligibleUpgrades = function (s) {
    var table = B.UPGRADES;
    var out = [];
    for (var key in table) {
      if (R.hasUpgrade(s, key)) continue;
      var excl = table[key].excludes;
      if (excl && R.hasUpgrade(s, excl)) continue;
      out.push(key);
    }
    return out;
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
