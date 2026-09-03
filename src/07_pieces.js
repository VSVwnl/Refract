/*
 * Pieces: buying, placing, flipping and the gold rules around them. All of it
 * is plain state manipulation; feedback is pushed onto state.events for the
 * renderer, the HUD and the audio system to pick up.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});
  var B = R.BALANCE;

  R.pieces = {};

  R.pieces.cost = function (s, type) {
    if (type === 'lamp') return B.PIECE_COST.lamp + B.LAMP_COST_STEP * s.lampsPlaced;
    return B.PIECE_COST[type] || 0;
  };

  R.pieces.isUnlocked = function (s, type) {
    return !!s.unlocked[type];
  };

  /*
   * Why a placement would be refused, or null when it is allowed.
   * 'locked' | 'gold' | 'occupied' | 'terrain'
   */
  R.pieces.placementProblem = function (s, type, c, r) {
    if (!R.pieces.isUnlocked(s, type)) return 'locked';
    if (!R.grid.inBounds(c, r)) return 'terrain';
    var i = R.grid.idx(c, r);
    if (s.grid.kind[i] !== R.EMPTY) return 'terrain';
    if (s.pieces.has(i)) return 'occupied';
    if (s.gold < R.pieces.cost(s, type)) return 'gold';
    return null;
  };

  R.pieces.at = function (s, c, r) {
    if (!R.grid.inBounds(c, r)) return null;
    return s.pieces.get(R.grid.idx(c, r)) || null;
  };

  R.pieces.byId = function (s, id) {
    var it = s.pieces.values();
    var e = it.next();
    while (!e.done) {
      if (e.value.id === id) return e.value;
      e = it.next();
    }
    return null;
  };

  /*
   * Place a piece and pay for it. `orient` may be omitted, in which case the
   * orientation that puts the most light on the road is chosen.
   */
  R.pieces.place = function (s, type, c, r, orient) {
    var problem = R.pieces.placementProblem(s, type, c, r);
    if (problem) {
      R.emit(s, 'denied', { reason: problem, c: c, r: r, type: type, cost: R.pieces.cost(s, type) });
      return null;
    }

    var cost = R.pieces.cost(s, type);
    var chosen = orient;
    if (chosen === undefined || chosen === null) chosen = R.beam.bestOrientation(s, type, c, r);

    var piece = {
      id: s.nextPieceId++,
      type: type,
      c: c,
      r: r,
      i: R.grid.idx(c, r),
      orient: type === 'lamp' ? 0 : (chosen % 2),
      dir: type === 'lamp' ? (chosen % 4) : R.N,
      cost: cost,
      placedAt: s.time,
      inactiveUntil: -1
    };

    s.gold -= cost;
    s.pieces.set(piece.i, piece);
    if (type === 'lamp') s.lampsPlaced++;
    s.ui.undo = { pieceId: piece.id, until: s.time + B.UNDO_WINDOW, refund: cost };

    R.beam.recompute(s);
    R.emit(s, 'place', { id: piece.id, type: type, c: c, r: r, cost: cost });
    return piece;
  };

  /* Mirrors and splitters toggle diagonal; lamps turn a quarter clockwise. */
  R.pieces.flip = function (s, c, r) {
    var p = R.pieces.at(s, c, r);
    if (!p) return false;
    if (p.type === 'reflector') {
      R.emit(s, 'denied', { reason: 'noflip', c: c, r: r });
      return false;
    }
    if (p.type === 'lamp') p.dir = (p.dir + 1) % 4;
    else p.orient = p.orient ? 0 : 1;
    R.beam.recompute(s);
    R.emit(s, 'flip', { id: p.id, type: p.type, c: c, r: r });
    return true;
  };

  /* ---------- selection ---------- */

  R.pieces.selected = function (s) {
    if (s.ui.selectedPieceId === null) return null;
    return R.pieces.byId(s, s.ui.selectedPieceId);
  };

  R.pieces.select = function (s, piece) {
    s.ui.selectedPieceId = piece ? piece.id : null;
    s.ui.moveMode = false;
    R.emit(s, 'select', { id: s.ui.selectedPieceId });
  };

  R.pieces.deselect = function (s) {
    if (s.ui.selectedPieceId === null && !s.ui.moveMode) return;
    s.ui.selectedPieceId = null;
    s.ui.moveMode = false;
    R.emit(s, 'select', { id: null });
  };

  /* ---------- undo ---------- */

  R.pieces.undoLive = function (s) {
    var u = s.ui.undo;
    if (!u) return null;
    if (s.time > u.until) return null;
    return R.pieces.byId(s, u.pieceId) ? u : null;
  };

  R.pieces.undo = function (s) {
    var u = R.pieces.undoLive(s);
    if (!u) return false;
    var p = R.pieces.byId(s, u.pieceId);
    removePiece(s, p, u.refund);
    R.emit(s, 'undo', { refund: u.refund, c: p.c, r: p.r });
    return true;
  };

  /* ---------- selling ---------- */

  function removePiece(s, p, refund) {
    s.gold += refund;
    s.pieces.delete(p.i);
    if (p.type === 'lamp' && s.lampsPlaced > 0) s.lampsPlaced--;
    if (s.ui.selectedPieceId === p.id) {
      s.ui.selectedPieceId = null;
      s.ui.moveMode = false;
    }
    if (s.ui.undo && s.ui.undo.pieceId === p.id) s.ui.undo = null;
    R.beam.recompute(s);
  }

  /* Full price back inside the undo window, otherwise the sell rate. */
  R.pieces.refundFor = function (s, p) {
    var u = s.ui.undo;
    if (u && u.pieceId === p.id && s.time <= u.until) return p.cost;
    return Math.floor(p.cost * B.SELL_RATE);
  };

  R.pieces.sell = function (s, c, r) {
    var p = R.pieces.at(s, c, r);
    if (!p) return false;
    var refund = R.pieces.refundFor(s, p);
    removePiece(s, p, refund);
    R.emit(s, 'sell', { refund: refund, c: c, r: r, type: p.type });
    return true;
  };

  /* ---------- moving ---------- */

  R.pieces.move = function (s, fromC, fromR, toC, toR) {
    var p = R.pieces.at(s, fromC, fromR);
    if (!p) return false;
    if (fromC === toC && fromR === toR) {
      s.ui.moveMode = false;
      return true;
    }
    if (!R.grid.isBuildable(s, toC, toR)) {
      R.emit(s, 'denied', { reason: 'terrain', c: toC, r: toR, type: p.type });
      return false;
    }
    s.pieces.delete(p.i);
    p.c = toC;
    p.r = toR;
    p.i = R.grid.idx(toC, toR);
    /* A moved piece is transparent to light while it re-forms. */
    p.inactiveUntil = s.time + B.MOVE_REFORM;
    s.pieces.set(p.i, p);
    s.ui.moveMode = false;
    R.beam.recompute(s);
    R.emit(s, 'move', { id: p.id, type: p.type, c: toC, r: toR });
    return true;
  };

  /* ---------- the core ---------- */

  R.pieces.coreMaxLevel = function () {
    return B.CORE_POWER.length;
  };

  R.pieces.coreUpgradeCost = function (s) {
    if (s.coreLevel >= B.CORE_POWER.length) return null;
    return B.CORE_UPGRADE_COST[s.coreLevel - 1];
  };

  R.pieces.upgradeCore = function (s) {
    var cost = R.pieces.coreUpgradeCost(s);
    if (cost === null) return false;
    if (s.gold < cost) {
      R.emit(s, 'denied', { reason: 'gold', cost: cost, core: true });
      return false;
    }
    s.gold -= cost;
    s.coreLevel++;
    R.beam.recompute(s);
    R.emit(s, 'upgrade', { level: s.coreLevel, cost: cost });
    return true;
  };

})(typeof window !== 'undefined' ? window : globalThis);
