/*
 * Enemies and waves. Enemies walk the fixed path, absorb light, die or reach
 * the core. Waves are read from the balance table and generated past the last
 * scripted beat.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});
  var B = R.BALANCE;
  var CELLS = B.COLS * B.ROWS;

  var en = {};
  R.enemies = en;

  /* Reused enemy records, so a long run allocates nothing per wave. */
  var pool = [];

  function acquire() {
    return pool.length ? pool.pop() : {
      id: 0, type: '', hp: 0, maxHp: 0, t: 0, speed: 0, absorb: 0, shield: 0,
      gold: 0, leak: 0, radius: 0, boss: false, face: 0,
      shield0: 0, exposeAt: 0, phase: 1,
      damage: 0, hitAt: -1, shieldedAt: -1, exposedAt: -1, crossfireAt: -1,
      dirMask: 0, peakHit: 0, glowUntil: -1, glowPower: 0,
      x: 0, z: 0, cell: -1, spawnAt: 0
    };
  }

  en.releaseAll = function (s) {
    if (!s || !s.enemies) return;
    for (var i = 0; i < s.enemies.length; i++) pool.push(s.enemies[i]);
    s.enemies.length = 0;
  };

  /* ---------- wave data ---------- */

  en.hpMult = function (wave) {
    return 1 + B.HP_MULT_PER_WAVE * (wave - 1);
  };

  en.speedMult = function (wave) {
    var last = B.WAVES.length;
    if (wave <= last) return 1;
    return Math.min(B.ENDLESS.SPEED_CAP, 1 + B.ENDLESS.SPEED_PER_WAVE * (wave - last));
  };

  /* Endless waves rotate through four shapes and add a king every fifth wave. */
  en.endlessGroups = function (wave) {
    var count = B.ENDLESS.BASE_COUNT + wave;
    var pattern = (wave - B.WAVES.length - 1) % 4;
    var groups = [];
    if (pattern === 0) {
      groups.push(['mote', count, 0.6]);
      groups.push(['runner', Math.ceil(count / 3), 0.5]);
    } else if (pattern === 1) {
      groups.push(['runner', count, 0.45]);
      groups.push(['mote', Math.ceil(count / 3), 0.7]);
    } else if (pattern === 2) {
      groups.push(['swarmling', 8, 0.25]);
      groups.push(['swarmling', 8, 0.25]);
      groups.push(['swarmling', 8, 0.25]);
      groups.push(['mote', Math.ceil(count / 2), 0.6]);
    } else {
      groups.push(['bulwark', Math.max(2, Math.floor(count / 4)), 1.2]);
      groups.push(['mote', count, 0.6]);
    }
    if (wave % B.ENDLESS.KING_EVERY === 0) groups.unshift(['bruteking', 1, 0]);
    return groups;
  };

  en.groupsFor = function (wave) {
    if (wave <= B.WAVES.length) return B.WAVES[wave - 1];
    return en.endlessGroups(wave);
  };

  /* Flattened spawn schedule: one entry per enemy, in spawn order. */
  en.buildQueue = function (wave) {
    var groups = en.groupsFor(wave);
    var queue = [];
    var t = 0;
    for (var g = 0; g < groups.length; g++) {
      var type = groups[g][0];
      var count = groups[g][1];
      var gap = groups[g][2];
      for (var i = 0; i < count; i++) {
        queue.push({ type: type, at: t });
        if (i < count - 1) t += gap;
      }
      t += B.GROUP_GAP;
    }
    return queue;
  };

  /* Composition summary for the incoming strip, in spawn order. */
  en.composition = function (wave) {
    var groups = en.groupsFor(wave);
    var out = [];
    for (var g = 0; g < groups.length; g++) {
      var last = out[out.length - 1];
      if (last && last.type === groups[g][0]) last.count += groups[g][1];
      else out.push({ type: groups[g][0], count: groups[g][1] });
    }
    return out;
  };

  /*
   * One short line naming what is coming and why it matters. It describes the
   * formation, never the player's layout, so the preview cannot be accused of
   * reacting to what has been built.
   */
  en.threatNote = function (wave) {
    var comp = en.composition(wave);
    var has = {};
    for (var i = 0; i < comp.length; i++) has[comp[i].type] = comp[i].count;
    if (has.umbra) return 'Umbra, shielded, with escorts';
    if (has.bruteking) return 'a Brute King leads';
    if (has.bulwark && has.swarmling) return 'a shielded leader, then a swarm';
    if (has.bulwark && comp[0].type === 'bulwark') return 'armoured leaders, others behind';
    if (has.bulwark) return 'armoured bodies in the line';
    if (has.swarmling) return 'a swarm that drains the beam';
    if (has.runner) return 'runners cross the light fast';
    return 'a slow opening group';
  };

  /* ---------- spawning ---------- */

  en.spawn = function (s, type) {
    var def = B.ENEMY[type];
    var e = acquire();
    e.id = s.nextEnemyId++;
    e.type = type;
    e.maxHp = def.boss ? def.hp : Math.round(def.hp * en.hpMult(s.wave));
    e.hp = e.maxHp;
    e.t = -1;
    e.speed = def.speed * en.speedMult(s.wave);
    e.absorb = def.absorb;
    e.shield = def.shield || 0;
    e.shield0 = e.shield;
    e.exposeAt = def.exposeAt || 0;
    e.phase = 1;
    e.gold = def.gold;
    e.leak = def.leak;
    e.radius = def.radius;
    e.boss = !!def.boss;
    e.damage = 0;
    e.hitAt = -1;
    e.shieldedAt = -1;
    e.exposedAt = -1;
    e.dirMask = 0;
    e.peakHit = 0;
    e.glowUntil = -1;
    e.glowPower = 0;
    e.crossfireAt = -1;
    e.face = R.S;
    e.cell = -1;
    e.spawnAt = s.time;
    positionOf(s, e);
    s.enemies.push(e);
    R.emit(s, 'spawn', { enemy: type, id: e.id });
    return e;
  };

  /* ---------- movement ---------- */

  /*
   * Enemies walk from a virtual cell one row above the portal. Below t = -0.5
   * they are still off the board and cannot be hit.
   */
  function pathPoint(s, index, out) {
    if (index < 0) {
      out.x = R.grid.worldX(R.MAP.spawn[0]);
      out.z = R.grid.worldZ(R.MAP.spawn[1]) - 1;
    } else {
      var p = s.path[Math.min(index, s.path.length - 1)];
      out.x = R.grid.worldX(p.c);
      out.z = R.grid.worldZ(p.r);
    }
    return out;
  }

  var pa = { x: 0, z: 0 };
  var pb = { x: 0, z: 0 };

  function positionOf(s, e) {
    var k = Math.floor(e.t);
    var frac = e.t - k;
    pathPoint(s, k, pa);
    pathPoint(s, k + 1, pb);
    e.x = pa.x + (pb.x - pa.x) * frac;
    e.z = pa.z + (pb.z - pa.z) * frac;
    var idx = Math.round(e.t);
    if (idx < 0) e.cell = -1;
    else e.cell = s.path[Math.min(idx, s.path.length - 1)].i;
    e.face = facing(pa, pb, e.face);
  }

  /*
   * Which way an enemy is looking, which is simply the way it is walking. The
   * road is axis aligned, so this is one of the four direction codes. A step
   * that covers no ground keeps the previous facing.
   */
  function facing(from, to, previous) {
    var dx = to.x - from.x;
    var dz = to.z - from.z;
    if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? R.E : R.W;
    if (Math.abs(dz) > 0) return dz > 0 ? R.S : R.N;
    return previous;
  }

  /*
   * How much of an incoming beam actually lands, given the direction the light
   * is travelling. Light meeting the face this enemy walks towards is cut by
   * its shield; light arriving at a flank or from behind lands in full.
   */
  en.exposure = function (e, beamDir) {
    if (!e.shield) return 1;
    return beamDir === R.grid.opposite(e.face) ? 1 - e.shield : 1;
  };

  en.positionOf = positionOf;

  /* ---------- occupancy ---------- */

  var occ = new Array(CELLS);

  en.occupancy = function (s) {
    for (var i = 0; i < CELLS; i++) occ[i] = null;
    var list = s.enemies;
    for (var k = 0; k < list.length; k++) {
      var e = list[k];
      if (e.cell < 0) continue;
      if (!occ[e.cell]) occ[e.cell] = [];
      occ[e.cell].push(e);
    }
    return occ;
  };

  /* ---------- per-step work ---------- */

  en.spawnStep = function (s, dt) {
    if (s.phase !== 'wave') return;
    while (s.spawnCursor < s.spawnQueue.length && s.spawnQueue[s.spawnCursor].at <= s.waveTime) {
      en.spawn(s, s.spawnQueue[s.spawnCursor].type);
      s.spawnCursor++;
    }
  };

  en.moveStep = function (s, dt) {
    var list = s.enemies;
    var last = s.path.length - 1;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      e.t += e.speed * dt;
      positionOf(s, e);
      /*
       * A boss that advances behind a shield drops it partway down the road.
       * The change is announced so the renderer and audio can telegraph it,
       * and it happens on distance travelled rather than on damage taken, so
       * the player can see it coming and prepare for it.
       */
      if (e.phase === 1 && e.exposeAt > 0 && e.t >= last * e.exposeAt) {
        e.phase = 2;
        e.shield = 0;
        R.emit(s, 'bossphase', { enemy: e.type, id: e.id, phase: 2, x: e.x, z: e.z });
      }
    }
  };

  /* How many different directions delivered light to a body this step. */
  function directionsHit(mask) {
    var n = 0;
    for (var d = 0; d < 4; d++) if (mask & (1 << d)) n++;
    return n;
  }

  /*
   * Damage collected by the solver becomes deaths; survivors may then leak.
   * The run upgrades that change damage rather than light are applied here, on
   * the total for the step, so each is counted once however many beams landed.
   */
  en.resolveStep = function (s, dt) {
    var list = s.enemies;
    var end = s.path.length - 1;
    var step = dt || 0;
    var crossfire = R.upgradeValue(s, 'crossfire', 'bonus', 0);
    var glowSeconds = R.upgradeValue(s, 'afterglow', 'seconds', 0);
    var glowShare = R.upgradeValue(s, 'afterglow', 'share', 0);

    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];

      if (crossfire > 0 && e.damage > 0 && directionsHit(e.dirMask) >= 2) {
        e.damage *= (1 + crossfire);
        e.crossfireAt = s.time;
      }

      /*
       * Afterglow is a single refreshable burn, never a stack: a new hit
       * replaces the tail rather than adding another one, and the tail itself
       * never counts as a hit, so it cannot feed itself.
       */
      if (glowSeconds > 0) {
        if (e.peakHit > 0) {
          e.glowUntil = s.time + glowSeconds;
          e.glowPower = e.peakHit * glowShare;
        } else if (e.glowUntil > s.time && e.glowPower > 0) {
          e.damage += e.glowPower * step;
        }
      }

      e.dirMask = 0;
      e.peakHit = 0;

      if (e.damage > 0) {
        e.hp -= e.damage;
        e.damage = 0;
      }
      if (e.hp <= 0) {
        list.splice(i, 1);
        s.gold += e.gold;
        s.goldEarned += e.gold;
        R.emit(s, 'kill', { enemy: e.type, gold: e.gold, x: e.x, z: e.z, boss: e.boss, id: e.id });
        pool.push(e);
        continue;
      }
      if (e.t >= end) {
        list.splice(i, 1);
        s.coreHp -= e.leak;
        s.leaksBy[e.type] = (s.leaksBy[e.type] || 0) + 1;
        R.emit(s, 'leak', { enemy: e.type, leak: e.leak, x: e.x, z: e.z, id: e.id });
        /*
         * A boss that arrives ends the run outright. Surviving the hit is not
         * a win: the session is only won by destroying it on the road.
         */
        if (e.boss) {
          s.bossBreached = e.type;
          R.emit(s, 'breach', { enemy: e.type, x: e.x, z: e.z, id: e.id });
        }
        pool.push(e);
      }
    }
  };

  en.aliveCount = function (s) {
    return s.enemies.length;
  };

  en.remaining = function (s) {
    return s.enemies.length + (s.spawnQueue.length - s.spawnCursor);
  };

  en.waveComplete = function (s) {
    return s.spawnCursor >= s.spawnQueue.length && s.enemies.length === 0;
  };
})(typeof window !== 'undefined' ? window : globalThis);
