'use strict';
/*
 * Unit tests for the beam solver, loaded by tools/test-beam.js once
 * src/05_beam.js exists.
 */

const { test, eq, near, ok } = require('./test-beam.js');
const R = globalThis.R;
const B = R.BALANCE;

function fresh() {
  const s = R.resetState(7);
  s.gold = 100000;
  s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
  R.beam.recompute(s);
  return s;
}

function put(s, type, c, r, orient) {
  const p = R.pieces.place(s, type, c, r, orient);
  if (!p) throw new Error('could not place ' + type + ' at ' + c + ',' + r);
  return p;
}

function litRoad(s) {
  return s.beam.litRoadCount;
}

function litAt(s, c, r) {
  return s.beam.lit[R.grid.idx(c, r)];
}

/* A stand-in enemy for occupancy tests. */
function foe(c, r, absorb, frac) {
  return {
    id: 1,
    absorb: absorb,
    damage: 0,
    hitAt: -1,
    x: R.grid.worldX(c) + (frac || 0),
    z: R.grid.worldZ(r) + (frac || 0)
  };
}

function occupancyOf(pairs) {
  const occ = new Array(B.COLS * B.ROWS).fill(null);
  pairs.forEach(function (p) {
    const i = R.grid.idx(p.c, p.r);
    if (!occ[i]) occ[i] = [];
    occ[i].push(p.e);
  });
  return occ;
}

/* ---------- the default beam ---------- */

test('the untouched core beam lights exactly one road cell', function () {
  const s = fresh();
  eq(litRoad(s), 1, 'lit road cells');
  near(litAt(s, 7, 10), 10, 1e-9, 'power at the corner cell');
  eq(s.beam.segCount, 1, 'segments');
  const seg = s.beam.segments[0];
  eq(seg.dir, R.N, 'segment direction');
  eq(seg.c1, 7, 'segment ends in column 7');
  eq(seg.r1, 0, 'segment ends at row 0');
});

/* ---------- mirrors ---------- */

test('a mirror at (7,4) lights the whole of row 4 plus the corner', function () {
  const s = fresh();
  const p = put(s, 'mirror', 7, 4);
  eq(p.orient, 1, 'smart orientation picks the backslash');
  eq(litRoad(s), 7, 'lit road cells');
  for (let c = 1; c <= 6; c++) near(litAt(s, c, 4), 10, 1e-9, 'row 4 power at c' + c);
  near(litAt(s, 7, 10), 10, 1e-9, 'corner still lit');
});

test('flipping that mirror sends the beam off the board', function () {
  const s = fresh();
  put(s, 'mirror', 7, 4);
  R.pieces.flip(s, 7, 4);
  eq(R.pieces.at(s, 7, 4).orient, 0, 'orientation toggled');
  eq(litRoad(s), 1, 'only the corner stays lit');
});

test('every sweep is one mirror away from the trunk', function () {
  [[4, 7], [6, 7], [8, 7], [2, 6]].forEach(function (pair) {
    const s = fresh();
    const p = put(s, 'mirror', 7, pair[0]);
    eq(p.orient, 1, 'smart orientation at row ' + pair[0]);
    eq(litRoad(s), pair[1], 'row ' + pair[0] + ' lit road cells');
  });
});

test('a three-mirror chain carries the beam to a second sweep', function () {
  const s = fresh();
  put(s, 'mirror', 7, 8, 1);
  put(s, 'mirror', 0, 8, 1);
  put(s, 'mirror', 0, 6, 0);
  eq(litRoad(s), 13, 'lit road cells');
  near(litAt(s, 3, 6), 10, 1e-9, 'no loss along a mirror chain');
});

test('placing costs gold and is refused when it is short', function () {
  const s = fresh();
  s.gold = 45;
  put(s, 'mirror', 3, 5);
  eq(s.gold, 25, 'gold after one mirror');
  put(s, 'mirror', 4, 5);
  eq(s.gold, 5, 'gold after two mirrors');
  eq(R.pieces.place(s, 'mirror', 5, 5), null, 'third mirror refused');
  eq(s.gold, 5, 'gold unchanged');
  eq(s.pieces.size, 2, 'piece count');
});

test('pieces cannot be placed on road, core or an occupied cell', function () {
  const s = fresh();
  eq(R.pieces.placementProblem(s, 'mirror', 3, 4), 'terrain', 'road cell');
  eq(R.pieces.placementProblem(s, 'mirror', 7, 11), 'terrain', 'core cell');
  eq(R.pieces.placementProblem(s, 'mirror', 5, 0), 'terrain', 'spawn cell');
  put(s, 'mirror', 3, 5);
  eq(R.pieces.placementProblem(s, 'mirror', 3, 5), 'occupied', 'occupied cell');
});

/* ---------- loops ---------- */

test('a mirror ring that leads back to its first mirror terminates', function () {
  const s = fresh();
  put(s, 'mirror', 7, 9, 1);
  put(s, 'mirror', 0, 9, 1);
  put(s, 'mirror', 0, 1, 0);
  put(s, 'mirror', 7, 1, 1);
  ok(s.beam.segCount < B.MAX_SEGMENTS, 'segment count stayed under the cap');
  ok(!s.beam.overflow, 'no overflow');
  const seen = {};
  for (let i = 0; i < s.beam.segCount; i++) {
    const sg = s.beam.segments[i];
    const key = sg.c0 + ',' + sg.r0 + ',' + sg.dir;
    ok(!seen[key], 'no repeated segment ' + key);
    seen[key] = true;
  }
});

/* ---------- splitter ---------- */

test('a splitter makes two branches at 55 percent', function () {
  const s = fresh();
  put(s, 'splitter', 7, 6, 1);
  const straight = litAt(s, 7, 5);
  const bent = litAt(s, 5, 6);
  near(straight, 10 * B.SPLIT_FACTOR, 1e-6, 'straight branch power');
  near(bent, 10 * B.SPLIT_FACTOR, 1e-6, 'reflected branch power');
});

/* ---------- reflector ---------- */

test('a reflector returns the beam at 60 percent all the way to the core', function () {
  const s = fresh();
  put(s, 'reflector', 7, 4);
  near(litAt(s, 7, 5), 10, 1e-9, 'forward pass power');
  let returnSeg = null;
  for (let i = 0; i < s.beam.segCount; i++) {
    if (s.beam.segments[i].dir === R.S) returnSeg = s.beam.segments[i];
  }
  ok(returnSeg, 'a southbound return segment exists');
  near(returnSeg.powerStart, 6, 1e-6, 'return power');
  eq(returnSeg.c1, 7, 'return reaches column 7');
  eq(returnSeg.r1, 11, 'return is absorbed by the core');
});

test('two reflectors facing each other produce exactly one return pass', function () {
  const s = fresh();
  put(s, 'reflector', 7, 8);
  put(s, 'reflector', 7, 4);
  ok(!s.beam.overflow, 'no overflow');
  ok(s.beam.segCount <= 4, 'segment count stays tiny: ' + s.beam.segCount);
  let north = 0;
  let south = 0;
  for (let i = 0; i < s.beam.segCount; i++) {
    if (s.beam.segments[i].dir === R.N) north++;
    if (s.beam.segments[i].dir === R.S) south++;
  }
  eq(north, 1, 'northbound passes');
  eq(south, 1, 'southbound passes');
});

/* ---------- lamp ---------- */

test('a lamp is a second source at half core power and rotates', function () {
  const s = fresh();
  const p = put(s, 'lamp', 0, 6, R.E);
  eq(p.dir, R.E, 'lamp facing');
  near(litAt(s, 2, 6), 5, 1e-9, 'lamp power on the road');
  R.pieces.flip(s, 0, 6);
  eq(R.pieces.at(s, 0, 6).dir, R.S, 'rotated a quarter turn');
  eq(litAt(s, 2, 6), 0, 'the old line went dark');
});

test('a lamp absorbs a beam that hits it', function () {
  const s = fresh();
  put(s, 'lamp', 7, 5, R.W);
  eq(litAt(s, 7, 4), 0, 'core beam stops at the lamp');
  near(litAt(s, 6, 5), 5, 1e-9, 'the lamp still emits');
});

/* ---------- core level ---------- */

test('core upgrades raise both the beam and the lamps', function () {
  const s = fresh();
  put(s, 'lamp', 0, 6, R.E);
  s.coreLevel = 6;
  R.beam.recompute(s);
  near(litAt(s, 7, 10), 35, 1e-9, 'core beam at level 6');
  near(litAt(s, 2, 6), 17.5, 1e-9, 'lamp at level 6');
});

/* ---------- enemies and absorption ---------- */

test('enemies absorb power in the order the light meets them', function () {
  const s = fresh();
  put(s, 'mirror', 7, 4, 1);
  const front = foe(2, 4, 0.7, 0);
  const back = foe(5, 4, 0.25, 0);
  const occ = occupancyOf([{ c: 2, r: 4, e: front }, { c: 5, r: 4, e: back }]);
  R.beam.solve(s, occ, 1, s.beam);
  /* The beam runs west, so it meets the cell at column 5 first. */
  near(back.damage, 10, 1e-6, 'first enemy met takes full power');
  near(front.damage, 7.5, 1e-6, 'the second takes what is left');
  near(litAt(s, 1, 4), 10 * 0.75 * 0.3, 1e-6, 'power past both');
});

test('two enemies in one cell are ordered along the beam', function () {
  const s = fresh();
  put(s, 'mirror', 7, 4, 1);
  const nearer = foe(4, 4, 0.5, 0.3);
  const farther = foe(4, 4, 0.5, -0.3);
  const occ = occupancyOf([{ c: 4, r: 4, e: nearer }, { c: 4, r: 4, e: farther }]);
  R.beam.solve(s, occ, 1, s.beam);
  /* Travelling west, the larger x is met first. */
  near(nearer.damage, 10, 1e-6, 'east-most enemy hit first');
  near(farther.damage, 5, 1e-6, 'west-most enemy hit second');
});

test('a beam dies once absorption drops it below the minimum', function () {
  const s = fresh();
  put(s, 'mirror', 7, 4, 1);
  const brute = foe(5, 4, 0.99, 0);
  const occ = occupancyOf([{ c: 5, r: 4, e: brute }]);
  R.beam.solve(s, occ, 1, s.beam);
  eq(litAt(s, 4, 4), 0, 'nothing past the absorber');
  near(brute.damage, 10, 1e-6, 'the absorber still took the hit');
});

test('the render beam is split where an enemy dims it', function () {
  const s = fresh();
  put(s, 'mirror', 7, 4, 1);
  const e = foe(4, 4, 0.5, 0);
  const occ = occupancyOf([{ c: 4, r: 4, e: e }]);
  R.beam.solve(s, occ, 1, s.beam);
  let west = 0;
  for (let i = 0; i < s.beam.segCount; i++) if (s.beam.segments[i].dir === R.W) west++;
  eq(west, 2, 'the westbound run is drawn in two steps');
});

/* ---------- limits ---------- */

test('the segment cap holds with a dense splitter field', function () {
  const s = fresh();
  for (let r = 0; r < 12; r++) {
    for (let c = 0; c < 8; c++) {
      if (s.grid.kind[R.grid.idx(c, r)] === R.EMPTY) R.pieces.place(s, 'splitter', c, r, (c + r) % 2);
    }
  }
  ok(s.beam.segCount <= B.MAX_SEGMENTS, 'segments within the cap: ' + s.beam.segCount);
  ok(s.beam.lit.every(function (v) { return v >= 0 && isFinite(v); }), 'all powers finite');
});

test('a solve is deterministic', function () {
  const a = fresh();
  put(a, 'mirror', 7, 3, 1);
  put(a, 'splitter', 3, 3, 0);
  const b = fresh();
  put(b, 'mirror', 7, 3, 1);
  put(b, 'splitter', 3, 3, 0);
  eq(a.beam.segCount, b.beam.segCount, 'segment counts match');
  for (let i = 0; i < a.beam.lit.length; i++) eq(a.beam.lit[i], b.beam.lit[i], 'lit cell ' + i);
});
