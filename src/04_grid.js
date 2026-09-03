/*
 * Grid maths: cell indexing, stepping in a direction, the mirror reflection
 * table, and the mapping between board cells and world coordinates.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});
  var B = R.BALANCE;

  R.grid = {};

  R.grid.idx = function (c, r) {
    return r * B.COLS + c;
  };

  R.grid.colOf = function (i) {
    return i % B.COLS;
  };

  R.grid.rowOf = function (i) {
    return Math.floor(i / B.COLS);
  };

  R.grid.inBounds = function (c, r) {
    return c >= 0 && c < B.COLS && r >= 0 && r < B.ROWS;
  };

  R.grid.DC = [0, 1, 0, -1];
  R.grid.DR = [-1, 0, 1, 0];

  R.grid.stepC = function (c, dir) {
    return c + R.grid.DC[dir];
  };

  R.grid.stepR = function (r, dir) {
    return r + R.grid.DR[dir];
  };

  R.grid.opposite = function (dir) {
    return (dir + 2) % 4;
  };

  /*
   * Reflection off a 45 degree mirror in screen space with row 0 at the top.
   * Orientation 0 is "/" (bottom-left to top-right), orientation 1 is "\".
   */
  R.grid.REFLECT = [
    /* orient 0 "/" : N->E, E->N, S->W, W->S */
    [R.E, R.N, R.W, R.S],
    /* orient 1 "\" : N->W, E->S, S->E, W->N */
    [R.W, R.S, R.E, R.N]
  ];

  R.grid.reflect = function (dir, orient) {
    return R.grid.REFLECT[orient][dir];
  };

  /* World coordinates: x runs left to right, z runs top to bottom. */
  R.grid.worldX = function (c) {
    return c - (B.COLS - 1) / 2;
  };

  R.grid.worldZ = function (r) {
    return r - (B.ROWS - 1) / 2;
  };

  R.grid.colFromWorldX = function (x) {
    return Math.round(x + (B.COLS - 1) / 2);
  };

  R.grid.rowFromWorldZ = function (z) {
    return Math.round(z + (B.ROWS - 1) / 2);
  };

  /* True when a piece may be placed on this cell of the given grid. */
  R.grid.isBuildable = function (state, c, r) {
    if (!R.grid.inBounds(c, r)) return false;
    var i = R.grid.idx(c, r);
    if (state.grid.kind[i] !== R.EMPTY) return false;
    return !state.pieces.has(i);
  };

  /* Road cells for the LIT counter: every path cell except the core. */
  R.grid.isRoad = function (state, i) {
    var k = state.grid.kind[i];
    return k === R.ROAD || k === R.SPAWN;
  };
})(typeof window !== 'undefined' ? window : globalThis);
