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
      /*
       * The temporary cut, when one is open: which of R.MAP.cuts it is, the
       * route index the bodies using it walk, and how many more encounters it
       * lasts. Null the rest of the time.
       */
      cut: null,
      /* How many cuts this run has opened, so they come round in order. */
      cutsOpened: 0,
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

  /* ---------- temporary cuts through the road ---------- */

  /*
   * A cut is an extra road that leaves the north gate, skips a stretch of the
   * middle, and rejoins. It exists only in endless, and only between waves:
   * it is chosen and drawn during planning, holds still for the whole of the
   * encounter that follows, and is taken away again afterwards. Nothing about
   * the road ever changes while bodies are walking on it.
   *
   * A cut is only ever chosen when every cell it needs is empty, so a piece
   * that has been paid for is never displaced or destroyed by one.
   */
  function cutCellsFree(s, def) {
    for (var i = 0; i < def.cells.length; i++) {
      var idx = R.grid.idx(def.cells[i][0], def.cells[i][1]);
      if (s.grid.kind[idx] !== R.EMPTY) return false;
      if (s.pieces.has(idx)) return false;
    }
    return true;
  }

  /* The road a cut walks: the north gate, the trunk to the cut, then on. */
  function cutPath(s, def) {
    var mouth = R.MAP.mouths[0];
    var cells = mouth.lead
      .concat(R.MAP.trunk.slice(mouth.join, def.from + 1))
      .concat(def.cells)
      .concat(R.MAP.trunk.slice(def.to));
    var path = [];
    for (var i = 0; i < cells.length; i++) {
      path.push({ c: cells[i][0], r: cells[i][1], i: R.grid.idx(cells[i][0], cells[i][1]) });
    }
    return path;
  }

  R.cutsAvailable = function (s) {
    if (!s.endless || !R.MAP.cuts) return [];
    var out = [];
    for (var i = 0; i < R.MAP.cuts.length; i++) {
      if (cutCellsFree(s, R.MAP.cuts[i])) out.push(i);
    }
    return out;
  };

  R.openCut = function (s, index) {
    var def = R.MAP.cuts[index];
    if (!cutCellsFree(s, def)) return null;

    for (var i = 0; i < def.cells.length; i++) {
      s.grid.kind[R.grid.idx(def.cells[i][0], def.cells[i][1])] = R.ROAD;
    }
    var route = s.routes.length;
    s.routes.push({ name: def.name, spawn: R.MAP.mouths[0].spawn.slice(), path: cutPath(s, def), cut: true });
    s.routesOpen = s.routes.length;
    s.roadCells = R.roadCellCount(s.grid.kind);
    s.cutsOpened++;
    s.cut = {
      index: index,
      name: def.name,
      route: route,
      wavesLeft: B.ENDLESS.CUT_WAVES,
      skips: def.to - def.from - def.cells.length
    };
    R.beam.recompute(s);
    R.emit(s, 'cutopen', { name: def.name, waves: s.cut.wavesLeft, skips: s.cut.skips });
    return s.cut;
  };

  R.closeCut = function (s) {
    if (!s.cut) return;
    var def = R.MAP.cuts[s.cut.index];
    for (var i = 0; i < def.cells.length; i++) {
      s.grid.kind[R.grid.idx(def.cells[i][0], def.cells[i][1])] = R.EMPTY;
    }
    /* The cut is always the last road, so dropping it cannot renumber others. */
    s.routes.length = s.cut.route;
    s.routesOpen = Math.min(s.routesOpen, s.routes.length);
    s.roadCells = R.roadCellCount(s.grid.kind);
    var name = s.cut.name;
    s.cut = null;
    R.beam.recompute(s);
    R.emit(s, 'cutclose', { name: name });
  };

  /*
   * Between encounters: retire a cut that has run out, then consider opening
   * one. Both happen in planning, so the board the player is looking at is the
   * board the next encounter uses.
   */
  R.refreshCut = function (s) {
    if (!s.endless) return;
    var E = B.ENDLESS;

    if (s.cut) {
      s.cut.wavesLeft--;
      if (s.cut.wavesLeft <= 0) R.closeCut(s);
    }
    if (s.cut) return;

    var next = s.wave + 1;
    if (next < E.CUT_FROM_WAVE) return;
    if ((next - E.CUT_FROM_WAVE) % E.CUT_EVERY !== 0) return;

    /*
     * Cuts come round in a fixed order rather than at random, so a player can
     * learn them, and so the game is never reacting to where they happened to
     * build. Which one bypasses your network depends on where you built it.
     */
    var options = R.cutsAvailable(s);
    if (!options.length) return;
    R.openCut(s, options[s.cutsOpened % options.length]);
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
