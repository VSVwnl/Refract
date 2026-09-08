'use strict';
/*
 * test-beam.js - Node unit tests for the pure parts of the game: grid maths,
 * the reflection table and the beam solver. These files touch no DOM, so they
 * can be loaded straight into a Node context.
 *
 * Usage: node tools/test-beam.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.resolve(__dirname, '..', 'src');
const HEADLESS_FILES = ['00_config.js', '01_util.js', '03_state.js', '04_grid.js', '05_beam.js', '06_enemies.js', '07_pieces.js'];

HEADLESS_FILES.forEach(function (f) {
  const p = path.join(SRC, f);
  if (!fs.existsSync(p)) return;
  vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: f });
});

const R = globalThis.R;

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push(name + ': ' + err.message);
  }
}

function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error((what || 'value') + ' expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function near(actual, expected, tol, what) {
  if (Math.abs(actual - expected) > (tol === undefined ? 1e-6 : tol)) {
    throw new Error((what || 'value') + ' expected ~' + expected + ', got ' + actual);
  }
}

function ok(cond, what) {
  if (!cond) throw new Error(what || 'expected truthy');
}

module.exports = { test: test, eq: eq, near: near, ok: ok };

/* ---------- grid and map ---------- */

test('the board has two roads that share one body and one core', function () {
  const s = R.resetState(1);
  eq(s.roadCells, 32, 'road cells');
  eq(s.routes.length, 2, 'two roads');
  eq(s.routes[0].path.length, 32, 'the north road');
  eq(s.routes[1].path.length, 26, 'the west road, which skips the first sweep');
  eq(s.grid.kind[R.grid.idx(7, 11)], R.CORE, 'core kind');
  s.routes.forEach(function (rt) {
    eq(s.grid.kind[R.grid.idx(rt.spawn[0], rt.spawn[1])], R.SPAWN, rt.name + ' spawn kind');
    const last = rt.path[rt.path.length - 1];
    eq(last.c + ',' + last.r, '7,11', rt.name + ' ends at the core');
  });
  /* The two roads join once and never separate again. */
  const north = s.routes[0].path.map(function (p) { return p.c + ',' + p.r; });
  const west = s.routes[1].path.map(function (p) { return p.c + ',' + p.r; });
  const join = west.findIndex(function (k) { return north.indexOf(k) >= 0; });
  ok(join > 0, 'the west road runs alone before it joins');
  eq(west.slice(join).join(' '), north.slice(north.indexOf(west[join])).join(' '),
    'and follows the same body from the junction on');
});

test('every road steps to an orthogonal neighbour', function () {
  const s = R.resetState(1);
  s.routes.forEach(function (rt) {
    for (let i = 1; i < rt.path.length; i++) {
      const d = Math.abs(rt.path[i].c - rt.path[i - 1].c) + Math.abs(rt.path[i].r - rt.path[i - 1].r);
      eq(d, 1, rt.name + ' step ' + i);
    }
  });
});

test('reflection table matches the eight documented cases', function () {
  eq(R.grid.reflect(R.N, 0), R.E, 'N off /');
  eq(R.grid.reflect(R.E, 0), R.N, 'E off /');
  eq(R.grid.reflect(R.S, 0), R.W, 'S off /');
  eq(R.grid.reflect(R.W, 0), R.S, 'W off /');
  eq(R.grid.reflect(R.N, 1), R.W, 'N off \\');
  eq(R.grid.reflect(R.E, 1), R.S, 'E off \\');
  eq(R.grid.reflect(R.S, 1), R.E, 'S off \\');
  eq(R.grid.reflect(R.W, 1), R.N, 'W off \\');
});

test('opposite direction is symmetric', function () {
  for (let d = 0; d < 4; d++) eq(R.grid.opposite(R.grid.opposite(d)), d, 'dir ' + d);
});

test('world mapping round trips', function () {
  for (let c = 0; c < 8; c++) eq(R.grid.colFromWorldX(R.grid.worldX(c)), c, 'col ' + c);
  for (let r = 0; r < 12; r++) eq(R.grid.rowFromWorldZ(R.grid.worldZ(r)), r, 'row ' + r);
});

test('rng is deterministic for a seed', function () {
  const a = R.util.makeRng(1234);
  const b = R.util.makeRng(1234);
  for (let i = 0; i < 5; i++) eq(a(), b(), 'draw ' + i);
});

/* ---------- beam solver (added in Phase 1) ---------- */

if (R.beam && typeof R.beam.solve === 'function') {
  require('./test-beam-solver.js');
}

/* ---------- report ---------- */

if (failures.length) {
  console.error('FAIL ' + failures.length + ' of ' + (passed + failures.length) + ' tests');
  failures.forEach(function (f) { console.error('  - ' + f); });
  process.exit(1);
}
console.log('PASS ' + passed + ' tests');
