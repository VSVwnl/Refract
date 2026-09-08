/*
 * The beam solver. A pure trace over the grid: light leaves each source, runs
 * in a straight line until it meets a piece, an enemy or the edge of the board,
 * and loses power to every enemy it passes through. Nothing here touches the
 * DOM or the renderer, so it can be unit tested in isolation.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});
  var B = R.BALANCE;
  var CELLS = B.COLS * B.ROWS;

  R.beam = {};

  /* (cell, direction) pairs already travelled by the current source. */
  var visitStamp = new Int32Array(CELLS * 4);
  var visitGen = 0;

  /* Scratch used to order the enemies in one cell along the beam. */
  var orderScratch = [];

  /* ---------- result objects ---------- */

  function makeSegment() {
    return {
      c0: 0, r0: 0, c1: 0, r1: 0,
      x0: 0, z0: 0, x1: 0, z1: 0,
      dir: 0,
      bendAtStart: false,
      powerStart: 0,
      powerEnd: 0,
      sourceId: 0,
      sourcePower: 0,
      dist0: 0
    };
  }

  R.beam.makeResult = function () {
    var segs = new Array(B.MAX_SEGMENTS);
    for (var i = 0; i < B.MAX_SEGMENTS; i++) segs[i] = makeSegment();
    return {
      segments: segs,
      segCount: 0,
      lit: new Float32Array(CELLS),
      litRoadCount: 0,
      litRoadPower: 0,
      /* Power actually landing on enemies, i.e. damage per second. */
      pressure: 0,
      totalPower: 0,
      overflow: false,
      version: 0
    };
  };

  /* ---------- enemy ordering ---------- */

  /*
   * Enemies in one cell are met in the order the light reaches them, which
   * depends on the direction the beam is travelling.
   */
  function orderAlong(list, dir) {
    var dc = R.grid.DC[dir];
    var dr = R.grid.DR[dir];
    orderScratch.length = 0;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var p = e.x * dc + e.z * dr;
      var j = orderScratch.length;
      while (j > 0 && (orderScratch[j - 1].x * dc + orderScratch[j - 1].z * dr) > p) {
        orderScratch[j] = orderScratch[j - 1];
        j--;
      }
      orderScratch[j] = e;
    }
    return orderScratch;
  }

  /* ---------- the trace ---------- */

  var out = null;
  var occupancy = null;
  var stepDt = 0;
  var kind = null;
  var pieces = null;
  var nowTime = 0;

  var bendPending = false;
  var currentSourcePower = 1;

  var segDistance = 0;

  function emit(x0, z0, x1, z1, dir, c0, r0, c1, r1, powerStart, powerEnd, sourceId) {
    if (out.segCount >= B.MAX_SEGMENTS) {
      out.overflow = true;
      return false;
    }
    var s = out.segments[out.segCount++];
    s.x0 = x0; s.z0 = z0; s.x1 = x1; s.z1 = z1;
    s.c0 = c0; s.r0 = r0; s.c1 = c1; s.r1 = r1;
    s.dir = dir;
    s.bendAtStart = bendPending;
    bendPending = false;
    s.powerStart = powerStart;
    s.powerEnd = powerEnd;
    s.sourceId = sourceId;
    s.sourcePower = currentSourcePower;
    s.dist0 = segDistance;
    return true;
  }

  function trace(startC, startR, dir, power, depth, sourceId, fromPiece, dist) {
    if (depth > B.MAX_DEPTH || power < B.MIN_POWER || out.overflow) return;
    bendPending = !!fromPiece;

    /* Distance from the source, in cells; the renderer sweeps the beam out
       along this so a re-route travels rather than appearing all at once. */
    var travelled = dist || 0;
    var segStartDist = travelled;

    var DC = R.grid.DC;
    var DR = R.grid.DR;
    var c = startC;
    var r = startR;
    var segC = startC;
    var segR = startR;
    var segX = R.grid.worldX(startC);
    var segZ = R.grid.worldZ(startR);
    var segPower = power;

    for (;;) {
      var nc = c + DC[dir];
      var nr = r + DR[dir];
      var edgeX = R.grid.worldX(c) + DC[dir] * 0.5;
      var edgeZ = R.grid.worldZ(r) + DR[dir] * 0.5;

      if (!R.grid.inBounds(nc, nr)) {
        segDistance = segStartDist;
        emit(segX, segZ, edgeX, edgeZ, dir, segC, segR, c, r, segPower, power, sourceId);
        return;
      }

      var i = nr * B.COLS + nc;
      var key = i * 4 + dir;
      if (visitStamp[key] === visitGen) {
        /* Light never retraces the same cell in the same direction. */
        segDistance = segStartDist;
        emit(segX, segZ, edgeX, edgeZ, dir, segC, segR, c, r, segPower, power, sourceId);
        return;
      }
      visitStamp[key] = visitGen;

      c = nc;
      r = nr;
      travelled += 1;
      if (power > out.lit[i]) out.lit[i] = power;
      out.totalPower += power;

      var list = occupancy ? occupancy[i] : null;
      if (list && list.length) {
        var before = power;
        var ordered = orderAlong(list, dir);
        for (var k = 0; k < ordered.length; k++) {
          var e = ordered[k];
          /*
           * How much of this beam lands depends on which side of the enemy it
           * arrives at, so a shielded body takes far less from light meeting
           * its face than from light reaching its flank or its back.
           */
          var exposure = R.enemies.exposure(e, dir);
          var landed = power * exposure;
          /*
           * Pressure counts the damage actually landing, so it is the same
           * number whether this is a preview (dt 0) or a live step.
           */
          out.pressure += landed;
          if (stepDt > 0) {
            e.damage += landed * stepDt;
            e.hitAt = nowTime;
            if (exposure < 1) e.shieldedAt = nowTime;
            else if (e.shield) e.exposedAt = nowTime;
          }
          /*
           * Absorption is a property of the body, not of the shield: what
           * continues past this enemy is reduced the same way from any angle.
           */
          power *= (1 - e.absorb);
          if (power < B.MIN_POWER) { power = 0; break; }
        }
        if (power !== before) {
          /* Step the rendered beam down at the far edge of this cell. */
          var sx = R.grid.worldX(c) + DC[dir] * 0.5;
          var sz = R.grid.worldZ(r) + DR[dir] * 0.5;
          segDistance = segStartDist;
          if (!emit(segX, segZ, sx, sz, dir, segC, segR, c, r, segPower, before, sourceId)) return;
          segX = sx;
          segZ = sz;
          segC = c;
          segR = r;
          segPower = power;
          segStartDist = travelled;
        }
        if (power < B.MIN_POWER) return;
      }

      var piece = pieces.get(i);
      if (piece && piece.inactiveUntil > nowTime) piece = null;

      if (piece) {
        var px = R.grid.worldX(c);
        var pz = R.grid.worldZ(r);
        segDistance = segStartDist;
        if (!emit(segX, segZ, px, pz, dir, segC, segR, c, r, segPower, power, sourceId)) return;
        if (piece.type === 'mirror') {
          trace(c, r, R.grid.reflect(dir, piece.orient), power, depth + 1, sourceId, true, travelled);
        } else if (piece.type === 'splitter') {
          trace(c, r, dir, power * B.SPLIT_FACTOR, depth + 1, sourceId, true, travelled);
          trace(c, r, R.grid.reflect(dir, piece.orient), power * B.SPLIT_FACTOR, depth + 1, sourceId, true, travelled);
        } else if (piece.type === 'reflector') {
          trace(c, r, R.grid.opposite(dir), power * B.REFLECT_FACTOR, depth + 1, sourceId, true, travelled);
        }
        /* A lamp absorbs whatever reaches it. */
        return;
      }

      if (kind[i] === R.CORE) {
        segDistance = segStartDist;
        emit(segX, segZ, R.grid.worldX(c), R.grid.worldZ(r), dir, segC, segR, c, r, segPower, power, sourceId);
        return;
      }
    }
  }

  /* ---------- entry points ---------- */

  R.beam.corePower = function (level) {
    var arr = B.CORE_POWER;
    return arr[Math.min(Math.max(level, 1), arr.length) - 1];
  };

  R.beam.lampPower = function (level) {
    return R.beam.corePower(level) * B.LAMP_FACTOR;
  };

  /*
   * Solve every source into `result`. `occ` is an array of per-cell enemy lists
   * or null; with a positive `dt` the enemies accumulate damage.
   */
  R.beam.solve = function (state, occ, dt, result) {
    out = result;
    occupancy = occ || null;
    stepDt = dt || 0;
    kind = state.grid.kind;
    pieces = state.pieces;
    nowTime = state.time;

    out.segCount = 0;
    out.totalPower = 0;
    out.litRoadPower = 0;
    out.pressure = 0;
    out.overflow = false;
    out.lit.fill(0);

    var corePower = R.beam.corePower(state.coreLevel);
    var sourceId = 1;

    visitGen++;
    currentSourcePower = corePower;
    trace(R.MAP.core[0], R.MAP.core[1], R.N, corePower, 0, sourceId, false, 0);

    var lampPower = R.beam.lampPower(state.coreLevel);
    var it = pieces.values();
    var entry = it.next();
    while (!entry.done) {
      var p = entry.value;
      if (p.type === 'lamp' && p.inactiveUntil <= nowTime) {
        sourceId++;
        visitGen++;
        currentSourcePower = lampPower;
        trace(p.c, p.r, p.dir, lampPower, 0, sourceId, false, 0);
      }
      entry = it.next();
    }

    var litRoad = 0;
    var litRoadPower = 0;
    for (var i = 0; i < CELLS; i++) {
      if (out.lit[i] > 0 && (kind[i] === R.ROAD || kind[i] === R.SPAWN)) {
        litRoad++;
        litRoadPower += out.lit[i];
      }
    }
    out.litRoadCount = litRoad;
    out.litRoadPower = litRoadPower;
    out.version++;

    out = null;
    occupancy = null;
    pieces = null;
    kind = null;
    return result;
  };

  /*
   * Refresh the live beam without applying damage. This runs only after an
   * edit, so the route version it bumps is what the renderer watches to know
   * the beam should sweep out again.
   */
  R.beam.recompute = function (state) {
    state.routeVersion++;
    R.beam.solve(state, R.enemies ? R.enemies.occupancy(state) : null, 0, state.beam);
    return state.beam;
  };

  /* ---------- placement helpers ---------- */

  var scratchResult = null;

  function scratch() {
    if (!scratchResult) scratchResult = R.beam.makeResult();
    return scratchResult;
  }

  /*
   * How good a layout is, ignoring enemies. The main term is the power falling
   * on road cells. The tiny second term is how far the light reaches overall,
   * which only decides ties: a piece that sends the beam across the board is a
   * better guess than one that sends it straight off the edge, and that is what
   * makes a setup mirror in a chain orient itself the way the player intends.
   */
  R.beam.coverageScore = function (state) {
    var res = R.beam.solve(state, null, 0, scratch());
    var k = state.grid.kind;
    var road = 0;
    var reach = 0;
    for (var i = 0; i < CELLS; i++) {
      if (res.lit[i] <= 0) continue;
      reach++;
      if (k[i] === R.ROAD || k[i] === R.SPAWN) road += res.lit[i];
    }
    return road + reach * 1e-3;
  };

  R.beam.ORIENT_COUNT = { mirror: 2, splitter: 2, reflector: 1, lamp: 4 };

  /*
   * Pick the orientation that puts the most light on the road. Ties keep the
   * lowest orientation, so the choice is deterministic.
   */
  R.beam.bestOrientation = function (state, type, c, r) {
    var n = R.beam.ORIENT_COUNT[type] || 1;
    if (n === 1) return 0;
    var i = R.grid.idx(c, r);
    var existing = state.pieces.get(i);
    var probe = {
      id: -1,
      type: type,
      c: c,
      r: r,
      orient: 0,
      dir: R.N,
      cost: 0,
      placedAt: -1,
      inactiveUntil: -1
    };
    state.pieces.set(i, probe);
    var best = 0;
    var bestScore = -1;
    for (var o = 0; o < n; o++) {
      if (type === 'lamp') probe.dir = o;
      else probe.orient = o;
      var score = R.beam.coverageScore(state);
      if (score > bestScore + 1e-9) {
        bestScore = score;
        best = o;
      }
    }
    if (existing) state.pieces.set(i, existing);
    else state.pieces.delete(i);
    return best;
  };

  var previewScratch = null;

  /* Preview result for a hypothetical piece; used by the drag ghost. */
  R.beam.preview = function (state, type, c, r, orient, removeIndex) {
    if (!previewScratch) previewScratch = R.beam.makeResult();
    var i = R.grid.idx(c, r);
    var existing = state.pieces.get(i);
    var moved = null;
    if (removeIndex !== undefined && removeIndex !== null && removeIndex !== i) {
      moved = state.pieces.get(removeIndex);
      if (moved) state.pieces.delete(removeIndex);
    }
    var probe = {
      id: -1,
      type: type,
      c: c,
      r: r,
      orient: type === 'lamp' ? 0 : orient,
      dir: type === 'lamp' ? orient : R.N,
      cost: 0,
      placedAt: -1,
      inactiveUntil: -1
    };
    state.pieces.set(i, probe);
    var res = R.beam.solve(state, null, 0, previewScratch);
    if (existing) state.pieces.set(i, existing);
    else state.pieces.delete(i);
    if (moved) state.pieces.set(removeIndex, moved);
    return res;
  };
})(typeof window !== 'undefined' ? window : globalThis);
