'use strict';
/*
 * map-lab.js - measures how much optical room a candidate road layout gives.
 *
 * Loads the real solver headlessly, swaps in a candidate map, and reports the
 * things that decide whether the board is a light-engineering sandbox or a
 * single puzzle with one answer:
 *
 *   - the straight road runs, their lengths, and whether each end has a
 *     buildable cell in line (an "open end" a mirror can turn the beam into)
 *   - what one mirror can do, and how many distinct good first moves exist
 *   - the best build a greedy engineer reaches at a given budget, per toolset,
 *     so it is visible whether splitters, reflectors and lamps ever earn a slot
 *   - how many substantially different builds reach a good score
 *
 * Development only; never part of the build.
 *
 * Usage:
 *   node tools/map-lab.js              evaluate the shipped map
 *   node tools/map-lab.js <name>       evaluate a candidate from candidates.js
 *   node tools/map-lab.js all          evaluate every candidate
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.resolve(__dirname, '..', 'src');
['00_config.js', '01_util.js', '03_state.js', '04_grid.js', '05_beam.js', '06_enemies.js', '07_pieces.js']
  .forEach(function (f) {
    vm.runInThisContext(fs.readFileSync(path.join(SRC, f), 'utf8'), { filename: f });
  });

const R = globalThis.R;
const B = R.BALANCE;
const COLS = B.COLS;
const ROWS = B.ROWS;

const COST = { mirror: 20, splitter: 45, reflector: 60, lamp: 90 };

/* ---------- map handling ---------- */

function useMap(def) {
  R.MAP = { name: def.name, spawn: def.spawn, core: def.core, path: def.path };
}

function freshState() {
  const s = R.resetState(1);
  s.gold = 1e9;
  s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
  R.beam.recompute(s);
  return s;
}

function ascii(s) {
  const lines = [];
  lines.push('      ' + Array.from({ length: COLS }, (_, c) => 'c' + c).join(' '));
  for (let r = 0; r < ROWS; r++) {
    let row = '';
    for (let c = 0; c < COLS; c++) {
      const k = s.grid.kind[R.grid.idx(c, r)];
      row += (k === R.EMPTY ? '.' : k === R.ROAD ? '#' : k === R.CORE ? 'C' : 'S') + '  ';
    }
    lines.push('r' + String(r).padEnd(3) + '  ' + row.trimEnd());
  }
  return lines.join('\n');
}

/* ---------- structural metrics ---------- */

function isRoad(s, c, r) {
  if (!R.grid.inBounds(c, r)) return false;
  const k = s.grid.kind[R.grid.idx(c, r)];
  return k === R.ROAD || k === R.SPAWN;
}

/* Terrain only: is this an empty tile, ignoring anything standing on it. */
function buildable(s, c, r) {
  return R.grid.inBounds(c, r) && s.grid.kind[R.grid.idx(c, r)] === R.EMPTY;
}

/* Maximal straight lines of road, with whether each end can host a mirror. */
function runs(s) {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      if (!isRoad(s, c, r)) { c++; continue; }
      let end = c;
      while (end + 1 < COLS && isRoad(s, end + 1, r)) end++;
      if (end > c) {
        out.push({
          axis: 'row', line: r, from: c, to: end, len: end - c + 1,
          openStart: buildable(s, c - 1, r), openEnd: buildable(s, end + 1, r)
        });
      }
      c = end + 1;
    }
  }
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      if (!isRoad(s, c, r)) { r++; continue; }
      let end = r;
      while (end + 1 < ROWS && isRoad(s, c, end + 1)) end++;
      if (end > r) {
        out.push({
          axis: 'col', line: c, from: r, to: end, len: end - r + 1,
          openStart: buildable(s, c, r - 1), openEnd: buildable(s, c, end + 1)
        });
      }
      r = end + 1;
    }
  }
  return out.sort(function (a, b) { return b.len - a.len; });
}

/* ---------- beam measurements ---------- */

/*
 * Damage per second delivered to the road, measured the way the game measures
 * it. A probe with zero absorption is parked on every road cell and the solver
 * is run for one second; each probe then holds exactly the damage that cell
 * receives. This counts every pass separately, so a reflector's return trip is
 * visible where a simple "brightest beam per cell" reading would miss it.
 */
const probeScratch = R.beam.makeResult();

function measure(s) {
  const occ = new Array(COLS * ROWS).fill(null);
  const probes = [];
  for (let i = 0; i < occ.length; i++) {
    const k = s.grid.kind[i];
    if (k !== R.ROAD && k !== R.SPAWN) continue;
    const c = R.grid.colOf(i);
    const r = R.grid.rowOf(i);
    const probe = { absorb: 0, damage: 0, hitAt: -1, x: R.grid.worldX(c), z: R.grid.worldZ(r) };
    occ[i] = [probe];
    probes.push(probe);
  }
  R.beam.solve(s, occ, 1, probeScratch);
  let power = 0;
  let lit = 0;
  probes.forEach(function (p) {
    power += p.damage;
    if (p.damage > 0) lit++;
  });
  return { lit: lit, power: Math.round(power * 10) / 10 };
}

function placements(s, types) {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      /* Free right now, so the scan never overwrites a piece already chosen. */
      if (!R.grid.isBuildable(s, c, r)) continue;
      types.forEach(function (t) {
        const n = t === 'lamp' ? 4 : (t === 'reflector' ? 1 : 2);
        for (let o = 0; o < n; o++) out.push({ type: t, c: c, r: r, orient: o });
      });
    }
  }
  return out;
}

function place(s, p) {
  const piece = {
    id: s.nextPieceId++, type: p.type, c: p.c, r: p.r, i: R.grid.idx(p.c, p.r),
    orient: p.type === 'lamp' ? 0 : p.orient,
    dir: p.type === 'lamp' ? p.orient : R.N,
    cost: COST[p.type], placedAt: -1, inactiveUntil: -1
  };
  s.pieces.set(piece.i, piece);
  if (p.type === 'lamp') s.lampsPlaced++;
  return piece;
}

function unplace(s, p) {
  s.pieces.delete(R.grid.idx(p.c, p.r));
  if (p.type === 'lamp') s.lampsPlaced--;
}

/*
 * What a careful engineer builds: repeatedly add the single piece that buys the
 * most extra light on the road per gold, until the budget runs out.
 */
function greedy(def, types, budget, coreLevel, forced) {
  useMap(def);
  const s = freshState();
  s.coreLevel = coreLevel;
  const chosen = [];
  let spent = 0;

  (forced || []).forEach(function (p) {
    place(s, p);
    chosen.push(p);
    spent += COST[p.type];
  });

  for (;;) {
    const base = measure(s);
    let best = null;
    const options = placements(s, types);
    for (let i = 0; i < options.length; i++) {
      const p = options[i];
      if (spent + COST[p.type] > budget) continue;
      place(s, p);
      const m = measure(s);
      unplace(s, p);
      const gain = (m.power - base.power) / COST[p.type];
      if (gain > 1e-6 && (!best || gain > best.gain + 1e-9)) best = { p: p, gain: gain, m: m };
    }
    if (!best) break;
    place(s, best.p);
    chosen.push(best.p);
    spent += COST[best.p.type];
  }

  const final = measure(s);
  return { pieces: chosen, spent: spent, lit: final.lit, power: final.power, roadCells: s.roadCells };
}

function describe(pieces) {
  return pieces.map(function (p) {
    const tag = p.type[0].toUpperCase();
    const facing = p.type === 'lamp' ? R.DIR_NAMES[p.orient] : (p.type === 'reflector' ? '' : (p.orient ? '\\' : '/'));
    return tag + '(' + p.c + ',' + p.r + ')' + facing;
  }).join(' ');
}

/* ---------- the report ---------- */

function evaluate(def, opts) {
  const budget = (opts && opts.budget) || 200;
  const coreLevel = (opts && opts.core) || 6;
  useMap(def);
  const s = freshState();

  console.log('\n================================================================');
  console.log('MAP: ' + def.name);
  console.log('================================================================');
  console.log(ascii(s));

  const rr = runs(s);
  const bothEnds = rr.filter(function (x) { return x.openStart && x.openEnd; });
  console.log('\nroad cells: ' + s.roadCells + '   straight runs: ' + rr.length +
    '   runs open at both ends: ' + bothEnds.length);
  rr.forEach(function (x) {
    console.log('  ' + x.axis + ' ' + x.line + '  ' + x.from + '..' + x.to +
      '  len ' + x.len + '   ends ' + (x.openStart ? 'open' : 'CLOSED') + '/' +
      (x.openEnd ? 'open' : 'CLOSED'));
  });

  const base = measure(s);
  console.log('\ndefault beam lights ' + base.lit + ' road cell(s)');

  /* Every single mirror, ranked. */
  const singles = [];
  placements(s, ['mirror']).forEach(function (p) {
    place(s, p);
    const m = measure(s);
    unplace(s, p);
    if (m.lit > base.lit) singles.push({ p: p, lit: m.lit, power: m.power });
  });
  singles.sort(function (a, b) { return b.power - a.power; });
  const strong = singles.filter(function (x) { return x.lit >= 4; });
  console.log('one mirror: ' + singles.length + ' placements light something, ' +
    strong.length + ' light 4 or more cells');
  singles.slice(0, 6).forEach(function (x) {
    console.log('    ' + describe([x.p]) + '  lit ' + x.lit + '  power ' + x.power);
  });

  /* What each toolset reaches at the same budget. */
  const sets = [
    ['mirrors only', ['mirror']],
    ['+ splitter', ['mirror', 'splitter']],
    ['+ reflector', ['mirror', 'reflector']],
    ['+ lamp', ['mirror', 'lamp']],
    ['all four', ['mirror', 'splitter', 'reflector', 'lamp']]
  ];
  console.log('\ngreedy build, budget ' + budget + ' gold, core level ' + coreLevel + ':');
  const results = {};
  sets.forEach(function (pair) {
    const g = greedy(def, pair[1], budget, coreLevel);
    results[pair[0]] = g;
    console.log('  ' + pair[0].padEnd(13) + ' lit ' + String(g.lit).padStart(2) + '/' + g.roadCells +
      '  power ' + String(Math.round(g.power)).padStart(4) +
      '  spent ' + String(g.spent).padStart(3) +
      '  ' + describe(g.pieces));
  });

  const mirrorPower = results['mirrors only'].power;
  ['+ splitter', '+ reflector', '+ lamp'].forEach(function (k) {
    const delta = Math.round((results[k].power - mirrorPower) / mirrorPower * 100);
    const used = results[k].pieces.some(function (p) { return p.type !== 'mirror'; });
    console.log('  ' + k.padEnd(13) + ' ' + (used ? 'used' : 'NOT USED') +
      '   power vs mirrors only: ' + (delta >= 0 ? '+' : '') + delta + '%');
  });

  /* Diversity: force each strong opening and see where greedy ends up. */
  console.log('\ndistinct lines (greedy after a forced first mirror):');
  const seen = [];
  strong.slice(0, 8).forEach(function (x) {
    const g = greedy(def, ['mirror', 'splitter', 'reflector', 'lamp'], budget, coreLevel, [x.p]);
    const key = describe(g.pieces.slice(0, 4));
    if (seen.some(function (k) { return k.key === key; })) return;
    seen.push({ key: key, g: g, first: x.p });
    console.log('    from ' + describe([x.p]).padEnd(10) +
      ' -> lit ' + String(g.lit).padStart(2) + '  power ' + String(Math.round(g.power)).padStart(4) +
      '  ' + describe(g.pieces));
  });

  const best = Math.max.apply(null, seen.map(function (x) { return x.g.power; }));
  const viable = seen.filter(function (x) { return x.g.power >= best * 0.85; });
  console.log('  distinct openings: ' + seen.length + '   within 15% of the best: ' + viable.length);

  const bestOverall = results['all four'];
  console.log('\nsummary: ' + s.roadCells + ' road cells, best greedy lights ' + bestOverall.lit +
    ' (' + Math.round(bestOverall.lit / s.roadCells * 100) + '% of the road)');
  return { def: def, runs: rr, results: results, singles: singles, viable: viable.length };
}

/* ---------- entry ---------- */

const CANDIDATES = require('./map-candidates.js');
const which = process.argv[2] || 'shipped';
const budget = Number(process.argv[3]) || 200;

if (which === 'all') {
  Object.keys(CANDIDATES).forEach(function (k) { evaluate(CANDIDATES[k], { budget: budget }); });
} else if (CANDIDATES[which]) {
  evaluate(CANDIDATES[which], { budget: budget });
} else {
  console.error('unknown map: ' + which);
  console.error('available: ' + Object.keys(CANDIDATES).join(', '));
  process.exit(1);
}
