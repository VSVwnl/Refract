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
      shield0: 0, exposeAt: 0, phase: 1, route: 0,
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

  /*
   * Bodies get tougher through the campaign and then stop. Past the cap an
   * endless encounter is made harder by its shape rather than by handing the
   * same body more health, so nothing ever turns into a wall that is merely
   * slow to remove.
   */
  en.hpMult = function (wave) {
    var mult = 1 + B.HP_MULT_PER_WAVE * (wave - 1);
    if (wave > B.WAVES.length) return Math.min(mult, B.ENDLESS.HP_MULT_CAP);
    return mult;
  };

  en.speedMult = function (wave) {
    var last = B.WAVES.length;
    if (wave <= last) return 1;
    return Math.min(B.ENDLESS.SPEED_CAP, 1 + B.ENDLESS.SPEED_PER_WAVE * (wave - last));
  };

  /* ---------- endless ---------- */

  /* Which endless encounter a wave is, as an index into the table. */
  function endlessIndex(wave) {
    var n = wave - B.WAVES.length - 1;
    return ((n % B.ENDLESS.ENCOUNTERS.length) + B.ENDLESS.ENCOUNTERS.length) % B.ENDLESS.ENCOUNTERS.length;
  }

  en.endlessEncounter = function (wave) {
    return B.ENDLESS.ENCOUNTERS[endlessIndex(wave)];
  };

  /*
   * Endless encounters. Each one asks for a different shape of network:
   *
   *   split     both gates at once, so a single covered road is not enough
   *   wall      a column of shields all facing the way they walk, which wants
   *             light reaching a flank or a back rather than more of it
   *   tide      bodies packed tightly enough that absorption eats the beam
   *             before it reaches the back of the group
   *   break     runners, who are only ever briefly in any one cell
   *   vanguard  a Brute King with an escort, down whichever gate is quieter
   *
   * The cut, when one is open, always carries part of the pressure, so an
   * encounter with a cut is never simply the same encounter again.
   */
  en.endlessGroups = function (wave, cutRoute) {
    var E = B.ENDLESS;
    var step = wave - B.WAVES.length;
    var count = E.BASE_COUNT + Math.round(E.COUNT_PER_WAVE * step);
    /*
     * What grows with the wave is the shape of the pressure, not the health
     * of any one body: more shields in a wall, more bodies in a tide, and
     * tighter spacing, down to a floor so a group never becomes a single
     * unreadable clump.
     */
    var shields = Math.min(E.SHIELD_CAP, E.SHIELD_BASE + Math.floor(step / E.SHIELD_EVERY));
    var swarm = Math.min(E.SWARM_CAP, E.SWARM_BASE + Math.floor(step / E.SWARM_EVERY) * 4);
    var gap = Math.max(E.GAP_FLOOR, E.GAP_BASE - E.GAP_PER_WAVE * step);
    var kind = en.endlessEncounter(wave).key;
    var cut = cutRoute === undefined ? -1 : cutRoute;
    var groups = [];

    if (kind === 'split') {
      var half = Math.ceil(count / 2);
      groups.push(['mote', half, gap, 0]);
      groups.push(['runner', Math.ceil(count / 3), gap * 0.8, 1]);
      groups.push(['mote', half, gap, 1]);
      groups.push(['bulwark', Math.max(1, shields - 2), gap * 2, 0]);
    } else if (kind === 'wall') {
      groups.push(['bulwark', shields, gap * 1.8, 0]);
      groups.push(['bulwark', Math.max(1, shields - 1), gap * 1.8, 1]);
      groups.push(['mote', Math.ceil(count / 2), gap, 0]);
    } else if (kind === 'tide') {
      groups.push(['swarmling', swarm, E.SWARM_GAP, 0]);
      groups.push(['swarmling', swarm, E.SWARM_GAP, 1]);
      groups.push(['bulwark', Math.max(1, shields - 2), gap * 2, 0]);
      groups.push(['mote', Math.ceil(count / 2), gap, 1]);
    } else if (kind === 'break') {
      groups.push(['runner', count, gap * 0.6, 0]);
      groups.push(['runner', Math.ceil(count / 2), gap * 0.6, 1]);
      groups.push(['bulwark', Math.max(1, shields - 2), gap * 2, 0]);
      groups.push(['mote', Math.ceil(count / 3), gap, 0]);
    } else {
      groups.push(['bruteking', 1, 0, 1]);
      groups.push(['bulwark', Math.max(2, shields - 1), gap * 1.8, 0]);
      groups.push(['runner', Math.ceil(count / 2), gap * 0.8, 1]);
      groups.push(['mote', Math.ceil(count / 2), gap, 0]);
    }

    /*
     * A Brute King every so often, but never on top of an encounter that is
     * already a wall of shields or its own vanguard: one hard idea at a time.
     */
    if (wave % E.KING_EVERY === 0 && kind !== 'vanguard' && kind !== 'wall') {
      groups.unshift(['bruteking', 1, 0, 0]);
    }

    /*
     * While a cut is open most of the encounter walks it. That is the whole
     * point of a bypass: if only a handful took it, covering it would never be
     * worth rearranging the network for, and the cut would be decoration.
     */
    if (cut >= 0) {
      var moved = [];
      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var take = Math.round(g[1] * E.CUT_SHARE);
        if (take <= 0) continue;
        g[1] -= take;
        moved.push([g[0], take, g[2], cut]);
      }
      groups = groups.filter(function (g) { return g[1] > 0; }).concat(moved);
    }

    return groups;
  };

  /*
   * The campaign is read straight from the table. Only past it does the
   * generator run, and only there can a cut be in play.
   */
  en.groupsFor = function (wave, cutRoute) {
    if (wave <= B.WAVES.length) return B.WAVES[wave - 1];
    return en.endlessGroups(wave, cutRoute);
  };

  /* Flattened spawn schedule: one entry per enemy, in spawn order. */
  en.buildQueue = function (wave, cutRoute) {
    var groups = en.groupsFor(wave, cutRoute);
    var queue = [];
    var t = 0;
    for (var g = 0; g < groups.length; g++) {
      var type = groups[g][0];
      var count = groups[g][1];
      var gap = groups[g][2];
      var route = groups[g][3] || 0;
      for (var i = 0; i < count; i++) {
        queue.push({ type: type, at: t, route: route });
        if (i < count - 1) t += gap;
      }
      t += B.GROUP_GAP;
    }
    /*
     * Groups are written one after another, but two roads run at once, so a
     * queue that is already ordered by time reads correctly on both.
     */
    queue.sort(function (a, b) { return a.at - b.at; });
    return queue;
  };

  /* Which roads a wave uses, lowest first. */
  en.routesFor = function (wave, cutRoute) {
    var groups = en.groupsFor(wave, cutRoute);
    var seen = [];
    for (var g = 0; g < groups.length; g++) {
      var route = groups[g][3] || 0;
      if (seen.indexOf(route) < 0) seen.push(route);
    }
    seen.sort();
    return seen;
  };

  /* Composition summary for the incoming strip, in spawn order. */
  en.composition = function (wave, cutRoute) {
    var groups = en.groupsFor(wave, cutRoute);
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
  /*
   * Names an entrance the next encounter uses that has not been used before,
   * or null. The strip shows this during planning, so a road never opens
   * without the player having been told about it first.
   */
  en.newMouthNote = function (s, wave) {
    var uses = en.routesFor(wave);
    for (var i = 0; i < uses.length; i++) {
      if (uses[i] >= s.routesOpen) {
        var road = s.routes[uses[i]];
        return 'the ' + road.name + ' gate opens';
      }
    }
    return null;
  };

  en.threatNote = function (wave) {
    if (wave > B.WAVES.length) return en.endlessEncounter(wave).note;
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

  en.spawn = function (s, type, route) {
    var def = B.ENEMY[type];
    var e = acquire();
    e.id = s.nextEnemyId++;
    e.type = type;
    e.route = route || 0;
    if (e.route >= s.routes.length) e.route = 0;
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
    R.emit(s, 'spawn', { enemy: type, id: e.id, route: e.route });
    return e;
  };

  /* ---------- movement ---------- */

  /*
   * Enemies walk from a virtual cell one row above the portal. Below t = -0.5
   * they are still off the board and cannot be hit.
   */
  function pathPoint(s, route, index, out) {
    var road = s.routes[route];
    if (index < 0) {
      out.x = R.grid.worldX(road.spawn[0]);
      out.z = R.grid.worldZ(road.spawn[1]) - 1;
    } else {
      var p = road.path[Math.min(index, road.path.length - 1)];
      out.x = R.grid.worldX(p.c);
      out.z = R.grid.worldZ(p.r);
    }
    return out;
  }

  /* The last index on a road, which is the core. */
  en.endOf = function (s, route) {
    return s.routes[route].path.length - 1;
  };

  var pa = { x: 0, z: 0 };
  var pb = { x: 0, z: 0 };

  function positionOf(s, e) {
    var road = s.routes[e.route];
    var k = Math.floor(e.t);
    var frac = e.t - k;
    pathPoint(s, e.route, k, pa);
    pathPoint(s, e.route, k + 1, pb);
    e.x = pa.x + (pb.x - pa.x) * frac;
    e.z = pa.z + (pb.z - pa.z) * frac;
    var idx = Math.round(e.t);
    if (idx < 0) e.cell = -1;
    else e.cell = road.path[Math.min(idx, road.path.length - 1)].i;
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
      en.spawn(s, s.spawnQueue[s.spawnCursor].type, s.spawnQueue[s.spawnCursor].route);
      s.spawnCursor++;
    }
  };

  en.moveStep = function (s, dt) {
    var list = s.enemies;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var last = en.endOf(s, e.route);
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
      if (e.t >= en.endOf(s, e.route)) {
        list.splice(i, 1);
        s.coreHp -= e.leak;
        s.leaksBy[e.type] = (s.leaksBy[e.type] || 0) + 1;
        R.emit(s, 'leak', { enemy: e.type, leak: e.leak, x: e.x, z: e.z, id: e.id });
        /*
         * In the campaign a boss that arrives ends the run outright, because
         * the campaign is won by destroying Umbra rather than by outlasting
         * it. Endless has no victory to protect, so a boss that gets through
         * simply lands its own heavy hit and the run carries on. That keeps
         * endless a curve the player can feel rather than a cliff.
         */
        if (e.boss && !s.endless) {
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
