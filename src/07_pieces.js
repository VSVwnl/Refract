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
    if (type === 'lamp') return B.PIECE_COST.lamp + B.LAMP_COST_STEP * s.lampsBought;
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
    if (type === 'lamp') s.lampsBought++;
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
})(typeof window !== 'undefined' ? window : globalThis);
