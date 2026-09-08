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
      id: 0, type: '', hp: 0, maxHp: 0, t: 0, speed: 0, absorb: 0,
      gold: 0, leak: 0, radius: 0, boss: false,
      damage: 0, hitAt: -1, x: 0, z: 0, cell: -1, spawnAt: 0
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
      groups.push(['brute', Math.max(2, Math.floor(count / 4)), 1.2]);
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
    e.gold = def.gold;
    e.leak = def.leak;
    e.radius = def.radius;
    e.boss = !!def.boss;
    e.damage = 0;
    e.hitAt = -1;
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
  }

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
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      e.t += e.speed * dt;
      positionOf(s, e);
    }
  };

  /* Damage collected by the solver becomes deaths; survivors may then leak. */
  en.resolveStep = function (s) {
    var list = s.enemies;
    var end = s.path.length - 1;
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
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
