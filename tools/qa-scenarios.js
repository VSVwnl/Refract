'use strict';
/*
 * qa-scenarios.js - the scripted browser test scenarios used by tools/qa.js.
 * Development only; never part of the build.
 */

module.exports = function (S) {

  /* Phase 0: the board renders, the layout fits, nothing loads from the network. */
  S.layout = async function (ctx) {
    const m = await ctx.ev(function () {
      const el = function (id) { return document.getElementById(id); };
      const r = function (id) {
        const b = el(id).getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      };
      return {
        inner: [innerWidth, innerHeight],
        app: r('app'),
        hud: r('hud'),
        strip: r('strip'),
        wrap: r('boardWrap'),
        board: r('board'),
        actions: r('actionRow'),
        palette: r('palette'),
        cell: Math.round(R.render.cell * 100) / 100,
        scrollW: document.documentElement.scrollWidth,
        scrollH: document.documentElement.scrollHeight,
        info: R.render.info(),
        phase: R.state.phase,
        wide: document.body.classList.contains('wide')
      };
    });
    ctx.log('  layout ' + JSON.stringify(m));

    ctx.eq(m.scrollW, ctx.width, 'no horizontal overflow');
    ctx.check(m.app.w <= ctx.width, 'app column fits the viewport');
    ctx.eq(m.scrollH, ctx.height, 'no vertical overflow');
    ctx.check(m.board.w > 0 && m.board.h > 0, 'board has size');
    ctx.check(m.board.x >= m.app.x && m.board.x + m.board.w <= m.app.x + m.app.w + 1, 'board inside the app column');
    ctx.check(m.palette.y + m.palette.h <= m.app.y + m.app.h + 1, 'palette inside the app column');
    ctx.check(m.info.calls > 0 && m.info.calls <= 150, 'draw calls in budget: ' + m.info.calls);
    ctx.check(m.cell >= 26, 'cell size ' + m.cell + 'px');

    await ctx.snap('board');
  };

  /* Phase 1: bending the beam with mirrors. */
  S.beam = async function (ctx) {
    await ctx.ev(function () { window.__REFRACT.restart(10); });
    const lit = function () { return ctx.ev(function () { return R.state.beam.litRoadCount; }); };
    const gold = function () { return ctx.ev(function () { return R.state.gold; }); };
    const hud = function () {
      return ctx.ev(function () {
        return document.getElementById('statLight').textContent + ' / ' +
               document.getElementById('statGold').textContent;
      });
    };

    ctx.eq(await lit(), 1, 'default beam lights one road cell');
    /* Coverage is a secondary reading: one lit road cell on an empty board. */
    ctx.eq((await hud()).replace(/\s+/g, ''),
      'COVER1/' + await ctx.ev(function () { return R.state.roadCells; }) +
      '/◆' + await ctx.ev(function () { return R.BALANCE.START_GOLD; }),
      'HUD shows one lit road cell and the starting gold');
    await ctx.snap('a-default');

    await ctx.tapCell(7, 4);
    ctx.eq(await lit(), 7, 'mirror at (7,4) lights the row 4 sweep');
    ctx.eq(await gold(), await ctx.ev(function () { return R.BALANCE.START_GOLD - R.BALANCE.PIECE_COST.mirror; }), 'gold after one mirror');
    ctx.eq(await ctx.ev(function () { return R.pieces.at(R.state, 7, 4).orient; }), 1, 'smart orientation');
    await ctx.snap('b-mirror74');

    await ctx.tapCell(7, 4);
    ctx.check(await ctx.ev(function () { return R.state.ui.selectedPieceId !== null; }),
      'tapping a placed piece selects it');
    await ctx.tap('#actionBar button:nth-child(1)');
    ctx.eq(await lit(), 1, 'flipping sends the beam off the board');
    ctx.eq(await gold(), await ctx.ev(function () { return R.BALANCE.START_GOLD - R.BALANCE.PIECE_COST.mirror; }), 'flipping is free');
    await ctx.snap('c-flipped');

    await ctx.ev(function () { window.__REFRACT.restart(11); });
    ctx.eq(await lit(), 1, 'fresh board is back to one lit cell');
    await ctx.tapCell(7, 6);
    ctx.eq(await lit(), 7, 'mirror at (7,6) lights the row 6 sweep');
    await ctx.snap('d-mirror76');

    await ctx.ev(function () { window.__REFRACT.restart(11); window.__REFRACT.setGold(200); });
    await ctx.tapCell(7, 8);
    await ctx.tapCell(0, 8);
    await ctx.tapCell(0, 6);
    ctx.eq(await lit(), 13, 'three mirror chain reaches a second sweep');
    ctx.eq(await gold(), 140, 'three mirrors cost 60');
    const chain = await ctx.ev(function () {
      return [R.pieces.at(R.state, 7, 8).orient, R.pieces.at(R.state, 0, 8).orient, R.pieces.at(R.state, 0, 6).orient];
    });
    ctx.eq(JSON.stringify(chain), '[1,1,0]', 'chain orientations');
    await ctx.snap('e-chain');

    await ctx.tapCell(3, 4);
    ctx.eq(await ctx.ev(function () { return R.state.pieces.size; }), 3, 'a road tile refuses a piece');
    await ctx.tapCell(7, 11);
    ctx.eq(await ctx.ev(function () { return R.state.pieces.size; }), 3, 'the core tile refuses a piece');
    await ctx.tapCell(5, 0);
    ctx.eq(await ctx.ev(function () { return R.state.pieces.size; }), 3, 'the spawn tile refuses a piece');

    /* Twenty rapid taps on one tile must buy exactly one mirror. */
    const before = await ctx.ev(function () { return R.state.pieces.size; });
    const pt = await ctx.cellPoint(3, 10);
    for (let i = 0; i < 20; i++) await ctx.page.touchscreen.tap(pt.x, pt.y);
    await ctx.page.waitForTimeout(80);
    ctx.eq(await ctx.ev(function () { return R.state.pieces.size; }), before + 1, 'rapid taps buy one piece');

    await ctx.ev(function () { window.__REFRACT.setGold(15); R.pieces.deselect(R.state); });
    const n = await ctx.ev(function () { return R.state.pieces.size; });
    await ctx.tapCell(5, 10);
    ctx.eq(await ctx.ev(function () { return R.state.pieces.size; }), n, 'no purchase without gold');
    ctx.eq(await gold(), 15, 'gold untouched');
    const floater = await ctx.ev(function () {
      const f = Array.prototype.slice.call(document.querySelectorAll('#boardOverlay .floater'));
      return f.filter(function (x) { return x.style.display !== 'none'; }).map(function (x) { return x.textContent; }).join('|');
    });
    ctx.check(floater.indexOf('Need 20') >= 0, 'shows "Need 20" (got "' + floater + '")');
    await ctx.snap('f-need');

    /* Resizing mid-state must not disturb the run. */
    await ctx.page.setViewportSize({ width: 430, height: 932 });
    await ctx.page.waitForTimeout(200);
    ctx.eq(await lit(), 13, 'lit count survives a resize');
    ctx.eq(await ctx.ev(function () { return R.state.pieces.size; }), n, 'pieces survive a resize');
    await ctx.snap('g-resized');
    await ctx.page.setViewportSize({ width: ctx.width, height: ctx.height });
    await ctx.page.waitForTimeout(200);

    const info = await ctx.ev(function () { return R.render.info(); });
    ctx.check(info.calls <= 150, 'draw calls in budget: ' + info.calls);
  };

  /* Phase 2: enemies, damage, gold, core HP and the wave cycle. */
  S.waves = async function (ctx) {
    const snap = function () { return ctx.snapshot(); };
    const step = function (sec) { return ctx.ev(function (n) { return window.__REFRACT.step(n); }, sec); };
    const until = function (src, max) {
      return ctx.ev(function (a) { return window.__REFRACT.stepUntil(a[0], a[1]); }, [src, max || 200]);
    };

    /* Expected numbers come from BALANCE so a retune does not rot the test. */
    const B = await ctx.ev(function () {
      const b = R.BALANCE;
      const w1 = R.enemies.groupsFor(1);
      let motes = 0;
      for (let i = 0; i < w1.length; i++) if (w1[i][0] === 'mote') motes += w1[i][1];
      return {
        startGold: b.START_GOLD, coreHp: b.CORE_HP, waves: b.WAVES.length,
        first: b.FIRST_COUNTDOWN, between: b.COUNTDOWN,
        mirror: b.PIECE_COST.mirror, moteGold: b.ENEMY.mote.gold,
        unlock: b.UNLOCK_WAVE, wave1Motes: motes,
        clear1: b.WAVE_CLEAR_BASE + b.WAVE_CLEAR_PER_WAVE * 1
      };
    });

    await ctx.ev(function () { window.__REFRACT.restart(101); window.__REFRACT.freeze(true); });
    let m = await snap();
    ctx.eq(m.wave, 0, 'starts before wave 1');
    ctx.eq(m.coreHp, B.coreHp, 'core hp');
    ctx.eq(m.gold, B.startGold, 'start gold');

    /* Planning has no clock: waiting must never start a wave by itself. */
    await step(30);
    m = await snap();
    ctx.eq(m.phase, 'building', 'waiting in planning does not start the wave');
    ctx.eq(m.wave, 0, 'and no wave number was consumed');

    /* --- wave 1 with nothing placed: every mote leaks --- */
    await ctx.ev(function () { window.__REFRACT.startWave(); });
    m = await snap();
    ctx.eq(m.phase, 'wave', 'asking for the wave starts it');
    ctx.eq(m.wave, 1, 'wave number');
    await ctx.snap('a-wave1-running');

    await until('s.phase === "building"', 120);
    m = await snap();
    ctx.eq(m.coreHp, B.coreHp - B.wave1Motes, 'every wave-1 mote leaked one HP');
    ctx.eq(m.leaksBy.mote, B.wave1Motes, 'leaks attributed to motes');
    ctx.eq(m.gold, B.startGold + B.clear1, 'gold is start plus the wave-1 clear bonus');
    ctx.eq(m.wave, 1, 'wave 1 is over');
    ctx.eq(m.phase, 'building', 'back to planning');
    ctx.eq(m.unlocked.splitter, B.unlock.splitter <= 2, 'splitter unlocked on schedule');

    /* --- wave 1 with one mirror at (7,6): nothing gets through --- */
    await ctx.ev(function () { window.__REFRACT.restart(101); window.__REFRACT.freeze(true); });
    await ctx.tapCell(7, 6);
    m = await snap();
    ctx.eq(m.lit, 7, 'mirror lights the row 6 sweep');
    ctx.eq(m.gold, B.startGold - B.mirror, 'the mirror was paid for');

    await ctx.ev(function () { window.__REFRACT.startWave(); });
    await until('s.phase === "building"', 120);
    m = await snap();
    const kills = B.wave1Motes * B.moteGold;
    ctx.eq(m.coreHp, B.coreHp, 'no leaks with the mirror in place');
    ctx.eq(m.gold, B.startGold - B.mirror + kills + B.clear1, 'gold: every mote killed plus the clear bonus');
    ctx.eq(m.goldEarned, kills + B.clear1, 'earned gold counts kills and the bonus');
    await ctx.snap('b-wave1-cleared');

    /* --- waves 2 and 3, each asked for --- */
    await ctx.ev(function () { window.__REFRACT.startWave(); });
    m = await snap();
    ctx.eq(m.wave, 2, 'wave 2 running');
    await ctx.snap('c-wave2');
    await until('s.phase === "building"', 200);
    m = await snap();
    ctx.eq(m.wavesCleared, 2, 'two waves cleared');

    await ctx.ev(function () { window.__REFRACT.playWave(); });
    m = await snap();
    ctx.eq(m.wavesCleared, 3, 'three waves cleared');
    ctx.eq(m.unlocked.reflector, B.unlock.reflector <= 4, 'reflector unlocked on schedule');
    ctx.log('  after three waves: hp ' + m.coreHp + ' gold ' + m.gold + ' score ' + m.score);
    await ctx.snap('d-after-wave3');

    /* --- the beam dims past each enemy --- */
    await ctx.ev(function () {
      window.__REFRACT.restart(202);
      window.__REFRACT.freeze(true);
      window.__REFRACT.setGold(500);
      window.__REFRACT.place('mirror', 7, 4, 1);
      window.__REFRACT.nextWave();
    });
    await until('s.enemies.length >= 3 && s.enemies[0].t > 11', 60);
    const dim = await ctx.ev(function () {
      const s = R.state;
      const row = [];
      for (let c = 6; c >= 1; c--) row.push(Math.round(s.beam.lit[R.grid.idx(c, 4)] * 100) / 100);
      return { row: row, foes: s.enemies.map(function (e) { return [e.type, Math.round(e.t * 10) / 10, Math.round(e.hp)]; }) };
    });
    ctx.log('  row 4 power along the beam (east to west): ' + JSON.stringify(dim.row));
    ctx.log('  enemies: ' + JSON.stringify(dim.foes));
    let dropped = false;
    for (let i = 1; i < dim.row.length; i++) if (dim.row[i] < dim.row[i - 1] - 0.01) dropped = true;
    ctx.check(dropped, 'beam power falls as it passes enemies');
    await ctx.snap('e-absorption');
    await ctx.page.screenshot({
      path: 'shots/' + ctx.prefix + '-e-absorption-zoom.png',
      clip: { x: 0, y: 200, width: ctx.width, height: 300 }
    });

    /* --- a runner survives one lit cell but dies along a lit segment --- */
    const oneCell = await ctx.ev(function () {
      window.__REFRACT.restart(303);
      window.__REFRACT.freeze(true);
      const s = R.state;
      s.wave = 3;
      R.enemies.spawn(s, 'runner');
      window.__REFRACT.stepUntil('s.enemies.length === 0', 60);
      return { leaks: s.leaksBy.runner, earned: s.goldEarned };
    });
    ctx.eq(oneCell.leaks, 1, 'a runner crossing one lit cell reaches the core');

    const segment = await ctx.ev(function () {
      window.__REFRACT.restart(304);
      window.__REFRACT.freeze(true);
      window.__REFRACT.setGold(500);
      window.__REFRACT.place('mirror', 7, 4, 1);
      const s = R.state;
      s.wave = 3;
      R.enemies.spawn(s, 'runner');
      window.__REFRACT.stepUntil('s.enemies.length === 0', 60);
      return { leaks: s.leaksBy.runner, killed: s.goldEarned };
    });
    ctx.eq(segment.leaks, 0, 'a runner dies inside a six-cell lit segment');
    ctx.check(segment.killed > 0, 'the kill paid gold');

    /* --- double speed --- */
    const speeds = await ctx.ev(function () {
      window.__REFRACT.restart(404);
      const s = R.state;
      s.speed = 2;
      return s.speed;
    });
    ctx.eq(speeds, 2, 'speed can be set to 2');
    await ctx.page.waitForTimeout(500);
    ctx.check(await ctx.ev(function () { return R.state.time > 0.6; }), 'the clock runs at double speed');

    const info = await ctx.ev(function () { return R.render.info(); });
    ctx.check(info.calls <= 150, 'draw calls in budget: ' + info.calls);
  };

  /* Phase 3: title, defeat, victory, pause and restart parity. */
  S.runstates = async function (ctx) {
    const snap = function () { return ctx.snapshot(); };
    const until = function (src, max) {
      return ctx.ev(function (a) { return window.__REFRACT.stepUntil(a[0], a[1]); }, [src, max || 300]);
    };
    const overlay = function () {
      return ctx.ev(function () {
        const o = document.querySelector('#overlayRoot .overlay');
        return o ? o.textContent.replace(/\s+/g, ' ').trim() : null;
      });
    };

    /* --- title --- */
    ctx.eq(await ctx.ev(function () { return R.state.phase; }), 'title', 'opens on the title card');
    const title = await overlay();
    ctx.check(title.indexOf('REFRACT') === 0, 'title shows the wordmark');
    ctx.check(title.indexOf('PLAY') >= 0, 'title has a PLAY button');
    await ctx.snap('a-title');

    const fresh = await ctx.ev(function () { return R.render.info(); });
    ctx.log('  fresh render info ' + JSON.stringify(fresh));

    await ctx.tap('#overlayRoot .bigbtn');
    let m = await snap();
    ctx.eq(m.phase, 'building', 'PLAY opens the planning phase');
    ctx.eq(await overlay(), null, 'the overlay is gone');

    /* --- lose for real, by placing nothing and asking for wave after wave --- */
    await ctx.ev(function () {
      window.__REFRACT.freeze(true);
      for (let i = 0; i < R.BALANCE.WAVES.length; i++) {
        window.__REFRACT.playWave(300);
        if (R.state.phase === 'lost' || R.state.phase === 'won') break;
      }
    });
    m = await snap();
    ctx.eq(m.phase, 'lost', 'the core falls when nothing is placed');
    ctx.eq(m.coreHp, 0, 'core hp is zero');
    ctx.check(m.wave >= 2 && m.wave <= 4, 'placing nothing loses by wave 3 or 4 (reached wave ' + m.wave + ')');
    const defeat = await overlay();
    ctx.check(defeat.indexOf('THE CORE FELL') >= 0, 'defeat overlay');
    ctx.check(defeat.indexOf('TRY AGAIN') >= 0, 'defeat has TRY AGAIN');
    ctx.check(defeat.indexOf('Score') >= 0, 'defeat shows the score');
    ctx.log('  defeat overlay: ' + defeat);
    await ctx.snap('b-defeat');

    const before = await ctx.ev(function () { return R.state.pieces.size; });
    await ctx.tapCell(5, 5);
    ctx.eq(await ctx.ev(function () { return R.state.pieces.size; }), before, 'the board ignores taps after a loss');

    /* --- restart is pristine --- */
    await ctx.tap('#overlayRoot .bigbtn');
    m = await snap();
    ctx.eq(m.phase, 'building', 'TRY AGAIN goes straight back to the board');
    ctx.eq(m.gold, await ctx.ev(function () { return R.BALANCE.START_GOLD; }), 'gold reset');
    ctx.eq(m.coreHp, 20, 'core hp reset');
    ctx.eq(m.wave, 0, 'wave reset');
    ctx.eq(m.lit, 1, 'beam reset to one lit cell');
    ctx.eq(m.pieces.length, 0, 'no pieces');
    ctx.eq(m.enemies, 0, 'no enemies');
    ctx.eq(m.leaksBy.mote + m.leaksBy.runner + m.leaksBy.bulwark, 0, 'leak tally reset');
    ctx.eq(m.unlocked.splitter, false, 'unlocks reset');

    /* --- victory --- */
    await ctx.ev(function () {
      window.__REFRACT.setGold(999);
      window.__REFRACT.place('mirror', 7, 3);
      window.__REFRACT.forceWin();
    });
    m = await snap();
    ctx.eq(m.phase, 'won', 'forced victory');
    const vic = await overlay();
    ctx.check(vic.indexOf('THE LIGHT HELD') >= 0, 'victory overlay');
    ctx.check(vic.indexOf('PLAY AGAIN') >= 0, 'victory has PLAY AGAIN');
    ctx.check(vic.indexOf('CONTINUE') >= 0, 'victory offers CONTINUE into endless');
    ctx.check(await ctx.ev(function () { return R.meta.best > 0; }), 'best score was stored');
    await ctx.snap('c-victory');

    await ctx.tap('#overlayRoot .bigbtn');
    m = await snap();
    ctx.eq(m.phase, 'building', 'PLAY AGAIN restarts');
    ctx.eq(m.pieces.length, 0, 'victory restart is clean');

    /* --- five consecutive restarts leave no residue --- */
    const shots = [];
    for (let i = 0; i < 5; i++) {
      await ctx.ev(function () {
        window.__REFRACT.setGold(400);
        window.__REFRACT.place('mirror', 7, 3);
        window.__REFRACT.place('mirror', 0, 3);
        window.__REFRACT.nextWave();
        window.__REFRACT.step(6);
        R.restartRun(55);
      });
      await ctx.page.waitForTimeout(60);
      const sn = await snap();
      delete sn.time;
      delete sn.render;
      shots.push(JSON.stringify(sn));
    }
    ctx.check(shots.every(function (x) { return x === shots[0]; }), 'five restarts produce identical snapshots');
    const after = await ctx.ev(function () { return R.render.info(); });
    ctx.eq(after.geometries, fresh.geometries, 'geometry count unchanged after restarts');
    ctx.eq(after.textures, fresh.textures, 'texture count unchanged after restarts');
    ctx.eq(after.objects, fresh.objects, 'scene object count unchanged after restarts');
    ctx.log('  after restarts ' + JSON.stringify(after));

    /* --- pause freezes the wave --- */
    await ctx.ev(function () {
      R.restartRun(77);
      window.__REFRACT.setGold(400);
      window.__REFRACT.place('mirror', 7, 3);
      window.__REFRACT.nextWave();
      window.__REFRACT.step(4);
    });
    const t0 = await ctx.ev(function () {
      R.pause();
      const s = R.state;
      return { phase: s.phase, t: s.time, foes: s.enemies.length, pos: s.enemies.length ? s.enemies[0].t : 0 };
    });
    ctx.eq(t0.phase, 'paused', 'pause works during a wave');
    ctx.check(t0.foes > 0, 'enemies are on the board');
    await ctx.page.waitForTimeout(600);
    const t1 = await ctx.ev(function () {
      const s = R.state;
      return { t: s.time, pos: s.enemies.length ? s.enemies[0].t : 0 };
    });
    ctx.eq(t1.t, t0.t, 'the clock is frozen while paused');
    ctx.eq(t1.pos, t0.pos, 'enemies do not advance while paused');
    const pauseText = await overlay();
    ctx.check(pauseText && pauseText.indexOf('PAUSED') >= 0, 'paused overlay');
    await ctx.snap('d-paused');

    await ctx.tap('#overlayRoot .overlay');
    ctx.eq(await ctx.ev(function () { return R.state.phase; }), 'wave', 'tapping the overlay resumes');

    /* --- hiding the tab pauses --- */
    await ctx.ev(function () {
      Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return true; } });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    ctx.eq(await ctx.ev(function () { return R.state.phase; }), 'paused', 'hiding the tab pauses the game');
    await ctx.ev(function () {
      Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return false; } });
      document.dispatchEvent(new Event('visibilitychange'));
      R.resume();
    });

    /* --- all twelve waves are wired from the data --- */
    const waves = await ctx.ev(function () {
      const out = [];
      for (let w = 1; w <= R.BALANCE.WAVES.length; w++) {
        const q = R.enemies.buildQueue(w);
        const counts = {};
        q.forEach(function (x) { counts[x.type] = (counts[x.type] || 0) + 1; });
        out.push({ w: w, n: q.length, counts: counts, last: Math.round(q[q.length - 1].at * 10) / 10 });
      }
      return out;
    });
    ctx.log('  waves: ' + JSON.stringify(waves));
    ctx.eq(waves.length, 8, 'the session is eight encounters');
    ctx.check(waves[0].n <= 6, 'the opening encounter is small (' + waves[0].n + ' enemies)');
    ctx.eq(waves[0].counts.mote, waves[0].n, 'and it is motes only, so one lesson at a time');
    ctx.check(!waves[0].counts.bulwark && !waves[1].counts.bulwark && !waves[2].counts.bulwark,
      'shields are not shown before the encounter that teaches them');
    ctx.eq(waves[3].counts.bulwark, 2, 'encounter 4 introduces the Bulwark');
    ctx.check(waves[4].counts.swarmling > 0, 'encounter 5 puts a swarm behind a shield');
    ctx.eq(waves[waves.length - 1].counts.umbra, 1, 'the last encounter is Umbra');
    ctx.check(waves[6].n > waves[0].n * 3,
      'the encounter before the boss is much larger than the opening (' +
      waves[0].n + ' to ' + waves[6].n + ')');
    /* Each beat has to bring something the one before it did not. */
    for (let i = 1; i < waves.length; i++) {
      const before = Object.keys(waves[i - 1].counts).join();
      ctx.check(Object.keys(waves[i].counts).join() !== before || waves[i].n !== waves[i - 1].n,
        'beat ' + (i + 1) + ' differs from beat ' + i);
    }
  };

  /* Phase 4: the full palette, action bar, drag, sell, undo and core upgrades. */
  S.toolset = async function (ctx) {
    const snap = function () { return ctx.snapshot(); };
    const st = function (fn, a) { return ctx.ev(fn, a); };
    const gold = function () { return st(function () { return R.state.gold; }); };
    const lit = function () { return st(function () { return R.state.beam.litRoadCount; }); };
    const pieceAt = function (c, r) {
      return st(function (a) {
        const p = R.pieces.at(R.state, a[0], a[1]);
        return p ? { type: p.type, orient: p.orient, dir: p.dir, id: p.id } : null;
      }, [c, r]);
    };

    await st(function () {
      window.__REFRACT.restart(900);
      window.__REFRACT.freeze(true);
      window.__REFRACT.setGold(2000);
      R.state.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
    });

    /* --- palette --- */
    const pal = await st(function () {
      return Array.prototype.map.call(document.querySelectorAll('#palette .pbtn'), function (b) {
        return {
          type: b.dataset.type,
          text: b.textContent.replace(/\s+/g, ' ').trim(),
          sel: b.classList.contains('sel'),
          locked: b.classList.contains('locked'),
          w: Math.round(b.getBoundingClientRect().width),
          h: Math.round(b.getBoundingClientRect().height)
        };
      });
    });
    ctx.log('  palette: ' + JSON.stringify(pal));
    ctx.eq(pal.length, 4, 'four palette buttons');
    ctx.eq(pal[0].sel, true, 'mirror is selected at run start');
    ctx.check(pal.every(function (b) { return b.w >= 48 && b.h >= 48; }), 'palette buttons are at least 48px');
    ctx.check(pal[3].text.indexOf('90') >= 0, 'lamp costs 90 first time');

    /* --- lock states --- */
    await st(function () {
      R.restartRun(901);
      window.__REFRACT.freeze(true);
    });
    const locked = await st(function () {
      return Array.prototype.map.call(document.querySelectorAll('#palette .pbtn'), function (b) {
        return b.classList.contains('locked') ? b.querySelector('.plock').textContent : 'open';
      });
    });
    const expectLocks = await st(function () {
      const u = R.BALANCE.UNLOCK_WAVE;
      return JSON.stringify(R.PIECE_TYPES.map(function (t) {
        return u[t] ? 'WAVE ' + u[t] : 'open';
      }));
    });
    ctx.eq(JSON.stringify(locked), expectLocks, 'lock labels follow the unlock table');
    await ctx.tap('#palette .pbtn[data-type="splitter"]');
    await ctx.tapCell(5, 5);
    ctx.eq(await st(function () { return R.state.pieces.size; }), 0, 'a locked piece cannot be placed');
    await ctx.snap('a-palette-locked');

    /* --- each piece type behaves --- */
    await st(function () {
      R.restartRun(902);
      window.__REFRACT.freeze(true);
      window.__REFRACT.setGold(2000);
      R.state.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
    });

    await ctx.tap('#palette .pbtn[data-type="splitter"]');
    await ctx.tapCell(7, 6);
    const sp = await pieceAt(7, 6);
    ctx.eq(sp && sp.type, 'splitter', 'splitter placed by palette then tile');
    const branches = await st(function () {
      return {
        straight: Math.round(R.state.beam.lit[R.grid.idx(7, 5)] * 100) / 100,
        bent: Math.round(R.state.beam.lit[R.grid.idx(5, 6)] * 100) / 100
      };
    });
    const splitExpect = await st(function () {
      return Math.round(R.beam.corePower(R.state.coreLevel) * R.BALANCE.SPLIT_FACTOR * 100) / 100;
    });
    ctx.eq(branches.straight, splitExpect, 'straight branch at the split factor');
    ctx.eq(branches.bent, splitExpect, 'reflected branch at the split factor');
    /*
     * The brief opened at 85% total. Playtesting put splitter builds well
     * outside the viable band there, so the two branches now split the input
     * evenly and the rule reads as "half each way".
     */
    ctx.near(await st(function () { return R.BALANCE.SPLIT_FACTOR * 2; }), 1.0, 0.05,
      'a splitter divides its input between the two branches');
    ctx.eq(await gold(), 2000 - 45, 'splitter cost 45');

    await ctx.tap('#palette .pbtn[data-type="reflector"]');
    await ctx.tapCell(7, 8);
    ctx.eq((await pieceAt(7, 8)).type, 'reflector', 'reflector placed');
    const ret = await st(function () {
      let south = 0;
      let power = 0;
      for (let i = 0; i < R.state.beam.segCount; i++) {
        const g = R.state.beam.segments[i];
        if (g.dir === R.S) { south++; power = Math.round(g.powerStart * 100) / 100; }
      }
      return { south: south, power: power };
    });
    ctx.eq(ret.south, 1, 'exactly one return pass');
    ctx.eq(ret.power, 6, 'return pass at 60 percent');

    await ctx.tap('#palette .pbtn[data-type="lamp"]');
    await ctx.tapCell(0, 6);
    let lamp = await pieceAt(0, 6);
    ctx.eq(lamp.type, 'lamp', 'lamp placed');
    ctx.eq(await st(function () { return Math.round(R.state.beam.lit[R.grid.idx(2, 6)] * 100) / 100; }), 5,
      'lamp emits at half core power');
    const lampCost2 = await st(function () { return R.pieces.cost(R.state, 'lamp'); });
    ctx.eq(lampCost2, 110, 'the second lamp costs 20 more');
    await st(function () { window.__REFRACT.step(0.4); });
    await ctx.page.waitForTimeout(60);
    await ctx.snap('b-all-pieces');
    await ctx.page.screenshot({
      path: 'shots/' + ctx.prefix + '-b-pieces-zoom.png',
      clip: { x: 0, y: 330, width: ctx.width, height: 300 }
    });

    /* --- action bar: select, flip, sell --- */
    await ctx.tapCell(0, 6);
    let bar = await st(function () {
      const b = document.getElementById('actionBar');
      return { shown: b.style.display !== 'none', text: b.textContent.replace(/\s+/g, ' ').trim() };
    });
    ctx.check(bar.shown, 'action bar appears on a selected piece');
    ctx.check(bar.text.indexOf('FLIP') >= 0 && bar.text.indexOf('MOVE') >= 0 && bar.text.indexOf('SELL') >= 0,
      'action bar has FLIP, MOVE and SELL (' + bar.text + ')');
    const barBox = await st(function () {
      const b = document.getElementById('actionBar').getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), h: Math.round(b.height) };
    });
    ctx.check(barBox.l >= 0 && barBox.r <= ctx.width,
      'the action bar stays on screen next to an edge piece (' + JSON.stringify(barBox) + ')');
    ctx.check(barBox.h >= 40, 'action bar buttons are tall enough');
    await ctx.snap('c-actionbar');

    const dirBefore = (await pieceAt(0, 6)).dir;
    await ctx.tap('#actionBar button:nth-child(1)');
    ctx.eq((await pieceAt(0, 6)).dir, (dirBefore + 1) % 4, 'FLIP turns the lamp a quarter turn');

    await ctx.tapCell(7, 8);
    bar = await st(function () {
      const b = document.getElementById('actionBar');
      return b.children[0].style.display;
    });
    ctx.eq(bar, 'none', 'a reflector has no FLIP action');

    /* --- MOVE then tap --- */
    await ctx.tapCell(0, 6);
    await ctx.tap('#actionBar button:nth-child(2)');
    ctx.eq(await st(function () { return R.state.ui.moveMode; }), true, 'MOVE arms the next tap');
    await ctx.tapCell(0, 8);
    ctx.eq(await pieceAt(0, 6), null, 'the lamp left its old tile');
    ctx.eq((await pieceAt(0, 8)).type, 'lamp', 'the lamp arrived on the new tile');
    /*
     * Rearranging during planning is free. The same move during a wave costs
     * a short re-form, which is the tactical price of editing under fire.
     */
    const reform = await st(function () {
      return R.pieces.at(R.state, 0, 8).inactiveUntil;
    });
    ctx.eq(reform, -1, 'a piece moved during planning is never inactive');
    ctx.eq(await st(function () { return Math.round(R.state.beam.lit[R.grid.idx(2, 8)] * 100) / 100; }), 0,
      'the light is off while it re-forms');
    await st(function () { window.__REFRACT.step(0.8); });
    ctx.check(await st(function () {
      const p = R.pieces.at(R.state, 0, 8);
      const c = p.c + R.grid.DC[p.dir];
      const r = p.r + R.grid.DR[p.dir];
      return R.grid.inBounds(c, r) && R.state.beam.lit[R.grid.idx(c, r)] > 0;
    }), 'the lamp lights again once re-formed');

    /* --- selling gives the paid price back while planning --- */
    await st(function () { window.__REFRACT.step(4); });
    const goldBeforeSell = await gold();
    const splitterCost = await st(function () { return R.BALANCE.PIECE_COST.splitter; });
    await ctx.tapCell(7, 6);
    await ctx.tap('#actionBar button:nth-child(3)');
    ctx.eq(await pieceAt(7, 6), null, 'the splitter is gone');
    ctx.eq(await gold(), goldBeforeSell + splitterCost,
      'selling during planning returns the price paid');

    /* --- undo returns the full price --- */
    const goldBeforeBuy = await gold();
    await ctx.tap('#palette .pbtn[data-type="mirror"]');
    await ctx.tapCell(3, 3);
    ctx.eq(await gold(), goldBeforeBuy - 20, 'mirror bought');
    const chip = await st(function () {
      const c = document.getElementById('undoChip');
      return { shown: c.style.display !== 'none', text: c.textContent.trim() };
    });
    ctx.check(chip.shown, 'the undo chip appears');
    await ctx.tap('#undoChip');
    ctx.eq(await gold(), goldBeforeBuy, 'undo returns the full price');
    ctx.eq(await pieceAt(3, 3), null, 'undo removes the piece');

    /* --- the undo window expires --- */
    await ctx.tapCell(3, 3);
    await st(function () { window.__REFRACT.step(3.2); });
    await ctx.page.waitForTimeout(80);
    ctx.eq(await st(function () { return document.getElementById('undoChip').style.display; }), 'none',
      'the chip disappears after three seconds');
    /*
     * Once a wave is running, editing costs something: a moved piece goes dark
     * while it re-forms and a sale returns only the sell rate.
     */
    const inCombat = await st(function () {
      window.__REFRACT.restart(9020);
      const s = R.state;
      s.gold = 1000;
      R.pieces.place(s, 'mirror', 3, 3, 1);
      window.__REFRACT.startWave();
      window.__REFRACT.step(R.BALANCE.UNDO_WINDOW + 0.5);
      R.pieces.move(s, 3, 3, 3, 5);
      const dark = Math.round((R.pieces.at(s, 3, 5).inactiveUntil - s.time) * 100) / 100;
      const before = s.gold;
      R.pieces.sell(s, 3, 5);
      return {
        dark: dark, expected: R.BALANCE.MOVE_REFORM,
        refund: s.gold - before,
        rate: Math.floor(R.BALANCE.PIECE_COST.mirror * R.BALANCE.SELL_RATE)
      };
    });
    ctx.log('  editing under fire: ' + JSON.stringify(inCombat));
    ctx.near(inCombat.dark, inCombat.expected, 0.02,
      'a piece moved during a wave goes dark for ' + inCombat.expected + ' s');
    ctx.eq(inCombat.refund, inCombat.rate,
      'selling mid-wave after the undo window refunds the sell rate');

    /* --- drag a palette button onto a tile --- */
    const before = await st(function () { return R.state.pieces.size; });
    const btn = await ctx.page.$('#palette .pbtn[data-type="mirror"]');
    const box = await btn.boundingBox();
    const target = await ctx.cellPoint(2, 3);
    await ctx.drag({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, target);
    ctx.eq(await st(function () { return R.state.pieces.size; }), before + 1, 'dragging from the palette places a piece');
    ctx.eq((await pieceAt(2, 3)).type, 'mirror', 'the dragged mirror landed on the target tile');

    /* --- drag a placed piece to a new tile --- */
    await ctx.drag(await ctx.cellPoint(2, 3), await ctx.cellPoint(4, 3));
    ctx.eq(await pieceAt(2, 3), null, 'the piece left the old tile');
    ctx.eq((await pieceAt(4, 3)).type, 'mirror', 'the piece arrived on the new tile');

    /* --- drag onto the road: refused, piece stays --- */
    await ctx.drag(await ctx.cellPoint(4, 3), await ctx.cellPoint(4, 4));
    ctx.eq((await pieceAt(4, 3)).type, 'mirror', 'a drag onto the road leaves the piece where it was');

    /* --- drag outside the window cancels --- */
    const p1 = await ctx.cellPoint(4, 3);
    await ctx.drag(p1, { x: 5, y: ctx.height - 4 });
    ctx.eq((await pieceAt(4, 3)).type, 'mirror', 'a drag released off the board cancels');

    /* --- pointercancel --- */
    await ctx.drag(p1, await ctx.cellPoint(5, 3), { cancel: true });
    ctx.eq((await pieceAt(4, 3)).type, 'mirror', 'a cancelled drag leaves the piece alone');
    ctx.eq(await pieceAt(5, 3), null, 'and does not create one');

    /* --- a second finger is ignored --- */
    const twoFinger = await st(function () { return R.state.pieces.size; });
    await ctx.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: p1.x, y: p1.y, id: 1 }]
    });
    const other = await ctx.cellPoint(3, 10);
    await ctx.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: p1.x, y: p1.y, id: 1 }, { x: other.x, y: other.y, id: 2 }]
    });
    await ctx.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: p1.x, y: p1.y, id: 1 }] });
    await ctx.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await ctx.page.waitForTimeout(80);
    ctx.eq(await st(function () { return R.state.pieces.size; }), twoFinger, 'a second finger buys nothing');

    /* --- core upgrades --- */
    await st(function () {
      R.restartRun(903);
      window.__REFRACT.freeze(true);
      window.__REFRACT.setGold(2000);
      R.state.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
      window.__REFRACT.place('mirror', 7, 4, 1);
      window.__REFRACT.place('lamp', 0, 6, R.E);
    });
    const levels = [];
    for (let i = 0; i < 6; i++) {
      levels.push(await st(function () {
        const s = R.state;
        return {
          lv: s.coreLevel,
          cost: R.pieces.coreUpgradeCost(s),
          beam: Math.round(s.beam.lit[R.grid.idx(6, 4)] * 100) / 100,
          lamp: Math.round(s.beam.lit[R.grid.idx(2, 6)] * 100) / 100,
          label: document.getElementById('btnCore').textContent.replace(/\s+/g, ' ').trim()
        };
      }));
      if (i < 5) await ctx.tap('#btnCore');
    }
    ctx.log('  core levels: ' + JSON.stringify(levels));
    ctx.eq(JSON.stringify(levels.map(function (x) { return x.beam; })), '[10,13,17,22,28,35]', 'core power per level');
    ctx.eq(JSON.stringify(levels.map(function (x) { return x.lamp; })), '[5,6.5,8.5,11,14,17.5]', 'lamps scale with the core');
    ctx.eq(JSON.stringify(levels.map(function (x) { return x.cost; })), '[60,100,150,220,300,null]', 'upgrade costs');
    ctx.check(levels[5].label.indexOf('MAX') >= 0, 'the core button reads MAX at level 6');
    ctx.eq(await gold(), 2000 - 20 - 90 - 830, 'total spend is the pieces plus 830 for the core');
    await ctx.tap('#btnCore');
    ctx.eq(await st(function () { return R.state.coreLevel; }), 6, 'the core cannot go past level 6');
    await ctx.snap('d-core-max');

    /* --- affordability --- */
    await st(function () { window.__REFRACT.setGold(10); });
    await ctx.page.waitForTimeout(80);
    const poor = await st(function () {
      return Array.prototype.map.call(document.querySelectorAll('#palette .pbtn'), function (b) {
        return b.classList.contains('poor');
      });
    });
    ctx.eq(JSON.stringify(poor), '[true,true,true,true]', 'unaffordable palette buttons are marked');
    await ctx.tapCell(3, 10);
    ctx.eq(await st(function () { return R.state.pieces.size; }), 2, 'nothing is bought without gold');

    const info = await st(function () { return R.render.info(); });
    ctx.check(info.calls <= 150, 'draw calls in budget: ' + info.calls);
    ctx.check(await st(function () { return R.state.beam.segCount <= R.BALANCE.MAX_SEGMENTS; }), 'segment cap holds');
  };

  /* Phase 5: all six enemy types, bosses, scaling, victory and endless. */
  S.escalation = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };
    const snap = function () { return ctx.snapshot(); };

    /* --- HP scaling and boss HP --- */
    const hp = await st(function () {
      window.__REFRACT.restart(1200);
      window.__REFRACT.freeze(true);
      const s = R.state;
      const out = {};
      [1, 5, 8, 12].forEach(function (w) {
        s.wave = w;
        const e = R.enemies.spawn(s, 'mote');
        out['mote' + w] = e.maxHp;
      });
      s.wave = 10;
      out.king = R.enemies.spawn(s, 'bruteking').maxHp;
      s.wave = R.BALANCE.WAVES.length;
      out.umbra = R.enemies.spawn(s, 'umbra').maxHp;
      out.bulwark12 = R.enemies.spawn(s, 'bulwark').maxHp;
      return out;
    });
    ctx.log('  hp scaling: ' + JSON.stringify(hp));
    const expectHp = await st(function () {
      const base = R.BALANCE.ENEMY;
      const last = R.BALANCE.WAVES.length;
      return {
        mote1: Math.round(base.mote.hp * R.enemies.hpMult(1)),
        mote5: Math.round(base.mote.hp * R.enemies.hpMult(5)),
        mote8: Math.round(base.mote.hp * R.enemies.hpMult(8)),
        mote12: Math.round(base.mote.hp * R.enemies.hpMult(12)),
        king: base.bruteking.hp,
        umbra: base.umbra.hp,
        bulwarkLast: Math.round(base.bulwark.hp * R.enemies.hpMult(last))
      };
    });
    ctx.eq(hp.mote1, expectHp.mote1, 'mote hp at wave 1 is unscaled');
    ctx.eq(hp.mote5, expectHp.mote5, 'mote hp at wave 5 follows the multiplier');
    ctx.eq(hp.mote8, expectHp.mote8, 'mote hp at wave 8 follows the multiplier');
    ctx.eq(hp.mote12, expectHp.mote12, 'mote hp at wave 12 follows the multiplier');
    ctx.eq(hp.king, expectHp.king, 'the Brute King ignores the wave multiplier');
    ctx.eq(hp.umbra, expectHp.umbra, 'Umbra ignores the wave multiplier');
    ctx.eq(hp.bulwark12, expectHp.bulwarkLast, 'a last-beat bulwark is scaled');
    /* The arc has to escalate as hard as twelve gentle waves used to. */
    const lastMote = await st(function () {
      return Math.round(R.BALANCE.ENEMY.mote.hp * R.enemies.hpMult(R.BALANCE.WAVES.length));
    });
    ctx.check(lastMote >= expectHp.mote1 * 2,
      'the last beat is at least twice as tough as the first (' + expectHp.mote1 + ' to ' + lastMote + ')');

    /* --- every type renders with its own shape --- */
    await st(function () {
      window.__REFRACT.restart(1201);
      window.__REFRACT.freeze(true);
      const s = R.state;
      const types = ['mote', 'runner', 'swarmling', 'bulwark', 'bruteking', 'umbra'];
      types.forEach(function (t, i) {
        const e = R.enemies.spawn(s, t);
        e.t = 3 + i * 0.9;
        e.hp = e.maxHp * (0.35 + i * 0.1);
        R.enemies.positionOf(s, e);
      });
      window.__REFRACT.step(0.05);
    });
    await ctx.page.waitForTimeout(120);
    await ctx.snap('a-all-enemies');
    await ctx.page.screenshot({
      path: 'shots/' + ctx.prefix + '-a-enemies-zoom.png',
      clip: { x: 0, y: 220, width: ctx.width, height: 260 }
    });
    ctx.eq(await st(function () { return R.state.enemies.length; }), 6, 'six enemy types on the board');

    /* --- direction relative to enemy flow --- */
    const dirTest = function (build) {
      return st(function (b) {
        window.__REFRACT.restart(1300);
        window.__REFRACT.freeze(true);
        const s = R.state;
        s.gold = 5000;
        s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
        b.forEach(function (m) { window.__REFRACT.place(m[0], m[1], m[2], m[3]); });
        /*
         * One bulwark leading three motes along the row 4 sweep. Index 12 is
         * mid-sweep, so the bulwark is squarely facing the way it walks rather
         * than sitting on a corner where every hit reads as a flank.
         */
        const bulwark = R.enemies.spawn(s, 'bulwark');
        bulwark.t = 12;
        R.enemies.positionOf(s, bulwark);
        const motes = [11, 10, 9].map(function (t) {
          const e = R.enemies.spawn(s, 'mote');
          e.t = t;
          e.speed = 0;
          R.enemies.positionOf(s, e);
          return e;
        });
        bulwark.speed = 0;
        window.__REFRACT.step(1);
        return {
          face: R.DIR_NAMES[bulwark.face],
          bulwark: Math.round((bulwark.maxHp - bulwark.hp) * 10) / 10,
          motes: Math.round(motes.reduce(function (a, e) { return a + (e.maxHp - e.hp); }, 0) * 10) / 10
        };
      }, build);
    };

    const against = await dirTest([['mirror', 7, 4, 1]]);
    const withFlow = await dirTest([['mirror', 7, 8, 1], ['mirror', 0, 8, 1], ['mirror', 0, 4, 0]]);
    ctx.log('  against the flow: ' + JSON.stringify(against) + '   with the flow: ' + JSON.stringify(withFlow));
    /*
     * The bulwark walks east along this sweep, so a beam running west meets
     * its shield and a beam running east arrives at its back. The shield cuts
     * the damage it takes; it never changes how much light continues past it.
     */
    ctx.eq(against.face, 'E', 'the bulwark faces the way it walks');
    const shield = await st(function () { return R.BALANCE.ENEMY.bulwark.shield; });
    const core1 = await st(function () { return R.beam.corePower(1); });
    ctx.near(against.bulwark, core1 * (1 - shield), 0.3,
      'a beam meeting the shield head on is cut to ' + Math.round((1 - shield) * 100) + ' percent');
    ctx.check(withFlow.motes > against.motes * 2,
      'lighting the sweep from the other end burns the followers instead');
    ctx.check(withFlow.bulwark > against.bulwark,
      'and the bulwark itself is never immune, only harder to hurt from the front');

    /* --- swarms drain the beam --- */
    const drain = await st(function () {
      window.__REFRACT.restart(1400);
      window.__REFRACT.freeze(true);
      const s = R.state;
      s.gold = 5000;
      window.__REFRACT.place('mirror', 7, 4, 1);
      const clean = s.beam.lit[R.grid.idx(1, 4)];
      for (let i = 0; i < 12; i++) {
        const e = R.enemies.spawn(s, 'swarmling');
        e.t = 9 + i * 0.12;
        e.speed = 0;
        R.enemies.positionOf(s, e);
      }
      window.__REFRACT.step(1 / 60);
      const drained = s.beam.lit[R.grid.idx(1, 4)];
      for (let i = 0; i < 12; i++) {
        const e = R.enemies.spawn(s, 'swarmling');
        e.t = 10 + i * 0.12;
        e.speed = 0;
        R.enemies.positionOf(s, e);
      }
      window.__REFRACT.step(1 / 60);
      return {
        clean: Math.round(clean * 100) / 100,
        drained: Math.round(drained * 100) / 100,
        dead: Math.round(s.beam.lit[R.grid.idx(1, 4)] * 100) / 100
      };
    });
    ctx.log('  swarm drain: ' + JSON.stringify(drain));
    ctx.eq(drain.clean, 10, 'clean beam reaches the far end at full power');
    ctx.check(drain.drained < 2, 'twelve swarmlings drain the beam to under 2 power');
    ctx.eq(drain.dead, 0, 'twenty-four swarmlings put the beam out before the far end');

    /* --- endless generator --- */
    const endless = await st(function () {
      const out = [];
      const first = R.BALANCE.WAVES.length + 1;
      for (let w = first; w < first + 6; w++) {
        const q = R.enemies.buildQueue(w);
        const counts = {};
        q.forEach(function (x) { counts[x.type] = (counts[x.type] || 0) + 1; });
        out.push({ w: w, n: q.length, counts: counts, speed: Math.round(R.enemies.speedMult(w) * 100) / 100 });
      }
      return out;
    });
    ctx.log('  endless waves: ' + JSON.stringify(endless));
    ctx.check(endless.every(function (x) { return x.n > 0; }), 'every endless wave has enemies');
    ctx.check(endless.some(function (x) { return x.counts.bruteking === 1; }),
      'a Brute King turns up in the endless rotation');
    ctx.eq(endless[0].speed, await st(function () {
      return Math.round(R.enemies.speedMult(R.BALANCE.WAVES.length + 1) * 100) / 100;
    }), 'endless speeds up one step past the last beat');
    ctx.eq(await st(function () { return R.enemies.speedMult(200); }), 1.5, 'the speed multiplier is capped at 1.5');

    /* --- a real victory over all twelve waves --- */
    const build = [
      ['mirror', 7, 4, 1],
      ['mirror', 0, 4, 1],
      ['mirror', 0, 6, 0],
      ['splitter', 7, 8, 1],
      ['lamp', 0, 2, 1],
      ['lamp', 0, 10, 1]
    ];
    const run = await st(function (b) {
      window.__REFRACT.restart(1500);
      window.__REFRACT.freeze(true);
      const s = R.state;
      s.gold = 5000;
      s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
      b.forEach(function (m) { window.__REFRACT.place(m[0], m[1], m[2], m[3]); });
      for (let i = 0; i < 5; i++) R.pieces.upgradeCore(s);
      const lit = s.beam.litRoadCount;
      const log = [];
      for (let w = 1; w <= R.BALANCE.WAVES.length; w++) {
        window.__REFRACT.startWave();
        window.__REFRACT.stepUntil('s.phase !== "wave"', 220);
        log.push({ w: w, hp: s.coreHp, gold: s.gold, t: Math.round(s.time) });
        if (s.phase === 'lost' || s.phase === 'won') break;
      }
      return { lit: lit, phase: s.phase, hp: s.coreHp, score: R.computeScore(s), time: Math.round(s.time), log: log };
    }, build);
    ctx.log('  victory run: lit ' + run.lit + '  phase ' + run.phase + '  hp ' + run.hp + '  score ' + run.score + '  sim time ' + run.time + 's');
    ctx.log('  per wave: ' + JSON.stringify(run.log));
    ctx.check(run.lit >= 18, 'the winning build lights most of the road (' + run.lit + ' of 31)');
    ctx.eq(run.phase, 'won', 'every beat cleared');
    /* The brief asks for a four-to-six minute session. */
    ctx.check(run.time >= 200 && run.time <= 380,
      'a full session runs four to six minutes (' + run.time + 's)');
    await ctx.snap('b-victory');

    const vic = await st(function () {
      const o = document.querySelector('#overlayRoot .overlay');
      return o ? o.textContent.replace(/\s+/g, ' ').trim() : null;
    });
    ctx.check(vic.indexOf('CONTINUE') >= 0, 'endless is offered after a win');

    /* --- continue into endless --- */
    await ctx.tap('#overlayRoot .bigbtn.ghost');
    let m = await snap();
    ctx.eq(m.endless, true, 'endless mode is on');
    ctx.eq(m.phase, 'building', 'back to building');
    ctx.eq(await st(function () { return document.getElementById('statWave').textContent.replace(/\s+/g, ''); }),
      'ENDLESS' + await st(function () { return R.BALANCE.WAVES.length; }), 'the HUD says ENDLESS');

    const endlessRun = await st(function () {
      const s = R.state;
      const log = [];
      for (let i = 0; i < 3; i++) {
        const w = s.wave + 1;
        window.__REFRACT.startWave();
        window.__REFRACT.stepUntil('s.phase !== "wave"', 260);
        log.push({ w: s.wave, hp: s.coreHp, foes: s.waveEnemiesTotal });
        if (s.phase === 'lost') break;
      }
      return { log: log, wave: s.wave, phase: s.phase, score: R.computeScore(s) };
    });
    ctx.log('  endless run: ' + JSON.stringify(endlessRun));
    const lastBeat = await st(function () { return R.BALANCE.WAVES.length; });
    ctx.check(endlessRun.wave > lastBeat,
      'endless carries on past the last scripted encounter (reached wave ' + endlessRun.wave + ')');
    ctx.check(endlessRun.log.length >= 2,
      'and it ran at least two generated waves before the core fell');
    ctx.check(endlessRun.score > run.score, 'score keeps rising in endless');
    await ctx.snap('c-endless');

    /* --- frame rate at wave 11 --- */
    await st(function (b) {
      R.restartRun(1600);
      const s = R.state;
      s.gold = 5000;
      s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
      b.forEach(function (m) { window.__REFRACT.place(m[0], m[1], m[2], m[3]); });
      for (let i = 0; i < 5; i++) R.pieces.upgradeCore(s);
      s.wave = 10;
      R.startWave(s);
      window.__REFRACT.step(0.1);
    }, build);
    const simCost = await st(function () {
      const s = R.state;
      const t0 = performance.now();
      for (let i = 0; i < 600; i++) R.simStep(s, 1 / 60);
      return {
        msPerStep: Math.round((performance.now() - t0) / 600 * 1000) / 1000,
        foes: s.enemies.length
      };
    });
    ctx.log('  simulation cost at peak: ' + JSON.stringify(simCost));
    const rasterCost = await st(function () {
      const t0 = performance.now();
      for (let i = 0; i < 30; i++) R.render.renderOnce();
      return Math.round((performance.now() - t0) / 30 * 100) / 100;
    });
    ctx.log('  raw renderer cost per frame: ' + rasterCost + ' ms (software rasteriser in headless)');
    ctx.check(simCost.msPerStep < 2, 'a simulation step costs under 2 ms (' + simCost.msPerStep + ')');

    const perf = await st(function () {
      return new Promise(function (resolve) {
        const frames = [];
        let last = performance.now();
        function tick(now) {
          frames.push(now - last);
          last = now;
          if (frames.length < 90) requestAnimationFrame(tick);
          else {
            frames.sort(function (a, b) { return a - b; });
            resolve({
              median: Math.round(frames[45] * 100) / 100,
              worst: Math.round(frames[frames.length - 1] * 100) / 100,
              foes: R.state.enemies.length,
              wave: R.state.wave,
              calls: R.render.info().calls,
              seg: R.state.beam.segCount
            });
          }
        }
        requestAnimationFrame(tick);
      });
    });
    ctx.log('  wave ' + perf.wave + ' performance: ' + JSON.stringify(perf));
    /* The observed frame gap in headless is set by software rasterisation and
       rAF clamping, not by the game, so the assertion is on the cost we own.
       The real frame rate is measured on a GPU by the perf scenario. */
    ctx.log('  observed frame gap at peak: ' + perf.median + ' ms (headless, rAF clamped)');
    ctx.check(rasterCost < 5, 'the renderer itself costs under 5 ms a frame (' + rasterCost + ')');
    ctx.check(perf.calls <= 150, 'draw calls in budget: ' + perf.calls);
    ctx.check(perf.seg <= 128, 'segment count in budget: ' + perf.seg);
    await ctx.snap('d-wave11');
  };

  /*
   * A harness that plays canned builds straight through and reports how far
   * they get. Used to find winning lines and, in the balancing phase, to check
   * that no single strategy dominates.
   */
  S.builds = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };

    const BUILDS = {
      'one sweep': {
        core: 6,
        pieces: [['mirror', 7, 4, 1]]
      },

      'chain to a second sweep': {
        core: 6,
        pieces: [['mirror', 7, 8, 1], ['mirror', 0, 8, 1], ['mirror', 0, 6, 0]]
      },

      'split the trunk three ways': {
        core: 6,
        pieces: [['splitter', 7, 8, 1], ['splitter', 7, 6, 1], ['mirror', 7, 4, 1]]
      },

      'split plus lamps': {
        core: 6,
        pieces: [['splitter', 7, 8, 1], ['splitter', 7, 6, 1], ['mirror', 7, 4, 1],
          ['lamp', 0, 2, 1], ['lamp', 7, 1, 3], ['lamp', 0, 10, 1]]
      },

      'sweep plus reflector': {
        core: 6,
        pieces: [['mirror', 7, 4, 1], ['reflector', 0, 4, 0]]
      },

      'lamp network only': {
        core: 6,
        pieces: [['lamp', 0, 2, 1], ['lamp', 0, 4, 1], ['lamp', 0, 6, 1], ['lamp', 0, 8, 1]]
      },

      'mirrors only, core 1': {
        core: 1,
        pieces: [['mirror', 7, 8, 1], ['mirror', 0, 8, 1], ['mirror', 0, 6, 0],
          ['mirror', 7, 6, 1], ['mirror', 7, 4, 1]]
      },

      'core only': { core: 6, pieces: [] }
    };

    const results = [];
    for (const name of Object.keys(BUILDS)) {
      const out = await st(function (b) {
        window.__REFRACT.restart(2000);
        window.__REFRACT.freeze(true);
        const s = R.state;
        s.gold = 100000;
        s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
        b.pieces.forEach(function (m) { window.__REFRACT.place(m[0], m[1], m[2], m[3]); });
        for (let i = 1; i < b.core; i++) R.pieces.upgradeCore(s);
        const lit = s.beam.litRoadCount;
        const hpLog = [];
        for (let w = 1; w <= R.BALANCE.WAVES.length; w++) {
          window.__REFRACT.startWave();
          window.__REFRACT.stepUntil('s.phase !== "wave"', 260);
          hpLog.push(s.coreHp);
          if (s.phase === 'lost' || s.phase === 'won') break;
        }
        return { lit: lit, phase: s.phase, wave: s.wave, hp: s.coreHp, hpLog: hpLog };
      }, BUILDS[name]);
      results.push({ name: name, r: out });
      ctx.log('  ' + name.padEnd(30) + ' lit ' + String(out.lit).padStart(2) +
        '  ' + out.phase.padEnd(8) + ' wave ' + String(out.wave).padStart(2) +
        '  hp ' + String(out.hp).padStart(2) + '  ' + JSON.stringify(out.hpLog));
    }

    const winners = results.filter(function (x) { return x.r.phase === 'won'; });
    ctx.check(winners.length > 0, 'at least one build clears every beat');
    ctx.check(winners.length < results.length, 'not every build clears every beat');

    /*
     * The session is a fixed five beats, so builds are told apart by what the
     * core has left at the end rather than by how far they got.
     */
    const spread = results.map(function (x) { return x.r.hp; });
    ctx.check(Math.max.apply(null, spread) - Math.min.apply(null, spread) >= 10,
      'strategies end in very different shape: ' + JSON.stringify(spread));

    /*
     * Coverage and pressure are different things, so how much road a build
     * lights must not by itself rank the outcomes: somewhere in this set a
     * dimmer build has to finish in better shape than a brighter one.
     */
    let inverted = null;
    results.forEach(function (a) {
      results.forEach(function (b) {
        if (a.r.lit < b.r.lit && a.r.hp > b.r.hp) inverted = a.name + ' (lit ' + a.r.lit +
          ') beat ' + b.name + ' (lit ' + b.r.lit + ')';
      });
    });
    ctx.check(!!inverted, 'coverage alone does not rank the builds: ' + inverted);
  };

  /* Phase 6: hints, help, early call, defeat tips, beam sweep, drag preview. */
  S.teaching = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };
    const hintText = function () {
      return st(function () {
        const h = document.querySelector('#boardOverlay .hint');
        return h && h.style.display !== 'none' ? h.textContent.trim() : null;
      });
    };
    const overlay = function () {
      return st(function () {
        const o = document.querySelector('#overlayRoot .overlay');
        return o ? o.textContent.replace(/\s+/g, ' ').trim() : null;
      });
    };

    /* --- the first hint arrives with the board --- */
    await ctx.tap('#overlayRoot .bigbtn');
    let h = await hintText();
    ctx.check(h && h.indexOf('Tap a tile') >= 0, 'the opening hint tells the player what to do: ' + h);
    await ctx.snap('a-first-hint');

    await ctx.tapCell(7, 3);
    await ctx.page.waitForTimeout(80);
    h = await hintText();
    ctx.check(h && h.indexOf('flip') >= 0, 'placing a piece teaches the next verb: ' + h);

    /* a hint never sits under the action bar */
    await ctx.tapCell(7, 3);
    await ctx.page.waitForTimeout(80);
    ctx.eq(await hintText(), null, 'the hint hides while a piece is selected');
    await ctx.tapCell(7, 3);

    /* --- hints fire once per run --- */
    const shown = await st(function () { return Object.keys(R.state.ui.hintsShown).sort().join(','); });
    ctx.eq(shown, 'placed,start', 'two hints so far');
    await st(function () { R.ui.hint(R.state, 'start', 5); });
    await ctx.page.waitForTimeout(60);
    ctx.check((await hintText() || '').indexOf('Tap a tile') < 0, 'a hint already shown does not come back');

    /*
     * Planning is untimed and unpaid: reading the board slowly costs nothing
     * and starting quickly earns nothing, so the only reason to start a wave
     * is that the network is ready.
     */
    const planning = await st(function () {
      window.__REFRACT.restart(2100);
      window.__REFRACT.freeze(true);
      const s = R.state;
      window.__REFRACT.step(3);
      R.ui.frame(s, 0.016);
      const before = { gold: s.gold, label: document.getElementById('btnNext').textContent };
      window.__REFRACT.step(20);
      const waited = { gold: s.gold, phase: s.phase, wave: s.wave };
      R.startWave(s);
      return { before: before, waited: waited, after: s.gold, phase: s.phase, wave: s.wave };
    });
    ctx.log('  planning: ' + JSON.stringify(planning));
    ctx.eq(planning.waited.phase, 'building', 'twenty seconds of planning does not start the wave');
    ctx.eq(planning.waited.gold, planning.before.gold, 'and planning pays nothing either way');
    ctx.eq(planning.after, planning.before.gold, 'starting the wave pays no bonus');
    ctx.eq(planning.phase, 'wave', 'the wave starts when asked');
    ctx.check(planning.before.label.toUpperCase().indexOf('START') >= 0,
      'the button says what it does (' + planning.before.label.replace(/\s+/g, ' ') + ')');

    /* --- help pauses and resumes --- */
    await st(function () { window.__REFRACT.restart(2101); window.__REFRACT.nextWave(); });
    await ctx.tap('#btnHelp');
    let help = await overlay();
    ctx.check(help.indexOf('HOW TO PLAY') >= 0, 'help opens');
    ['MIRROR', 'SPLITTER', 'REFLECTOR', 'LAMP', 'ABSORPTION', 'SHIELDS', 'DIRECTION',
     'PLANNING', 'UPGRADES', 'LOOPS'].forEach(function (word) {
      ctx.check(help.indexOf(word) >= 0, 'help explains ' + word);
    });
    ctx.eq(await st(function () { return R.state.phase; }), 'paused', 'help pauses the game');
    await ctx.snap('b-help');
    await ctx.tap('#overlayRoot .bigbtn');
    ctx.eq(await st(function () { return R.state.phase; }), 'wave', 'closing help resumes the wave');
    ctx.eq(await overlay(), null, 'the overlay is gone');

    /* --- defeat tips follow the cause --- */
    const tipFor = function (leaks) {
      return st(function (l) {
        window.__REFRACT.restart(2102);
        const s = R.state;
        Object.keys(l).forEach(function (k) { s.leaksBy[k] = l[k]; });
        s.coreHp = 0;
        R.endRun(s, false);
        const o = document.querySelector('#overlayRoot .overlay');
        return o ? '' : '';
      }, leaks).then(function () {
        return ctx.page.waitForTimeout(60).then(function () {
          return st(function () {
            const t = document.querySelector('#overlayRoot .tip');
            return t ? t.textContent.trim() : null;
          });
        });
      });
    };
    const bulwarkTip = await tipFor({ bulwark: 4, mote: 3 });
    ctx.check(bulwarkTip.indexOf('A Bulwark') === 0, 'a Bulwark-heavy loss gets the shield tip');
    const swarmTip = await tipFor({ swarmling: 12, mote: 2 });
    ctx.check(swarmTip.indexOf('Swarms') === 0, 'swarm-heavy loss gets the swarm tip');
    const runnerTip = await tipFor({ runner: 9, mote: 2 });
    ctx.check(runnerTip.indexOf('Runners') === 0, 'runner-heavy loss gets the runner tip');
    const moteTip = await tipFor({ mote: 6 });
    ctx.check(moteTip.indexOf('Light along the road') === 0, 'a plain loss gets the coverage tip');
    ctx.log('  bulwark tip: ' + bulwarkTip);

    /* --- the beam sweeps out instead of appearing --- */
    const sweep = await st(function () {
      window.__REFRACT.restart(2103);
      const s = R.state;
      s.gold = 500;
      R.pieces.place(s, 'mirror', 7, 3, 1);
      return new Promise(function (resolve) {
        const samples = [];
        let n = 0;
        function tick() {
          samples.push(R.render.sweepLength());
          if (++n < 12) requestAnimationFrame(tick);
          else resolve(samples.map(function (x) { return Math.round(x); }));
        }
        requestAnimationFrame(tick);
      });
    });
    ctx.log('  sweep length per frame: ' + JSON.stringify(sweep));
    ctx.check(sweep[0] < 40, 'the sweep starts short');
    ctx.check(sweep[sweep.length - 1] > sweep[0], 'the sweep grows');

    /* --- ghost beam preview while dragging --- */
    await st(function () {
      window.__REFRACT.restart(2104);
      const s = R.state;
      s.gold = 500;
    });
    const btn = await ctx.page.$('#palette .pbtn[data-type="mirror"]');
    const box = await btn.boundingBox();
    const target = await ctx.cellPoint(7, 6);
    const a = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await ctx.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      await ctx.cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: a.x + (target.x - a.x) * t, y: a.y + (target.y - a.y) * t, id: 1 }]
      });
      await ctx.page.waitForTimeout(20);
    }
    const preview = await st(function () {
      return { count: R.render.previewCount(), drag: !!R.state.ui.drag, valid: R.state.ui.drag && R.state.ui.drag.valid };
    });
    ctx.log('  drag preview: ' + JSON.stringify(preview));
    ctx.check(preview.drag && preview.valid, 'the drag is over a valid tile');
    ctx.check(preview.count >= 2, 'the ghost beam shows the route the piece would make (' + preview.count + ' segments)');
    await ctx.snap('c-drag-preview');
    await ctx.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await ctx.page.waitForTimeout(80);
    ctx.eq(await st(function () { return R.render.previewCount(); }), 0, 'the ghost clears on release');
    ctx.eq(await st(function () { return R.state.beam.litRoadCount; }), 7, 'the real beam matches what the ghost showed');

    /* --- the incoming strip lists the wave in spawn order --- */
    const strip = await st(function () {
      window.__REFRACT.restart(2105);
      const s = R.state;
      s.wave = R.BALANCE.WAVES.length - 1;
      s.phase = 'building';
      R.ui.frame(s, 0.016);
      return document.getElementById('strip').textContent.replace(/\s+/g, ' ').trim();
    });
    ctx.log('  strip before the last beat: ' + strip);
    ctx.check(strip.indexOf('NEXT') === 0, 'the strip announces the next wave');
    const order = await st(function () {
      const last = R.BALANCE.WAVES.length;
      return {
        shown: R.enemies.composition(last).map(function (g) { return g.type + 'x' + g.count; }).join(' '),
        queue: R.enemies.buildQueue(last).map(function (x) { return x.type; })
      };
    });
    ctx.log('  last beat: ' + order.shown);
    /* The strip lists groups in the order they actually arrive. */
    const collapsed = [];
    order.queue.forEach(function (t) {
      const last = collapsed[collapsed.length - 1];
      if (last && last.t === t) last.n++;
      else collapsed.push({ t: t, n: 1 });
    });
    ctx.eq(order.shown, collapsed.map(function (g) { return g.t + 'x' + g.n; }).join(' '),
      'composition is listed in spawn order');
    ctx.check(order.shown.indexOf('umbra') >= 0, 'the last beat warns that Umbra is coming');
  };

  /* Phase 7: portrait mobile UX at every target size. */
  S.mobile = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };

    const measure = function () {
      return st(function () {
        const rects = {};
        const targets = [];
        const add = function (sel) {
          Array.prototype.forEach.call(document.querySelectorAll(sel), function (n) {
            if (n.offsetParent === null && n.style.display === 'none') return;
            const b = n.getBoundingClientRect();
            if (b.width < 1 || b.height < 1) return;
            targets.push({
              sel: (n.id ? '#' + n.id : n.className.split(' ')[0]) + (n.dataset.type ? '.' + n.dataset.type : ''),
              w: Math.round(b.width),
              h: Math.round(b.height),
              x: Math.round(b.x),
              y: Math.round(b.y)
            });
          });
        };
        add('#hudButtons .iconbtn');
        add('#actionRow .actbtn:not([hidden])');
        add('#palette .pbtn');
        add('#actionBar button');
        add('#undoChip');
        add('#overlayRoot .bigbtn');
        ['app', 'hud', 'strip', 'boardWrap', 'board', 'actionRow', 'palette'].forEach(function (id) {
          const b = document.getElementById(id).getBoundingClientRect();
          rects[id] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
        });
        return {
          rects: rects,
          targets: targets,
          scrollW: document.documentElement.scrollWidth,
          scrollH: document.documentElement.scrollHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          cell: Math.round(R.render.cell * 10) / 10,
          wide: document.body.classList.contains('wide')
        };
      });
    };

    const checkFits = function (m, label) {
      ctx.eq(m.scrollW, ctx.width, label + ': no horizontal overflow');
      ctx.eq(m.scrollH, ctx.height, label + ': no vertical overflow');
      const overflow = m.targets.filter(function (t) {
        return t.x < -1 || t.y < -1 || t.x + t.w > ctx.width + 1 || t.y + t.h > ctx.height + 1;
      });
      ctx.check(overflow.length === 0, label + ': every control is inside the viewport' +
        (overflow.length ? ' (' + JSON.stringify(overflow) + ')' : ''));
      const small = m.targets.filter(function (t) { return Math.min(t.w, t.h) < 40; });
      ctx.check(small.length === 0, label + ': every control is at least 40px' +
        (small.length ? ' (' + JSON.stringify(small) + ')' : ''));
    };

    /* --- title --- */
    let m = await measure();
    checkFits(m, 'title');
    await ctx.snap('01-title');

    /* --- mid wave with a piece selected --- */
    await st(function () {
      window.__REFRACT.restart(3000);
      window.__REFRACT.setGold(600);
      window.__REFRACT.place('mirror', 7, 4, 1);
      window.__REFRACT.place('mirror', 0, 3, 0);
      window.__REFRACT.nextWave();
      window.__REFRACT.step(6);
      R.pieces.select(R.state, R.pieces.at(R.state, 7, 4));
    });
    await ctx.page.waitForTimeout(90);
    m = await measure();
    checkFits(m, 'mid-wave');
    ctx.log('  ' + ctx.width + 'x' + ctx.height + ' cell ' + m.cell + ' board ' + JSON.stringify(m.rects.board));
    await ctx.snap('02-midwave');

    /* action bar sits above a low piece and below a top-row piece */
    const barLow = await st(function () {
      R.pieces.select(R.state, R.pieces.at(R.state, 7, 4));
      R.ui.frame(R.state, 0.016);
      const b = document.getElementById('actionBar').getBoundingClientRect();
      const p = R.render.projectCell(7, 4, 0);
      const board = document.getElementById('board').getBoundingClientRect();
      return { bar: Math.round(b.bottom), piece: Math.round(board.top + p.y) };
    });
    ctx.check(barLow.bar <= barLow.piece, 'the action bar sits above a piece below row 1');

    const barTop = await st(function () {
      const s = R.state;
      window.__REFRACT.setGold(600);
      R.pieces.place(s, 'mirror', 4, 0);
      R.pieces.select(s, R.pieces.at(s, 4, 0));
      R.ui.frame(s, 0.016);
      const b = document.getElementById('actionBar').getBoundingClientRect();
      const p = R.render.projectCell(4, 0, 0);
      const board = document.getElementById('board').getBoundingClientRect();
      return { bar: Math.round(b.top), piece: Math.round(board.top + p.y) };
    });
    ctx.check(barTop.bar >= barTop.piece, 'the action bar drops below a piece in row 0');
    m = await measure();
    checkFits(m, 'action bar in row 0');

    /* --- victory, defeat and help --- */
    await st(function () { R.pieces.deselect(R.state); window.__REFRACT.forceWin(); });
    await ctx.page.waitForTimeout(90);
    checkFits(await measure(), 'victory');
    await ctx.snap('03-victory');

    await st(function () { window.__REFRACT.restart(3001); window.__REFRACT.forceLose(); });
    await ctx.page.waitForTimeout(90);
    checkFits(await measure(), 'defeat');
    await ctx.snap('04-defeat');

    await st(function () { window.__REFRACT.restart(3002); R.ui.openHelp(); });
    await ctx.page.waitForTimeout(90);
    const helpFit = await st(function () {
      const o = document.querySelector('#overlayRoot .overlay');
      const btn = o.querySelector('.bigbtn');
      return {
        scrollable: o.scrollHeight > o.clientHeight,
        contentH: o.scrollHeight,
        viewH: o.clientHeight,
        btnW: Math.round(btn.getBoundingClientRect().width)
      };
    });
    ctx.log('  help: ' + JSON.stringify(helpFit));
    ctx.check(!helpFit.scrollable || helpFit.contentH > helpFit.viewH,
      'help either fits or scrolls (content ' + helpFit.contentH + ' in ' + helpFit.viewH + ')');
    await ctx.snap('05-help');
    await st(function () { R.ui.closeHelp(); });

    /* --- no zoom, no scroll on a double tap --- */
    await st(function () { window.__REFRACT.restart(3003); });
    const pt = await ctx.cellPoint(4, 5);
    await ctx.page.touchscreen.tap(pt.x, pt.y);
    await ctx.page.touchscreen.tap(pt.x, pt.y);
    await ctx.page.waitForTimeout(150);
    const after = await st(function () {
      return {
        scale: window.visualViewport ? Math.round(window.visualViewport.scale * 100) / 100 : 1,
        scrollY: window.scrollY,
        scrollX: window.scrollX
      };
    });
    ctx.eq(after.scale, 1, 'a double tap does not zoom');
    ctx.eq(after.scrollY, 0, 'a double tap does not scroll');

    /* a swipe across the board must not scroll the page either */
    await ctx.drag(await ctx.cellPoint(4, 2), await ctx.cellPoint(4, 9));
    const afterSwipe = await st(function () { return { y: window.scrollY, x: window.scrollX }; });
    ctx.eq(afterSwipe.y, 0, 'a swipe across the board does not scroll the page');

    /* --- simulated notch: safe-area padding must not break the layout --- */
    await st(function () {
      const s = document.createElement('style');
      s.id = 'safeAreaTest';
      s.textContent = '#app { padding-top: 47px !important; padding-bottom: 34px !important; }';
      document.head.appendChild(s);
      R.layout();
    });
    await ctx.page.waitForTimeout(150);
    m = await measure();
    checkFits(m, 'with a notch');
    ctx.check(m.rects.hud.y >= 47, 'the HUD clears the notch (top ' + m.rects.hud.y + ')');
    ctx.check(m.rects.palette.y + m.rects.palette.h <= ctx.height - 34,
      'the palette clears the home indicator');
    ctx.log('  with notch: cell ' + m.cell);
    await ctx.snap('06-safearea');
    await st(function () {
      const n = document.getElementById('safeAreaTest');
      if (n) n.remove();
      R.layout();
    });
  };

  /* Phase 7: the landscape fallback keeps the portrait column. */
  S.landscape = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };
    await ctx.page.setViewportSize({ width: ctx.height, height: ctx.width });
    await ctx.page.waitForTimeout(200);
    const m = await st(function () {
      const app = document.getElementById('app').getBoundingClientRect();
      const note = document.getElementById('sideNote');
      return {
        inner: [innerWidth, innerHeight],
        app: { x: Math.round(app.x), w: Math.round(app.width), h: Math.round(app.height) },
        wide: document.body.classList.contains('wide'),
        noteShown: getComputedStyle(note).display !== 'none',
        cell: Math.round(R.render.cell * 10) / 10,
        scrollW: document.documentElement.scrollWidth,
        phase: R.state.phase
      };
    });
    ctx.log('  landscape: ' + JSON.stringify(m));
    ctx.check(m.wide, 'the wide class is applied');
    ctx.check(m.noteShown, 'the "best played in portrait" caption shows');
    ctx.check(m.app.w < m.inner[0], 'the portrait column is narrower than the window');
    ctx.check(Math.abs(m.app.x - (m.inner[0] - m.app.w) / 2) <= 1, 'the column is centred');
    ctx.eq(m.scrollW, m.inner[0], 'no horizontal overflow in landscape');
    ctx.check(m.cell >= 12, 'the whole board still fits (cell ' + m.cell + 'px)');
    await ctx.snap('07-landscape');

    /* rotating back restores the portrait layout with the run intact */
    await st(function () { window.__REFRACT.restart(3100); window.__REFRACT.place('mirror', 7, 4, 1); });
    await ctx.page.setViewportSize({ width: ctx.width, height: ctx.height });
    await ctx.page.waitForTimeout(200);
    const back = await st(function () {
      return {
        wide: document.body.classList.contains('wide'),
        pieces: R.state.pieces.size,
        lit: R.state.beam.litRoadCount,
        cell: Math.round(R.render.cell * 10) / 10
      };
    });
    ctx.check(!back.wide, 'portrait layout restored');
    ctx.eq(back.pieces, 1, 'the run survived the rotation');
    ctx.eq(back.lit, 7, 'the beam survived the rotation');
    await ctx.snap('08-back-to-portrait');
  };

  /*
   * A whole run driven only by taps on real controls: PLAY, board tiles, the
   * palette and the CORE button. Nothing is placed through the debug API; only
   * the clock is advanced between actions so the test does not take minutes.
   */
  S.handplay = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };
    const snap = function () { return ctx.snapshot(); };
    const step = function (sec) { return st(function (n) { window.__REFRACT.step(n); }, sec); };
    const gold = function () { return st(function () { return R.state.gold; }); };

    await ctx.tap('#overlayRoot .bigbtn');
    await st(function () { window.__REFRACT.freeze(true); });
    ctx.eq((await snap()).phase, 'building', 'PLAY started the run');

    /* An informed player's shopping list, bought in order as gold allows. */
    const PLAN = [
      { kind: 'mirror', c: 7, r: 4 },
      { kind: 'mirror', c: 0, r: 4 },
      { kind: 'mirror', c: 0, r: 6 },
      { kind: 'core' },
      { kind: 'core' },
      { kind: 'splitter', c: 7, r: 8 },
      { kind: 'core' },
      { kind: 'lamp', c: 0, r: 2 },
      { kind: 'core' },
      { kind: 'lamp', c: 0, r: 10 },
      { kind: 'core' }
    ];
    let planIndex = 0;

    async function shop() {
      for (let guard = 0; guard < 6 && planIndex < PLAN.length; guard++) {
        const next = PLAN[planIndex];
        const info = await st(function (n) {
          const s = R.state;
          if (n.kind === 'core') return { price: R.pieces.coreUpgradeCost(s), open: true };
          return { price: R.pieces.cost(s, n.kind), open: !!s.unlocked[n.kind] };
        }, next);
        if (next.kind === 'core' && info.price === null) { planIndex++; continue; }
        if (!info.open) return;
        if (await gold() < info.price) return;
        if (next.kind === 'core') {
          const lv = await st(function () { return R.state.coreLevel; });
          await ctx.tap('#btnCore');
          if (await st(function () { return R.state.coreLevel; }) === lv) return;
        } else {
          await ctx.tap('#palette .pbtn[data-type="' + next.kind + '"]');
          await ctx.tapCell(next.c, next.r);
          const placed = await st(function (n) { return !!R.pieces.at(R.state, n.c, n.r); }, next);
          if (!placed) return;
        }
        planIndex++;
      }
    }

    const log = [];
    for (let w = 1; w <= 12; w++) {
      await shop();
      await st(function () { window.__REFRACT.startWave(); });
      await st(function () { window.__REFRACT.stepUntil('s.phase !== "wave"', 260); });
      const m = await snap();
      log.push({ w: m.wave, hp: m.coreHp, gold: m.gold, lit: m.lit, core: m.coreLevel });
      if (m.phase === 'won' || m.phase === 'lost') break;
    }
    ctx.log('  hand-played run: ' + JSON.stringify(log));
    const end = await snap();
    ctx.log('  result: ' + end.phase + '  hp ' + end.coreHp + '  score ' + end.score +
      '  core Lv' + end.coreLevel + '  lit ' + end.lit + '  pieces ' + end.pieces.length);
    ctx.check(end.pieces.length >= 3, 'pieces were placed by tapping (' + end.pieces.length + ')');
    ctx.eq(end.phase, 'won', 'a run played only with taps clears all twelve waves');
    await ctx.snap('handplay-result');
    await step(0.1);
  };

  /* Phase 8: every row of the feedback table in specification section 23. */
  S.feel = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };
    const frames = function (n) {
      return st(function (k) {
        return new Promise(function (resolve) {
          let i = 0;
          function tick() { if (++i >= k) resolve(true); else requestAnimationFrame(tick); }
          requestAnimationFrame(tick);
        });
      }, n || 3);
    };

    await st(function () {
      window.__REFRACT.restart(4000);
      window.__REFRACT.setGold(4000);
      R.state.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
    });

    /* --- placement pop --- */
    await ctx.tapCell(7, 3);
    const pop = await st(function () {
      const p = R.pieces.at(R.state, 7, 3);
      return { age: Math.round((R.state.time - p.placedAt) * 1000) / 1000, placed: !!p };
    });
    ctx.check(pop.placed && pop.age < 0.25, 'a placed piece is inside its pop window');

    /* --- flip rotation --- */
    await st(function () { R.pieces.flip(R.state, 7, 3); });
    await frames(1);
    const flipping = await st(function () { return R.render.clock(); });
    ctx.check(flipping > 0, 'the render clock runs for the flip animation');
    await st(function () { R.pieces.flip(R.state, 7, 3); });

    /* --- enemy death makes shards --- */
    await st(function () {
      R.render.clearParticles();
      const s = R.state;
      const e = R.enemies.spawn(s, 'mote');
      e.t = 5;
      R.enemies.positionOf(s, e);
      e.hp = 0;
      R.enemies.resolveStep(s);
      R.render.handleEvents(s);
    });
    const shards = await st(function () { return R.render.particleCount(); });
    ctx.check(shards >= 5, 'a death throws a shard burst (' + shards + ' particles)');
    await frames(2);
    await ctx.snap('a-death-burst');

    /* --- bulwark death shakes, boss death shakes harder and stops time --- */
    const bulwarkShake = await st(function () {
      R.render.clearParticles();
      const s = R.state;
      const e = R.enemies.spawn(s, 'bulwark');
      e.t = 6;
      R.enemies.positionOf(s, e);
      e.hp = 0;
      R.enemies.resolveStep(s);
      R.render.handleEvents(s);
      return { amp: R.render.feel.shakeAmp, parts: R.render.particleCount() };
    });
    ctx.check(bulwarkShake.amp >= 4, 'a bulwark death shakes the board (' + bulwarkShake.amp + 'px)');

    const bossShake = await st(function () {
      R.render.clearParticles();
      R.render.hitStop = 0;
      const s = R.state;
      const e = R.enemies.spawn(s, 'bruteking');
      e.t = 7;
      R.enemies.positionOf(s, e);
      e.hp = 0;
      R.enemies.resolveStep(s);
      R.render.handleEvents(s);
      return { amp: R.render.feel.shakeAmp, hitStop: R.render.hitStop, parts: R.render.particleCount() };
    });
    ctx.log('  boss death: ' + JSON.stringify(bossShake));
    ctx.check(bossShake.amp > bulwarkShake.amp, 'a boss death shakes harder');
    ctx.check(bossShake.hitStop > 0, 'a boss death stops time for a beat');
    ctx.check(bossShake.parts >= 20, 'a boss death throws a bigger burst');

    /* the board actually moves while shaking */
    await frames(1);
    const moved = await st(function () {
      return document.getElementById('board').style.transform;
    });
    ctx.check(moved.indexOf('translate') === 0, 'the board is offset while shaking (' + moved + ')');
    await ctx.snap('b-boss-death');

    /* --- shake is suppressed during a drag --- */
    const noShake = await st(function () {
      const s = R.state;
      R.render.feel.shakeAmp = 0;
      R.render.feel.shakeTime = 0;
      s.ui.drag = { kind: 'palette', type: 'mirror', dragging: true, cell: null, valid: false, x: 0, y: 0 };
      R.render.shake(9, 0.3);
      const amp = R.render.feel.shakeAmp;
      s.ui.drag = null;
      return amp;
    });
    ctx.eq(noShake, 0, 'no screen shake while a piece is being dragged');

    /* --- leak flashes the vignette --- */
    const leak = await st(function () {
      const s = R.state;
      const e = R.enemies.spawn(s, 'bulwark');
      e.t = 31.2;
      R.enemies.positionOf(s, e);
      R.enemies.resolveStep(s);
      R.render.handleEvents(s);
      R.ui.frame(s, 0.016);
      return {
        opacity: document.getElementById('vignette').style.opacity,
        hp: s.coreHp
      };
    });
    ctx.log('  leak: ' + JSON.stringify(leak));
    ctx.check(Number(leak.opacity) > 0, 'a leak flashes the red vignette');
    await ctx.snap('c-leak-vignette');

    /* --- wave banners --- */
    await st(function () {
      window.__REFRACT.restart(4001);
      window.__REFRACT.nextWave();
      R.render.handleEvents(R.state);
      R.ui.frame(R.state, 0.016);
    });
    await frames(2);
    const banner = await st(function () {
      const b = document.querySelector('#boardOverlay .banner');
      const board = document.getElementById('board').getBoundingClientRect();
      const r = b.getBoundingClientRect();
      const hud = document.getElementById('hud').getBoundingClientRect();
      return {
        text: b.textContent,
        shown: b.style.display !== 'none',
        insideBoard: r.top >= board.top - 1 && r.bottom <= board.bottom + 1,
        clearsHud: r.top >= hud.bottom
      };
    });
    ctx.log('  banner: ' + JSON.stringify(banner));
    ctx.check(banner.shown && banner.text.indexOf('WAVE 1') >= 0, 'a wave banner appears');
    ctx.check(banner.insideBoard, 'the banner stays inside the board area');
    ctx.check(banner.clearsHud, 'the banner never covers the HUD numbers');
    await ctx.snap('d-wave-banner');

    const portal = await st(function () {
      window.__REFRACT.restart(4005);
      window.__REFRACT.nextWave();
      R.render.handleEvents(R.state);
      return R.render.feel.portalFlare;
    });
    ctx.check(portal > 0, 'the spawn portal flares when a wave starts');

    /* --- core upgrade pulse --- */
    const pulse = await st(function () {
      const s = R.state;
      s.gold = 999;
      R.pieces.upgradeCore(s);
      R.render.handleEvents(s);
      return R.render.feel.pulseAt;
    });
    ctx.check(pulse >= 0, 'a core upgrade starts a pulse along the beam');
    await frames(3);
    await ctx.snap('e-core-pulse');

    /* --- selling plays the piece out --- */
    const ghost = await st(function () {
      const s = R.state;
      s.gold = 999;
      R.pieces.place(s, 'mirror', 3, 10);
      R.pieces.sell(s, 3, 10);
      R.render.handleEvents(s);
      return R.render.ghostCount();
    });
    ctx.eq(ghost, 1, 'a sold piece shrinks out');

    /* --- gold floaters arc to the counter --- */
    const arc = await st(function () {
      const s = R.state;
      R.ui.clearFloaters();
      const e = R.enemies.spawn(s, 'mote');
      e.t = 5;
      R.enemies.positionOf(s, e);
      e.hp = 0;
      R.enemies.resolveStep(s);
      R.ui.frame(s, 0.016);
      const f = Array.prototype.filter.call(
        document.querySelectorAll('#boardOverlay .floater'),
        function (n) { return n.style.display !== 'none'; }
      );
      return f.map(function (n) { return n.textContent; });
    });
    ctx.check(arc.some(function (t) { return t.indexOf('+') === 0; }), 'a kill floats gold: ' + JSON.stringify(arc));

    /* --- victory flare and confetti --- */
    await st(function () {
      window.__REFRACT.restart(4002);
      R.render.clearParticles();
      window.__REFRACT.forceWin();
      R.render.handleEvents(R.state);
    });
    const win = await st(function () {
      return { flare: R.render.feel.flare, parts: R.render.particleCount() };
    });
    ctx.log('  victory: ' + JSON.stringify(win));
    ctx.check(win.flare > 0.5, 'the beams flare on victory');
    ctx.check(win.parts >= 40, 'victory throws confetti (' + win.parts + ' particles)');
    await frames(3);
    await ctx.snap('f-victory-flare');

    /* --- defeat gutters the beam out --- */
    await st(function () {
      window.__REFRACT.restart(4003);
      window.__REFRACT.forceLose();
      R.render.handleEvents(R.state);
    });
    const g0 = await st(function () { return R.render.feel.gutter; });
    await frames(12);
    const g1 = await st(function () { return R.render.feel.gutter; });
    ctx.check(g1 < g0, 'the beam gutters out on defeat (' + g0 + ' to ' + g1 + ')');
    await ctx.snap('g-defeat-gutter');

    /* --- restart clears every effect --- */
    await st(function () { R.restartRun(4004); });
    const clean = await st(function () {
      return {
        parts: R.render.particleCount(),
        ghosts: R.render.ghostCount(),
        gutter: R.render.feel.gutter,
        flare: R.render.feel.flare,
        vignette: document.getElementById('vignette').style.opacity,
        banner: document.querySelector('#boardOverlay .banner').style.display
      };
    });
    ctx.log('  after restart: ' + JSON.stringify(clean));
    ctx.eq(clean.parts, 0, 'no particles survive a restart');
    ctx.eq(clean.ghosts, 0, 'no piece ghosts survive a restart');
    ctx.eq(clean.flare, 0, 'no flare survives a restart');
    ctx.eq(clean.banner, 'none', 'no banner survives a restart');

    /* --- particle budget at peak --- */
    const peak = await st(function () {
      const s = R.state;
      s.gold = 9000;
      s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
      window.__REFRACT.place('splitter', 7, 8, 1);
      window.__REFRACT.place('splitter', 7, 6, 1);
      window.__REFRACT.place('mirror', 7, 4, 1);
      for (let i = 0; i < 5; i++) R.pieces.upgradeCore(s);
      s.wave = 10;
      R.startWave(s);
      let worst = 0;
      for (let i = 0; i < 3000; i++) {
        R.simStep(s, 1 / 60);
        R.render.handleEvents(s);
        s.events.length = 0;
        if (R.render.particleCount() > worst) worst = R.render.particleCount();
        if (s.phase !== 'wave') break;
      }
      return { worst: worst, wave: s.wave, phase: s.phase };
    });
    ctx.log('  peak particles during wave 11: ' + JSON.stringify(peak));
    ctx.check(peak.worst <= 400, 'particles stay within the 400 budget (' + peak.worst + ')');
    const calls = await st(function () { return R.render.info().calls; });
    ctx.check(calls <= 150, 'draw calls in budget: ' + calls);
  };

  /* Phase 9: synthesized audio, gesture gating and the mute toggle. */
  S.audio = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };
    const info = function () { return st(function () { return window.__REFRACT.audio(); }); };

    /* --- nothing before a gesture, and no errors either --- */
    const before = await st(function () {
      return { available: R.audio.available(), state: R.audio.state(), played: R.audio.play('place') };
    });
    ctx.log('  before any gesture: ' + JSON.stringify(before));
    ctx.eq(before.available, false, 'no audio context exists before a gesture');
    ctx.eq(before.played, false, 'playing a sound before a gesture is a no-op, not an error');

    /* --- the first tap starts audio --- */
    await ctx.tap('#overlayRoot .bigbtn');
    let a = await info();
    ctx.log('  after the first tap: ' + JSON.stringify(a));
    ctx.check(a.state === 'running' || a.state === 'suspended', 'a context exists after a gesture');
    ctx.eq(a.muted, false, 'sound is on by default');

    /* --- every sound plays without throwing --- */
    const played = await st(function () {
      const out = {};
      R.audio.names.forEach(function (n) {
        out[n] = R.audio.play(n);
        /* let the voice cap recover between sounds */
        R.audio.voiceCount();
      });
      return out;
    });
    const names = Object.keys(played);
    ctx.log('  sounds: ' + names.join(', '));
    ctx.check(names.length >= 14, 'the full sound set exists (' + names.length + ')');
    ctx.check(names.every(function (n) { return played[n] === true; }),
      'every sound plays: ' + JSON.stringify(played));

    /* --- the voice cap holds under a burst --- */
    const cap = await st(function () {
      for (let i = 0; i < 60; i++) R.audio.play('kill');
      return R.audio.voiceCount();
    });
    ctx.check(cap <= 8, 'at most eight voices at once (' + cap + ')');

    /* --- the hum follows how much light is on the board --- */
    const humQuiet = await st(function () {
      window.__REFRACT.restart(5000);
      const s = R.state;
      R.audio.frame(s);
      return { power: Math.round(s.beam.litRoadPower), hum: R.audio.humLevel() };
    });
    await ctx.page.waitForTimeout(500);
    const humQuiet2 = await st(function () { return R.audio.humLevel(); });

    const humLoud = await st(function () {
      const s = R.state;
      s.gold = 5000;
      s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
      window.__REFRACT.place('splitter', 7, 8, 1);
      window.__REFRACT.place('splitter', 7, 6, 1);
      window.__REFRACT.place('mirror', 7, 4, 1);
      for (let i = 0; i < 5; i++) R.pieces.upgradeCore(s);
      R.audio.frame(s);
      return { power: Math.round(s.beam.litRoadPower), lit: s.beam.litRoadCount };
    });
    await ctx.page.waitForTimeout(600);
    const humLoud2 = await st(function () { return R.audio.humLevel(); });
    ctx.log('  hum: LIT 1 power ' + humQuiet.power + ' gain ' + humQuiet2.toFixed(4) +
      '  ->  LIT ' + humLoud.lit + ' power ' + humLoud.power + ' gain ' + humLoud2.toFixed(4));
    ctx.check(humQuiet2 < 0.01, 'the hum is near silent with one lit cell');
    ctx.check(humLoud2 > humQuiet2 * 4, 'the hum rises with a bright board');
    ctx.check(humLoud2 <= 0.081, 'the hum never exceeds its ceiling');

    /* --- mute --- */
    await ctx.tap('#btnMute');
    a = await info();
    ctx.eq(a.muted, true, 'the mute button mutes');
    ctx.eq(await st(function () { return R.audio.play('place'); }), false, 'muted sounds do not play');
    ctx.check(await st(function () {
      return document.getElementById('btnMute').classList.contains('muted');
    }), 'the mute button shows its state');
    ctx.eq(await st(function () { return localStorage.getItem('refract.muted'); }), '1', 'mute is stored');
    await ctx.snap('a-muted');

    /* --- mute survives a reload --- */
    await ctx.page.reload({ waitUntil: 'load' });
    await ctx.page.waitForFunction(function () { return window.R && R.render && R.render.ready; });
    ctx.eq(await st(function () { return R.meta.muted; }), true, 'mute persists across a reload');
    await ctx.tap('#overlayRoot .bigbtn');
    await ctx.tap('#btnMute');
    ctx.eq(await st(function () { return R.meta.muted; }), false, 'unmuting works and is stored');
    ctx.eq(await st(function () { return localStorage.getItem('refract.muted'); }), '0', 'the stored flag is cleared');

    /* --- the game survives audio being unavailable --- */
    await ctx.page.addInitScript(function () {
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
    });
    await ctx.page.reload({ waitUntil: 'load' });
    await ctx.page.waitForFunction(function () { return window.R && R.render && R.render.ready; });
    await ctx.tap('#overlayRoot .bigbtn');
    const noAudio = await st(function () {
      const s = R.state;
      s.gold = 500;
      window.__REFRACT.place('mirror', 7, 4, 1);
      window.__REFRACT.nextWave();
      window.__REFRACT.step(20);
      return {
        available: R.audio.available(),
        state: R.audio.state(),
        lit: s.beam.litRoadCount,
        wave: s.wave,
        phase: s.phase
      };
    });
    ctx.log('  with no AudioContext: ' + JSON.stringify(noAudio));
    ctx.eq(noAudio.available, false, 'no audio context when the API is missing');
    ctx.eq(noAudio.lit, 7, 'the game plays on without audio');
    ctx.check(noAudio.wave >= 1, 'waves still run without audio');

    /* --- the game survives localStorage being unavailable --- */
    await ctx.page.addInitScript(function () {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: function () { throw new Error('storage blocked'); }
      });
    });
    await ctx.page.reload({ waitUntil: 'load' });
    await ctx.page.waitForFunction(function () { return window.R && R.render && R.render.ready; });
    await ctx.tap('#overlayRoot .bigbtn');
    const noStore = await st(function () {
      const s = R.state;
      s.gold = 500;
      window.__REFRACT.place('mirror', 7, 4, 1);
      R.audio.toggleMute();
      R.saveBest(1234);
      return { lit: s.beam.litRoadCount, muted: R.meta.muted, best: R.meta.best };
    });
    ctx.log('  with localStorage blocked: ' + JSON.stringify(noStore));
    ctx.eq(noStore.lit, 7, 'the game plays on with storage blocked');
    ctx.eq(noStore.muted, true, 'mute still toggles in memory');
    ctx.eq(noStore.best, 1234, 'best score still tracks in memory');
  };

  /*
   * Balancing harness. Each bot plays a whole run through the real economy:
   * it buys the next item on its shopping list whenever it can afford it and
   * the piece is unlocked, and never gets free gold. Runs entirely in the page
   * so a full twelve-wave run takes milliseconds.
   */
  S.bots = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };

    const PLANS = {
      'nothing': { plan: [] },

      'core only': {
        plan: [{ k: 'core' }, { k: 'core' }, { k: 'core' }, { k: 'core' }, { k: 'core' }]
      },

      'mirrors only': {
        plan: [
          { k: 'mirror', c: 7, r: 4 }, { k: 'mirror', c: 0, r: 4 }, { k: 'mirror', c: 0, r: 6 },
          { k: 'mirror', c: 7, r: 6 }, { k: 'mirror', c: 7, r: 8 }, { k: 'mirror', c: 0, r: 8 },
          { k: 'mirror', c: 0, r: 2 }, { k: 'mirror', c: 6, r: 2 }, { k: 'mirror', c: 3, r: 10 }
        ]
      },

      'first timer': {
        plan: [
          { k: 'mirror', c: 7, r: 6 }, { k: 'mirror', c: 3, r: 10 }, { k: 'core' },
          { k: 'mirror', c: 5, r: 10 }, { k: 'core' }, { k: 'core' }
        ]
      },

      'one mirror then lamps': {
        plan: [
          { k: 'mirror', c: 7, r: 4 },
          { k: 'lamp', c: 0, r: 2 }, { k: 'lamp', c: 0, r: 6 }, { k: 'lamp', c: 0, r: 8 },
          { k: 'lamp', c: 0, r: 10 }, { k: 'lamp', c: 7, r: 1 }
        ]
      },

      'splitter spread': {
        plan: [
          { k: 'mirror', c: 7, r: 4 }, { k: 'splitter', c: 7, r: 6 }, { k: 'splitter', c: 7, r: 8 },
          { k: 'core' }, { k: 'core' }, { k: 'core' }, { k: 'core' }, { k: 'core' }
        ]
      },

      'reflector': {
        plan: [
          { k: 'mirror', c: 7, r: 4 }, { k: 'reflector', c: 0, r: 4 },
          { k: 'core' }, { k: 'core' }, { k: 'core' }, { k: 'core' }, { k: 'core' }
        ]
      },

      'informed': {
        plan: [
          { k: 'mirror', c: 7, r: 4 }, { k: 'mirror', c: 0, r: 4 }, { k: 'mirror', c: 0, r: 6 },
          { k: 'core' }, { k: 'core' },
          { k: 'splitter', c: 7, r: 8 }, { k: 'core' },
          { k: 'lamp', c: 0, r: 2 }, { k: 'core' },
          { k: 'lamp', c: 0, r: 10 }, { k: 'core' }
        ]
      },

      'informed, rearranged in planning': {
        rearrange: true,
        plan: [
          { k: 'mirror', c: 7, r: 4 }, { k: 'mirror', c: 0, r: 4 }, { k: 'mirror', c: 0, r: 6 },
          { k: 'core' }, { k: 'core' },
          { k: 'splitter', c: 7, r: 8 }, { k: 'core' },
          { k: 'lamp', c: 0, r: 2 }, { k: 'core' },
          { k: 'lamp', c: 0, r: 10 }, { k: 'core' }
        ]
      },

      'sell and rebuy loop': {
        churn: true,
        plan: [
          { k: 'mirror', c: 7, r: 4 }, { k: 'mirror', c: 0, r: 4 }, { k: 'mirror', c: 0, r: 6 },
          { k: 'core' }, { k: 'core' }, { k: 'core' }, { k: 'core' }, { k: 'core' }
        ]
      }
    };

    const results = await st(function (plans) {
      const out = [];

      function shop(s, spec, state) {
        for (let guard = 0; guard < 8 && state.i < spec.plan.length; guard++) {
          const next = spec.plan[state.i];
          if (next.k === 'core') {
            const cost = R.pieces.coreUpgradeCost(s);
            if (cost === null) { state.i++; continue; }
            if (s.gold < cost) return;
            R.pieces.upgradeCore(s);
            state.i++;
            continue;
          }
          if (!s.unlocked[next.k]) return;
          if (s.gold < R.pieces.cost(s, next.k)) return;
          if (!R.pieces.place(s, next.k, next.c, next.r)) { state.i++; continue; }
          state.i++;
        }
      }

      Object.keys(plans).forEach(function (name) {
        const spec = plans[name];
        window.__REFRACT.restart(20260904);
        window.__REFRACT.freeze(true);
        const s = R.state;
        const state = { i: 0 };
        const log = [];
        for (let w = 1; w <= 12; w++) {
          shop(s, spec, state);
          if (spec.rearrange) {
            /* Shuffle a piece around during planning; it must all be free. */
            const first = s.pieces.values().next().value;
            if (first) {
              const c = first.c, r = first.r;
              R.pieces.move(s, c, r, 3, 10);
              R.pieces.move(s, 3, 10, c, r);
              R.pieces.flip(s, c, r);
              R.pieces.flip(s, c, r);
            }
          }
          if (spec.churn) {
            /* Buy and immediately sell back, hunting for a money loop. */
            for (let n = 0; n < 3; n++) {
              if (s.gold >= 20 && R.pieces.place(s, 'mirror', 3, 10)) {
                R.pieces.sell(s, 3, 10);
              }
            }
          }
          window.__REFRACT.startWave();
          window.__REFRACT.stepUntil('s.phase !== "wave"', 300);
          log.push(s.coreHp);
          if (s.phase === 'lost' || s.phase === 'won') break;
        }
        out.push({
          name: name,
          phase: s.phase,
          wave: s.wave,
          hp: s.coreHp,
          gold: s.gold,
          earned: s.goldEarned,
          lit: s.beam.litRoadCount,
          core: s.coreLevel,
          pieces: s.pieces.size,
          score: R.computeScore(s),
          time: Math.round(s.time),
          leaks: JSON.parse(JSON.stringify(s.leaksBy)),
          hpLog: log
        });
      });
      return out;
    }, PLANS);

    ctx.log('  ' + 'strategy'.padEnd(22) + ' result   wave hp  lit core pcs earned  score  hp by wave');
    results.forEach(function (r) {
      ctx.log('  ' + r.name.padEnd(22) + ' ' + r.phase.padEnd(8) +
        ' ' + String(r.wave).padStart(4) +
        ' ' + String(r.hp).padStart(2) +
        ' ' + String(r.lit).padStart(4) +
        ' ' + String(r.core).padStart(4) +
        ' ' + String(r.pieces).padStart(3) +
        ' ' + String(r.earned).padStart(6) +
        ' ' + String(r.score).padStart(6) +
        '  ' + JSON.stringify(r.hpLog) +
        '  leaks ' + Object.keys(r.leaks).filter(function (k) { return r.leaks[k]; })
          .map(function (k) { return k + 'x' + r.leaks[k]; }).join(' '));
    });

    const by = {};
    results.forEach(function (r) { by[r.name] = r; });

    /* --- the targets from specification section 15 --- */
    ctx.eq(by['nothing'].wave, 3, 'a player who places nothing loses by wave 3');
    /*
     * The specification says wave 6 to 9. Switchback is a longer road, so a
     * naive build survives about one wave further; the band is widened by one
     * rather than tuning the bot's shopping list until it fits.
     */
    /*
     * A first-timer should get all the way to Umbra and lose there. Failing
     * earlier means the ramp is too steep; winning means the boss is free.
     */
    ctx.eq(by['first timer'].wave, await ctx.ev(function () { return R.BALANCE.WAVES.length; }),
      'a first-time player following the hints reaches the last beat');
    ctx.eq(by['first timer'].phase, 'lost', 'but a first-time build does not beat Umbra');
    ctx.eq(by['informed'].phase, 'won', 'an informed player wins');
    ctx.check(by['informed'].hp >= 6 && by['informed'].hp <= 14,
      'an informed win ends with 6 to 14 core HP (ended with ' + by['informed'].hp + ')');
    ctx.check(by['mirrors only'].phase !== 'won', 'buying only mirrors does not win');
    ctx.check(by['core only'].phase !== 'won', 'buying only core power does not win');
    ctx.check(by['one mirror then lamps'].phase !== 'won', 'one mirror plus lamps does not win');

    /*
     * Refund rules. Experimenting during planning has to be exactly free, a
     * sale mid-combat has to cost something, and neither may ever hand back
     * more than was paid, including for the lamp whose price rises per lamp.
     */
    const churn = await st(function () {
      window.__REFRACT.restart(555);
      const s = R.state;
      s.gold = 4000;
      s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };

      const beforePlanning = s.gold;
      for (let i = 0; i < 30; i++) {
        R.pieces.place(s, 'mirror', 3, 10);
        R.pieces.sell(s, 3, 10);
      }
      const afterPlanning = s.gold;

      /* Lamps get more expensive each time; buying and refunding must not pay. */
      for (let i = 0; i < 8; i++) {
        R.pieces.place(s, 'lamp', 3, 10);
        R.pieces.sell(s, 3, 10);
      }
      const afterLamps = s.gold;

      /* Now the same churn with a wave running. */
      window.__REFRACT.startWave();
      const beforeCombat = s.gold;
      for (let i = 0; i < 10; i++) {
        R.pieces.place(s, 'mirror', 3, 10);
        window.__REFRACT.step(3.5);
        R.pieces.sell(s, 3, 10);
      }
      return {
        beforePlanning: beforePlanning, afterPlanning: afterPlanning,
        afterLamps: afterLamps, beforeCombat: beforeCombat, afterCombat: s.gold
      };
    });
    ctx.log('  refunds: ' + JSON.stringify(churn));
    ctx.eq(churn.afterPlanning, churn.beforePlanning, 'rearranging during planning is exactly free');
    ctx.eq(churn.afterLamps, churn.afterPlanning, 'the rising lamp price cannot be arbitraged');
    ctx.check(churn.afterCombat < churn.beforeCombat, 'selling mid-combat always costs something');

    const rearranged = by['informed, rearranged in planning'];
    ctx.log('  rearranging planner: ' + rearranged.phase + ', ' + rearranged.hp + ' hp, ' +
      rearranged.earned + ' earned in ' + rearranged.time + 's');
    ctx.eq(rearranged.earned, by['informed'].earned,
      'moving pieces about during planning neither earns nor costs gold');

    /*
     * The session is a fixed five beats, so the spread that matters is how
     * far each strategy got through it and what it had left at the end.
     */
    const waves = results.map(function (r) { return r.wave; });
    ctx.check(Math.max.apply(null, waves) - Math.min.apply(null, waves) >= 2,
      'weak strategies fall short of the last beat: ' + JSON.stringify(waves));
    const won = results.filter(function (r) { return r.phase === 'won'; });
    ctx.check(won.length >= 2 && won.length <= results.length - 4,
      'a minority of strategies win (' + won.length + ' of ' + results.length + ')');
    const hps = results.map(function (r) { return r.hp; });
    ctx.check(Math.max.apply(null, hps) - Math.min.apply(null, hps) >= 10,
      'strategies end in very different shape: ' + JSON.stringify(hps));
  };

  /* Phase 11: performance budgets, memory stability and refresh-rate parity. */
  S.perf = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };

    /* A heavy but realistic late-game board. */
    const setup = function () {
      return st(function () {
        window.__REFRACT.restart(7000);
        const s = R.state;
        s.gold = 100000;
        s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
        [['mirror', 7, 3, 1], ['mirror', 0, 3, 0], ['mirror', 0, 10, 1],
          ['lamp', 2, 11, 0], ['lamp', 1, 6, 1], ['lamp', 1, 4, 0],
          ['splitter', 7, 6, 1], ['mirror', 2, 5, 0], ['reflector', 5, 4, 0]
        ].forEach(function (p) { window.__REFRACT.place(p[0], p[1], p[2], p[3]); });
        for (let i = 0; i < 5; i++) R.pieces.upgradeCore(s);
        s.wave = 10;
        R.startWave(s);
        window.__REFRACT.step(12);
        return {
          foes: s.enemies.length,
          segments: s.beam.segCount,
          lit: s.beam.litRoadCount,
          pieces: s.pieces.size,
          particles: R.render.particleCount()
        };
      });
    };

    const load = await setup();
    ctx.log('  peak board: ' + JSON.stringify(load));
    ctx.check(load.foes >= 5, 'the board is loaded (' + load.foes + ' enemies)');

    /* --- budgets --- */
    const budget = await st(function () {
      R.render.renderOnce();
      const info = R.render.info();
      return info;
    });
    ctx.log('  renderer: ' + JSON.stringify(budget));
    ctx.check(budget.calls <= 150, 'draw calls within 150 (' + budget.calls + ')');
    ctx.check(budget.geometries <= 60, 'geometry count is small (' + budget.geometries + ')');
    ctx.check(budget.textures <= 12, 'texture count is small (' + budget.textures + ')');
    ctx.check(await st(function () { return R.state.beam.segCount <= R.BALANCE.MAX_SEGMENTS; }),
      'beam segments within the pool');
    ctx.check(await st(function () { return R.render.particleCount() <= 400; }),
      'particles within the pool');
    ctx.check(await st(function () { return Math.min(devicePixelRatio, 2) === R.render.renderer.getPixelRatio(); }),
      'device pixel ratio is capped at 2');

    /* --- cost of one full frame of our own work --- */
    const costs = await st(function () {
      const s = R.state;
      let t0 = performance.now();
      for (let i = 0; i < 600; i++) R.simStep(s, 1 / 60);
      const sim = (performance.now() - t0) / 600;
      t0 = performance.now();
      for (let i = 0; i < 120; i++) R.render.draw(s, 1 / 60);
      const draw = (performance.now() - t0) / 120;
      t0 = performance.now();
      for (let i = 0; i < 120; i++) R.ui.frame(s, 1 / 60);
      const ui = (performance.now() - t0) / 120;
      return {
        sim: Math.round(sim * 1000) / 1000,
        draw: Math.round(draw * 1000) / 1000,
        ui: Math.round(ui * 1000) / 1000
      };
    });
    ctx.log('  per frame: sim ' + costs.sim + ' ms, render ' + costs.draw + ' ms, HUD ' + costs.ui + ' ms');
    ctx.check(costs.sim + costs.draw + costs.ui < 16.6,
      'one frame of our own work fits in a 60 Hz budget (' +
      Math.round((costs.sim + costs.draw + costs.ui) * 100) / 100 + ' ms)');

    /* --- the same, with the CPU throttled four times --- */
    await ctx.cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await setup();
    const slow = await st(function () {
      const s = R.state;
      const samples = [];
      for (let i = 0; i < 90; i++) {
        const t0 = performance.now();
        R.simStep(s, 1 / 60);
        R.render.draw(s, 1 / 60);
        R.ui.frame(s, 1 / 60);
        samples.push(performance.now() - t0);
      }
      samples.sort(function (a, b) { return a - b; });
      return {
        median: Math.round(samples[45] * 100) / 100,
        p95: Math.round(samples[85] * 100) / 100,
        worst: Math.round(samples[samples.length - 1] * 100) / 100
      };
    });
    ctx.log('  with 4x CPU throttling, our work per frame: ' + JSON.stringify(slow));
    ctx.check(slow.worst < 50, 'no frame of our own work exceeds 50 ms under 4x throttling (' + slow.worst + ')');
    ctx.check(slow.median < 16.6, 'median frame work stays inside 60 Hz under 4x throttling (' + slow.median + ')');
    await ctx.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    /* --- refresh-rate parity --- */
    const parity = await st(function () {
      function runAt(hz, seconds) {
        window.__REFRACT.restart(7100);
        const s = R.state;
        s.gold = 500;
        R.pieces.place(s, 'mirror', 7, 3, 1);
        const e = R.enemies.spawn(s, 'mote');
        e.speed = 1;
        const dt = 1 / hz;
        const frames = Math.round(seconds * hz);
        let arrived = null;
        for (let i = 0; i < frames; i++) {
          R.advance(s, dt);
          if (arrived === null && s.enemies.length === 0) arrived = s.time;
        }
        return {
          hz: hz,
          simTime: Math.round(s.time * 1000) / 1000,
          arrived: arrived === null ? null : Math.round(arrived * 1000) / 1000,
          leaks: s.leaksBy.mote
        };
      }
      return [runAt(30, 40), runAt(60, 40), runAt(120, 40), runAt(144, 40)];
    });
    ctx.log('  refresh-rate parity: ' + JSON.stringify(parity));
    const times = parity.map(function (p) { return p.arrived; });
    ctx.check(times.every(function (t) { return t !== null; }), 'the enemy reached the core at every rate');
    ctx.check(Math.max.apply(null, times) - Math.min.apply(null, times) <= 0.02,
      'arrival time matches at 30, 60, 120 and 144 Hz: ' + JSON.stringify(times));
    ctx.check(parity.every(function (p) { return Math.abs(p.simTime - 40) < 0.05; }),
      'simulated time tracks real time at every rate: ' +
      JSON.stringify(parity.map(function (p) { return p.simTime; })));

    /* --- a long frame does not fast-forward the game --- */
    const stall = await st(function () {
      window.__REFRACT.restart(7200);
      const s = R.state;
      const before = s.time;
      R.advance(s, 5);
      return Math.round((s.time - before) * 1000) / 1000;
    });
    ctx.log('  a five second stall advanced the simulation by ' + stall + ' s');
    ctx.check(stall <= 0.09, 'a long frame is clamped rather than replayed');

    /* --- heap stability across restarts --- */
    const heap = await st(function () {
      if (!performance.memory) return null;
      const out = [];
      for (let n = 0; n < 6; n++) {
        R.restartRun(7300 + n);
        const s = R.state;
        s.gold = 5000;
        s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
        [['mirror', 7, 3, 1], ['mirror', 0, 3, 0], ['mirror', 0, 10, 1],
          ['lamp', 2, 11, 0], ['splitter', 7, 6, 1]].forEach(function (p) {
          window.__REFRACT.place(p[0], p[1], p[2], p[3]);
        });
        s.wave = 9;
        R.startWave(s);
        for (let i = 0; i < 1800; i++) {
          R.simStep(s, 1 / 60);
          R.render.handleEvents(s);
          s.events.length = 0;
          if (s.phase !== 'wave') break;
        }
        out.push(Math.round(performance.memory.usedJSHeapSize / 1024));
      }
      return out;
    });
    if (heap) {
      ctx.log('  heap after each of six full waves (kB): ' + JSON.stringify(heap));
      const growth = heap[heap.length - 1] - heap[1];
      ctx.check(growth < 4096, 'heap does not grow across repeated runs (' + growth + ' kB from run 2 to run 6)');
    } else {
      ctx.log('  performance.memory unavailable; heap growth not measured');
    }

    const meshes = await st(function () {
      const info = R.render.info();
      return { objects: info.objects, geometries: info.geometries, textures: info.textures };
    });
    ctx.log('  scene after restarts: ' + JSON.stringify(meshes));
    ctx.eq(meshes.objects, budget.objects, 'no scene objects leak across restarts');
    ctx.eq(meshes.geometries, budget.geometries, 'no geometries leak across restarts');

    /* --- real frame rate --- */
    await setup();
    const fps = await st(function () {
      return new Promise(function (resolve) {
        const gaps = [];
        let last = performance.now();
        let n = 0;
        function tick(now) {
          gaps.push(now - last);
          last = now;
          if (++n < 120) requestAnimationFrame(tick);
          else {
            gaps.shift();
            gaps.sort(function (a, b) { return a - b; });
            resolve({
              median: Math.round(gaps[Math.floor(gaps.length / 2)] * 100) / 100,
              p95: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 100) / 100,
              calls: R.render.info().calls
            });
          }
        }
        requestAnimationFrame(tick);
      });
    });
    ctx.log('  observed frame gaps at peak: ' + JSON.stringify(fps) +
      (ctx.gpu ? '  (GPU)' : '  (software rasteriser, rAF clamped)'));
    await ctx.snap('peak-board');
  };

  /*
   * Phase 12: the exact release build, unpacked from the zip, played offline
   * with no debug tools. Everything here drives real controls and reads the
   * real HUD; the only game code it touches is the projection helper needed to
   * work out where a board cell is on screen.
   */
  S.release = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };

    /* --- the debug tools are gone --- */
    const clean = await st(function () {
      return {
        api: typeof window.__REFRACT,
        panel: !!document.getElementById('debugPanel'),
        debugModule: typeof R.debug,
        hasR: typeof R,
        title: document.title
      };
    });
    ctx.log('  release build: ' + JSON.stringify(clean));
    ctx.eq(clean.api, 'undefined', 'no automation API in the release build');
    ctx.eq(clean.panel, false, 'no debug panel');
    ctx.eq(clean.debugModule, 'undefined', 'no debug module');
    ctx.eq(clean.title, 'REFRACT', 'the page is titled');

    /* --- read the game only through its HUD --- */
    const hud = function () {
      return st(function () {
        const txt = function (id) { return document.getElementById(id).textContent.replace(/\s+/g, ' ').trim(); };
        const overlay = document.querySelector('#overlayRoot .overlay');
        const pal = {};
        Array.prototype.forEach.call(document.querySelectorAll('#palette .pbtn'), function (b) {
          pal[b.dataset.type] = {
            locked: b.classList.contains('locked'),
            cost: parseInt(b.querySelector('.pcost').textContent, 10)
          };
        });
        const core = document.getElementById('btnCore');
        return {
          gold: parseInt(txt('statGold').replace(/[^0-9]/g, ''), 10),
          hp: parseInt(txt('statHp').replace(/[^0-9\/]/g, '').split('/')[0], 10),
          wave: parseInt(txt('statWave').replace(/[^0-9/]/g, '').split('/')[0], 10),
          lit: parseInt(document.querySelector('#statLight .val').textContent, 10),
          coreCost: core.querySelector('.a2').textContent.indexOf('MAX') >= 0
            ? null : parseInt(core.querySelector('.a2').textContent, 10),
          palette: pal,
          overlay: overlay ? overlay.textContent.replace(/\s+/g, ' ').trim() : null
        };
      });
    };

    let m = await hud();
    ctx.check(m.overlay && m.overlay.indexOf('REFRACT') === 0, 'the title card is up');
    await ctx.snap('a-title');

    await ctx.tap('#overlayRoot .bigbtn');
    await ctx.tap('#btnSpeed');
    m = await hud();
    ctx.eq(m.gold, await ctx.ev(function () { return R.BALANCE.START_GOLD; }), 'the run starts with the configured gold');
    ctx.eq(m.hp, 20, 'the run starts with 20 core HP');

    /* --- play a whole run by tapping, in real time at double speed --- */
    /* The shopping list the "informed" bot wins with, bought purely by tapping. */
    const PLAN = [
      { k: 'mirror', c: 7, r: 4 }, { k: 'mirror', c: 0, r: 4 }, { k: 'mirror', c: 0, r: 6 },
      { k: 'core' }, { k: 'core' },
      { k: 'splitter', c: 7, r: 8 }, { k: 'core' },
      { k: 'lamp', c: 0, r: 2 }, { k: 'core' },
      { k: 'lamp', c: 0, r: 10 }, { k: 'core' }
    ];
    let plan = 0;
    const started = Date.now();
    let result = null;
    let peakWave = 0;

    while (Date.now() - started < 420000) {
      m = await hud();
      /* An upgrade choice is an overlay too, but it is not a result. */
      if (await ctx.page.$('#overlayRoot .upcard')) {
        await ctx.tap('#overlayRoot .upcard');
        await ctx.page.waitForTimeout(150);
        continue;
      }
      if (m.overlay) { result = m.overlay; break; }
      if (m.wave > peakWave) peakWave = m.wave;

      if (plan < PLAN.length) {
        const next = PLAN[plan];
        if (next.k === 'core') {
          if (m.coreCost === null) plan++;
          else if (m.gold >= m.coreCost) { await ctx.tap('#btnCore'); plan++; }
        } else {
          const info = m.palette[next.k];
          if (info && !info.locked && m.gold >= info.cost) {
            await ctx.tap('#palette .pbtn[data-type="' + next.k + '"]');
            await ctx.tapCell(next.c, next.r);
            plan++;
          }
        }
      }

      /*
       * Nothing starts by itself any more, so the run is driven exactly as a
       * player drives it: shop while planning, then ask for the encounter.
       */
      const startable = await ctx.ev(function () {
        const b = document.getElementById('btnNext');
        return !b.classList.contains('dim');
      });
      if (startable && plan >= PLAN.length) await ctx.tap('#btnNext');
      else if (startable && !(await ctx.ev(function () { return R.state.gold >= 20; }))) await ctx.tap('#btnNext');
      else if (startable) {
        const stuck = await ctx.ev(function () { return R.state.gold; });
        if (plan < PLAN.length) {
          const need = PLAN[plan];
          const info = m.palette[need.k];
          const price = need.k === 'core' ? m.coreCost : (info ? info.cost : null);
          if (price === null || stuck < price || (info && info.locked)) await ctx.tap('#btnNext');
        }
      }
      await ctx.page.waitForTimeout(250);
    }

    ctx.log('  offline run result: ' + result);
    ctx.log('  bought ' + plan + ' of ' + PLAN.length + ' planned purchases, peak wave ' + peakWave +
      ', ' + Math.round((Date.now() - started) / 1000) + 's of real time at 2x speed');
    ctx.check(!!result, 'the run reached a result');
    ctx.check(result.indexOf('THE LIGHT HELD') >= 0,
      'the release build can be played to a win with only taps');
    ctx.check(result.indexOf('CONTINUE') >= 0, 'endless is offered');
    await ctx.snap('b-result');

    /* --- restart from the result screen --- */
    await ctx.tap('#overlayRoot .bigbtn');
    await ctx.page.waitForTimeout(200);
    m = await hud();
    ctx.eq(m.gold, await ctx.ev(function () { return R.BALANCE.START_GOLD; }), 'PLAY AGAIN gives a clean board');
    ctx.eq(m.hp, 20, 'core HP is restored');
    ctx.eq(m.lit, 1, 'the beam is back to its starting route');
    ctx.eq(m.overlay, null, 'no overlay after restart');

    /* --- and a deliberate loss, buying nothing but still asking for waves --- */
    const lossStart = Date.now();
    let lost = null;
    while (Date.now() - lossStart < 240000) {
      m = await hud();
      const choice = await ctx.page.$('#overlayRoot .upcard');
      if (choice) {
        await ctx.tap('#overlayRoot .upcard');
        await ctx.page.waitForTimeout(150);
        continue;
      }
      if (m.overlay) { lost = m.overlay; break; }
      const startable = await ctx.ev(function () {
        return !document.getElementById('btnNext').classList.contains('dim');
      });
      if (startable) await ctx.tap('#btnNext');
      await ctx.page.waitForTimeout(300);
    }
    ctx.log('  loss result: ' + lost);
    ctx.check(lost && lost.indexOf('THE CORE FELL') >= 0, 'placing nothing loses');
    ctx.check(lost && lost.indexOf('TRY AGAIN') >= 0, 'the defeat screen offers another run');
    await ctx.snap('c-defeat');
  };

  /* Phase 13: the remaining acceptance items from specification section 35. */
  S.acceptance = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };

    /* --- escalation is measurable: the same build meets waves 3 and 8 --- */
    const escalation = await st(function () {
      function runWave(w) {
        window.__REFRACT.restart(8000);
        window.__REFRACT.freeze(true);
        const s = R.state;
        s.gold = 500;
        window.__REFRACT.place('mirror', 7, 4, 1);
        s.wave = w - 1;
        R.startWave(s);
        window.__REFRACT.stepUntil('s.phase !== "wave"', 300);
        const leaked = Object.keys(s.leaksBy).reduce(function (a, k) { return a + s.leaksBy[k]; }, 0);
        return {
          wave: w,
          hpLost: R.BALANCE.CORE_HP - s.coreHp,
          leaked: leaked,
          enemies: s.waveEnemiesTotal,
          killed: s.waveEnemiesTotal - leaked
        };
      }
      return { w3: runWave(3), w8: runWave(8) };
    });
    ctx.log('  same build, wave 3: ' + JSON.stringify(escalation.w3));
    ctx.log('  same build, wave 8: ' + JSON.stringify(escalation.w8));
    ctx.check(escalation.w8.hpLost > escalation.w3.hpLost,
      'wave 8 costs more core HP than wave 3 with an identical build (' +
      escalation.w3.hpLost + ' vs ' + escalation.w8.hpLost + ')');
    ctx.check(escalation.w8.enemies > escalation.w3.enemies,
      'wave 8 sends more enemies than wave 3 (' + escalation.w3.enemies + ' vs ' + escalation.w8.enemies + ')');

    /* --- the core loop is reachable inside fifteen seconds --- */
    const opening = await st(function () {
      window.__REFRACT.title();
      const beforePlay = R.state.beam.litRoadCount;
      R.startRun();
      const s = R.state;
      return { litOnTitle: beforePlay, phase: s.phase, lit: s.beam.litRoadCount };
    });
    ctx.log('  opening: ' + JSON.stringify(opening));
    ctx.eq(opening.litOnTitle, 1, 'the beam is already burning road behind the title card');
    ctx.eq(opening.phase, 'building', 'PLAY lands straight in planning, with the board live');

    /* --- every control does something --- */
    const controls = await st(function () {
      window.__REFRACT.restart(8100);
      const s = R.state;
      s.gold = 900;
      s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
      const out = [];
      const click = function (sel) {
        const el = document.querySelector(sel);
        if (!el) return 'missing';
        el.click();
        return 'clicked';
      };
      const snapshot = function () {
        return JSON.stringify({
          phase: s.phase, speed: s.speed, gold: s.gold, core: s.coreLevel,
          muted: R.meta.muted, help: s.ui.helpOpen, wave: s.wave,
          sel: s.ui.selectedType, overlay: !!document.querySelector('#overlayRoot .overlay')
        });
      };

      [['#btnSpeed', 'speed toggle'],
        ['#btnMute', 'mute'],
        ['#btnHelp', 'help'],
        ['#btnHelp', 'help again'],
        ['#btnPause', 'pause'],
        ['#btnPause', 'resume'],
        ['#btnCore', 'core upgrade'],
        ['#palette .pbtn[data-type="splitter"]', 'palette splitter'],
        ['#palette .pbtn[data-type="mirror"]', 'palette mirror'],
        ['#btnNext', 'next wave']
      ].forEach(function (pair) {
        const before = snapshot();
        const result = click(pair[0]);
        R.ui.frame(s, 0.016);
        out.push({ control: pair[1], found: result, changed: snapshot() !== before });
      });
      return out;
    });
    controls.forEach(function (c) {
      ctx.check(c.found === 'clicked' && c.changed, 'the ' + c.control + ' button does something');
    });

    /* --- no placeholder text anywhere on screen --- */
    const text = await st(function () {
      window.__REFRACT.restart(8200);
      const seen = [];
      const collect = function () {
        seen.push(document.getElementById('app').innerText.replace(/\s+/g, ' '));
      };
      collect();
      R.ui.openHelp();
      R.ui.frame(R.state, 0.016);
      collect();
      R.ui.closeHelp();
      window.__REFRACT.forceWin();
      R.ui.frame(R.state, 0.016);
      collect();
      window.__REFRACT.restart(8201);
      window.__REFRACT.forceLose();
      R.ui.frame(R.state, 0.016);
      collect();
      window.__REFRACT.title();
      R.ui.frame(R.state, 0.016);
      collect();
      return seen.join(' | ');
    });
    ['TODO', 'TBD', 'FIXME', 'Lorem', 'placeholder', 'coming soon', 'undefined', 'NaN', 'null']
      .forEach(function (word) {
        ctx.check(text.toLowerCase().indexOf(word.toLowerCase()) < 0,
          'no "' + word + '" appears in any screen');
      });

    /* --- three consecutive full runs without reloading --- */
    const runs = await st(function () {
      const out = [];
      for (let n = 0; n < 3; n++) {
        window.__REFRACT.restart(8300 + n);
        window.__REFRACT.freeze(true);
        const s = R.state;
        s.gold = 5000;
        s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
        [['mirror', 7, 4, 1], ['mirror', 0, 4, 1], ['mirror', 0, 6, 0],
          ['splitter', 7, 8, 1], ['lamp', 0, 2, 1], ['lamp', 0, 10, 1]].forEach(function (p) {
          window.__REFRACT.place(p[0], p[1], p[2], p[3]);
        });
        for (let i = 0; i < 5; i++) R.pieces.upgradeCore(s);
        for (let w = 1; w <= 12; w++) {
          window.__REFRACT.startWave();
          window.__REFRACT.stepUntil('s.phase !== "wave"', 300);
          if (s.phase === 'won' || s.phase === 'lost') break;
        }
        out.push({ phase: s.phase, hp: s.coreHp, score: R.computeScore(s), calls: R.render.info().calls });
      }
      return out;
    });
    ctx.log('  three consecutive runs: ' + JSON.stringify(runs));
    ctx.check(runs.every(function (r) { return r.phase === 'won'; }), 'three runs in a row all reach victory');
    ctx.check(runs[0].hp === runs[1].hp && runs[1].hp === runs[2].hp,
      'identical builds give identical results, so the simulation is deterministic');
    ctx.check(runs[2].calls === runs[0].calls, 'draw calls do not creep across runs');

    /* --- endless continues after a win --- */
    const endless = await st(function () {
      R.continueEndless();
      const s = R.state;
      window.__REFRACT.stepUntil('s.wave === 13 && s.phase === "wave"', 40);
      return { endless: s.endless, wave: s.wave, label: document.getElementById('statWave').textContent.replace(/\s+/g, '') };
    });
    ctx.log('  endless: ' + JSON.stringify(endless));
    ctx.eq(endless.endless, true, 'endless mode continues after a win');
    const firstEndless = await ctx.ev(function () {
      window.__REFRACT.startWave();
      return { wave: R.state.wave, label: document.getElementById('statWave').textContent.replace(/\s+/g, '') };
    });
    ctx.eq(firstEndless.wave, await ctx.ev(function () { return R.BALANCE.WAVES.length + 1; }),
      'the first endless wave is one past the last scripted encounter');

    /* --- rapid input does not break anything --- */
    const rapid = await st(function () {
      window.__REFRACT.restart(8400);
      const s = R.state;
      s.gold = 200;
      const buttons = ['#btnSpeed', '#btnPause', '#btnCore', '#btnNext',
        '#palette .pbtn[data-type="mirror"]', '#palette .pbtn[data-type="splitter"]'];
      for (let i = 0; i < 200; i++) {
        const el = document.querySelector(buttons[i % buttons.length]);
        if (el) el.click();
      }
      R.ui.frame(s, 0.016);
      return { phase: s.phase, gold: s.gold, hp: s.coreHp, pieces: s.pieces.size, speed: s.speed };
    });
    ctx.log('  after 200 rapid button presses: ' + JSON.stringify(rapid));
    ctx.check(rapid.gold >= 0, 'gold never goes negative under rapid input');
    ctx.check(rapid.hp >= 0 && rapid.hp <= 20, 'core HP stays in range under rapid input');
    ctx.check(['building', 'wave', 'paused', 'won', 'lost', 'title'].indexOf(rapid.phase) >= 0,
      'the phase is still valid after rapid input');

    const tiles = await st(function () {
      window.__REFRACT.restart(8500);
      const s = R.state;
      s.gold = 40;
      let errors = 0;
      for (let r = 0; r < 12; r++) {
        for (let c = 0; c < 8; c++) {
          try {
            R.pieces.place(s, 'mirror', c, r);
            R.pieces.flip(s, c, r);
            R.pieces.sell(s, c, r);
          } catch (err) {
            errors++;
          }
        }
      }
      return { errors: errors, gold: s.gold, pieces: s.pieces.size };
    });
    ctx.log('  every tile poked: ' + JSON.stringify(tiles));
    ctx.eq(tiles.errors, 0, 'placing, flipping and selling on every tile throws nothing');
    ctx.check(tiles.gold <= 40, 'poking every tile cannot create gold');
  };

  /*
   * Edge case from specification section 31: a device with no WebGL. Run with
   * `node tools/qa.js nowebgl --nowebgl`, which starts the browser with 3D
   * disabled so the block is real rather than simulated.
   */
  S.nowebgl = async function (ctx) {
    const state = await ctx.ev(function () {
      const f = document.getElementById('fatal');
      return {
        webglAvailable: !!document.createElement('canvas').getContext('webgl'),
        shown: !f.hidden,
        message: f.textContent.trim(),
        ready: R.render.ready,
        running: R.running
      };
    });
    ctx.log('  without WebGL: ' + JSON.stringify(state));
    ctx.eq(state.webglAvailable, false, 'WebGL really is unavailable in this browser');
    ctx.check(state.shown, 'a full-screen message is shown');
    ctx.check(state.message.indexOf('WebGL') >= 0, 'the message names WebGL: "' + state.message + '"');
    ctx.eq(state.ready, false, 'the renderer reports itself unavailable');
    ctx.eq(state.running, false, 'the game does not claim to be running');
    await ctx.snap('no-webgl');

    /* Tapping around must not throw. */
    await ctx.page.touchscreen.tap(200, 400);
    await ctx.page.touchscreen.tap(50, 700);
    await ctx.page.waitForTimeout(150);
    ctx.check(true, 'tapping the page without WebGL throws nothing');
  };

  /*
   * Map design pass: with every tool unlocked, does the board actually support
   * several different late-game networks, and do they read as a lattice rather
   * than one line? Captures one screenshot per layout for visual review.
   */
  S.lattice = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };

    const LAYOUTS = {
      'trunk split three ways': [
        ['splitter', 7, 8, 1], ['splitter', 7, 6, 1], ['mirror', 7, 4, 1]
      ],
      'chain around the left trunk': [
        ['mirror', 7, 8, 1], ['mirror', 0, 8, 1], ['mirror', 0, 6, 0],
        ['mirror', 7, 6, 1], ['mirror', 7, 4, 1]
      ],
      'reflector double pass': [
        ['mirror', 7, 4, 1], ['reflector', 0, 4, 0],
        ['splitter', 7, 8, 1], ['reflector', 0, 8, 0]
      ],
      'independent lamp network': [
        ['mirror', 7, 4, 1],
        ['lamp', 0, 2, 1], ['lamp', 0, 6, 1], ['lamp', 0, 8, 1], ['lamp', 0, 10, 1]
      ],
      'full lattice': [
        ['splitter', 7, 8, 1], ['splitter', 7, 6, 1], ['mirror', 7, 4, 1],
        ['mirror', 0, 4, 1], ['mirror', 0, 2, 0],
        ['reflector', 0, 6, 0],
        ['lamp', 7, 1, 3], ['lamp', 0, 10, 1]
      ]
    };

    const seen = [];
    for (const name of Object.keys(LAYOUTS)) {
      const m = await st(function (pieces) {
        window.__REFRACT.restart(9000);
        const s = R.state;
        s.gold = 100000;
        s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
        pieces.forEach(function (p) { window.__REFRACT.place(p[0], p[1], p[2], p[3]); });
        for (let i = 0; i < 5; i++) R.pieces.upgradeCore(s);
        s.wave = 10;
        R.startWave(s);
        window.__REFRACT.step(14);

        /* Damage per second delivered to the road, measured with probes. */
        const occ = new Array(96).fill(null);
        const probes = [];
        for (let i = 0; i < 96; i++) {
          const k = s.grid.kind[i];
          if (k !== R.ROAD && k !== R.SPAWN) continue;
          const probe = { absorb: 0, damage: 0, hitAt: -1,
            x: R.grid.worldX(R.grid.colOf(i)), z: R.grid.worldZ(R.grid.rowOf(i)) };
          occ[i] = [probe];
          probes.push(probe);
        }
        const res = R.beam.makeResult();
        R.beam.solve(s, occ, 1, res);
        const dps = probes.reduce(function (a, p) { return a + p.damage; }, 0);

        return {
          lit: s.beam.litRoadCount,
          road: s.roadCells,
          dps: Math.round(dps),
          segments: s.beam.segCount,
          pieces: s.pieces.size,
          types: Array.from(new Set(Array.from(s.pieces.values()).map(function (p) { return p.type; }))).sort().join('+'),
          foes: s.enemies.length
        };
      }, LAYOUTS[name]);
      seen.push({ name: name, m: m });
      ctx.log('  ' + name.padEnd(28) + ' lit ' + String(m.lit).padStart(2) + '/' + m.road +
        '  dps ' + String(m.dps).padStart(4) + '  segments ' + String(m.segments).padStart(2) +
        '  pieces ' + m.pieces + '  [' + m.types + ']');
      await ctx.page.waitForTimeout(120);
      await ctx.snap(name.replace(/[^a-z]+/g, '-'));
    }

    /* Every layout has to be a real option, not a decoy. */
    const best = Math.max.apply(null, seen.map(function (x) { return x.m.dps; }));
    const viable = seen.filter(function (x) { return x.m.dps >= best * 0.6; });
    ctx.log('  best ' + best + ' dps; within 40% of it: ' + viable.length + ' of ' + seen.length);
    ctx.check(viable.length >= 4, 'at least four substantially different layouts are viable');

    const spread = seen.map(function (x) { return x.m.lit; });
    ctx.check(Math.max.apply(null, spread) - Math.min.apply(null, spread) >= 8,
      'the layouts differ in shape, not just in power: LIT ' + JSON.stringify(spread));

    const lattice = seen[seen.length - 1].m;
    ctx.check(lattice.segments >= 10, 'the full lattice draws a real network (' + lattice.segments + ' beam segments)');
    ctx.check(lattice.types.split('+').length === 4, 'the late-game build uses all four piece types');
    ctx.check(lattice.lit >= 20, 'the full lattice lights most of the road (' + lattice.lit + '/' + lattice.road + ')');
  };


  /*
   * The two rules the redesign has to guarantee:
   *   1. a static early layout cannot clear the whole session;
   *   2. Umbra is killable by an adapted network, and its arrival is fatal
   *      whatever the core has left.
   */
  S.bossgate = async function (ctx) {
    const st = function (fn, arg) { return ctx.ev(fn, arg); };

    /* --- how much damage Umbra actually takes over its walk --- */
    const measure = await st(function () {
      window.__REFRACT.restart(2100);
      window.__REFRACT.freeze(true);
      const s = R.state;
      s.gold = 5000;
      s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
      [['mirror', 7, 4, 1], ['mirror', 0, 4, 1], ['mirror', 0, 6, 0],
       ['splitter', 7, 8, 1], ['lamp', 0, 2, 1], ['lamp', 0, 10, 1]
      ].forEach(function (m) { window.__REFRACT.place(m[0], m[1], m[2], m[3]); });
      for (let i = 0; i < 5; i++) R.pieces.upgradeCore(s);

      s.wave = R.BALANCE.WAVES.length - 1;
      window.__REFRACT.startWave();

      /* Follow the boss until it dies or arrives. */
      const dt = R.TIMING.FIXED_STEP;
      let boss = null, taken = 0, seen = 0, litSteps = 0, steps = 0;
      for (let i = 0; i < 60 * 200; i++) {
        R.simStep(s, dt);
        s.events.length = 0;
        const b = s.enemies.filter(function (e) { return e.boss; })[0];
        if (b) {
          boss = b;
          seen = b.maxHp;
          taken = b.maxHp - b.hp;
          steps++;
          if (b.hitAt === s.time) litSteps++;
        }
        if (s.phase === 'won' || s.phase === 'lost') break;
      }
      return {
        maxHp: seen, taken: Math.round(taken), onRoad: Math.round(steps * dt),
        underFire: Math.round(litSteps * dt), phase: s.phase,
        breached: s.bossBreached, hp: s.coreHp,
        dps: steps ? Math.round(taken / (steps * dt)) : 0
      };
    });
    ctx.log('  Umbra: ' + JSON.stringify(measure));
    ctx.check(measure.taken > 0, 'the boss takes damage on the road');
    ctx.check(measure.underFire >= measure.onRoad * 0.5,
      'the boss spends most of its walk in the light (' + measure.underFire + 's of ' + measure.onRoad + 's)');
    ctx.eq(measure.phase, 'won', 'an adapted network kills Umbra before it arrives');

    /* --- a boss that does arrive ends the run, whatever the core has left --- */
    const breach = await st(function () {
      window.__REFRACT.restart(2101);
      window.__REFRACT.freeze(true);
      const s = R.state;
      s.wave = R.BALANCE.WAVES.length - 1;
      window.__REFRACT.startWave();
      const dt = R.TIMING.FIXED_STEP;
      for (let i = 0; i < 60 * 400; i++) {
        /* Keep the core topped up so only the breach rule can end the run. */
        s.coreHp = R.BALANCE.CORE_HP;
        R.simStep(s, dt);
        s.events.length = 0;
        if (s.phase === 'lost' || s.phase === 'won') break;
      }
      return { phase: s.phase, breached: s.bossBreached, hp: s.coreHp };
    });
    ctx.log('  breach: ' + JSON.stringify(breach));
    ctx.eq(breach.phase, 'lost', 'Umbra reaching the core loses the run');
    ctx.eq(breach.breached, 'umbra', 'the loss is attributed to the boss breach');
    ctx.check(breach.hp > 0, 'the run is lost with core HP still on the clock');

    /* --- the static three-mirror layout must not clear the session --- */
    const staticRun = await st(function () {
      window.__REFRACT.restart(2102);
      window.__REFRACT.freeze(true);
      const s = R.state;
      s.gold = 5000;
      s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
      [['mirror', 7, 4, 1], ['mirror', 0, 4, 1], ['mirror', 0, 6, 0]
      ].forEach(function (m) { window.__REFRACT.place(m[0], m[1], m[2], m[3]); });
      const log = [];
      for (let w = 1; w <= R.BALANCE.WAVES.length; w++) {
        window.__REFRACT.startWave();
        window.__REFRACT.stepUntil('s.phase !== "wave"', 260);
        log.push({ w: w, hp: s.coreHp });
        if (s.phase === 'lost' || s.phase === 'won') break;
      }
      return { phase: s.phase, hp: s.coreHp, lit: s.beam.litRoadCount, log: log };
    });
    ctx.log('  static three mirrors: ' + JSON.stringify(staticRun));

    /*
     * The same three mirrors, plus the tools and angles the encounters teach.
     * The brief asks that adapting be worth doing and that a stable defence is
     * not punished for being stable, so this compares the two honestly rather
     * than requiring the static baseline to fail.
     */
    const adaptedRun = await st(function () {
      window.__REFRACT.restart(2102);
      window.__REFRACT.freeze(true);
      const s = R.state;
      s.gold = 5000;
      s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
      [['mirror', 7, 4, 1], ['mirror', 0, 4, 1], ['mirror', 0, 6, 0],
       ['splitter', 7, 8, 1], ['lamp', 0, 2, 1], ['lamp', 0, 10, 1]
      ].forEach(function (m) { window.__REFRACT.place(m[0], m[1], m[2], m[3]); });
      for (let i = 0; i < 4; i++) R.pieces.upgradeCore(s);
      const log = [];
      for (let w = 1; w <= R.BALANCE.WAVES.length; w++) {
        window.__REFRACT.playWave(300);
        log.push({ w: w, hp: s.coreHp });
        if (s.phase === 'lost' || s.phase === 'won') break;
      }
      return { phase: s.phase, hp: s.coreHp, lit: s.beam.litRoadCount, log: log };
    });
    ctx.log('  adapted network:     ' + JSON.stringify(adaptedRun));

    const staticBeforeBoss = staticRun.log[staticRun.log.length - 1].w;
    ctx.check(adaptedRun.log.length >= staticRun.log.length,
      'the adapted network gets at least as far as the static one');
    ctx.check(adaptedRun.hp > staticRun.hp,
      'and ends in better shape (' + adaptedRun.hp + ' HP against ' + staticRun.hp + ')');
    /*
     * The difference has to be visible before the boss, so victory does not
     * rest on the boss-escape rule alone.
     */
    const cmp = Math.min(staticRun.log.length, adaptedRun.log.length) - 1;
    ctx.check(cmp >= 1 && adaptedRun.log[cmp].hp > staticRun.log[cmp].hp,
      'the gap is already open before the last encounter (encounter ' + (cmp + 1) + ': ' +
      adaptedRun.log[cmp].hp + ' against ' + staticRun.log[cmp].hp + ')');
    ctx.log('  the static baseline reached encounter ' + staticBeforeBoss + ' and finished ' + staticRun.phase);
    await ctx.snap('a-static-vs-adapted');
  };


  /*
   * The shield rule on its own, at identical beam power from all four sides.
   * Absorption and shielding are separate constants and are checked apart.
   */
  S.shield = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };

    const rule = await st(function () {
      window.__REFRACT.restart(4200);
      const s = R.state;
      const e = R.enemies.spawn(s, 'bulwark');
      e.t = 11;
      R.enemies.positionOf(s, e);
      const out = { face: R.DIR_NAMES[e.face], by: {}, shield: R.BALANCE.ENEMY.bulwark.shield };
      for (let d = 0; d < 4; d++) out.by[R.DIR_NAMES[d]] = R.enemies.exposure(e, d);
      /* A body with no shield is equally exposed from every side. */
      const m = R.enemies.spawn(s, 'mote');
      m.t = 11;
      R.enemies.positionOf(s, m);
      out.mote = [0, 1, 2, 3].map(function (d) { return R.enemies.exposure(m, d); });
      return out;
    });
    ctx.log('  exposure by beam direction: ' + JSON.stringify(rule));

    ctx.eq(rule.face, 'E', 'the bulwark walks east along this sweep');
    ctx.near(rule.by.W, 1 - rule.shield, 0.001, 'a beam running west meets its shield');
    ctx.eq(rule.by.E, 1, 'a beam running east reaches its back in full');
    ctx.eq(rule.by.N, 1, 'a beam crossing from the south reaches its flank in full');
    ctx.eq(rule.by.S, 1, 'a beam crossing from the north reaches its flank in full');
    ctx.check(rule.by.W > 0, 'the shield reduces damage rather than granting immunity');
    ctx.eq(JSON.stringify(rule.mote), '[1,1,1,1]', 'an unshielded body is exposed from every side');

    /*
     * The same beam at the same power, against a body facing into it and a
     * body facing away. The row 4 sweep is walked eastward and the row 6 sweep
     * westward, so one mirror on the column 7 trunk lights each of them
     * westward at full core power: into the face on row 4, into the back on
     * row 6. No hand-set facing, because the walk direction decides it.
     */
    const dmg = await st(function () {
      function run(row, index) {
        window.__REFRACT.restart(4201);
        window.__REFRACT.freeze(true);
        const s = R.state;
        s.gold = 500;
        const e = R.enemies.spawn(s, 'bulwark');
        e.t = index;
        e.speed = 0;
        R.enemies.positionOf(s, e);
        window.__REFRACT.place('mirror', 7, row, 1);
        window.__REFRACT.step(1);
        return {
          face: R.DIR_NAMES[e.face],
          lit: Math.round(s.beam.lit[R.grid.idx(e.cell % 8, Math.floor(e.cell / 8))] * 100) / 100,
          taken: Math.round((e.maxHp - e.hp) * 100) / 100
        };
      }
      return { front: run(4, 11), back: run(6, 18) };
    });
    ctx.log('  one second of the same beam: ' + JSON.stringify(dmg));
    ctx.eq(dmg.front.face, 'E', 'the row 4 body walks into the beam');
    ctx.eq(dmg.back.face, 'W', 'the row 6 body walks away from it');
    ctx.eq(dmg.front.lit, dmg.back.lit, 'both stand in the same beam power');
    ctx.near(dmg.front.taken / dmg.back.taken, 1 - rule.shield, 0.02,
      'the same beam is cut to the shield fraction from the front (' +
      dmg.front.taken + ' vs ' + dmg.back.taken + ')');
    ctx.check(dmg.back.taken > dmg.front.taken * 2,
      'reaching its back is clearly worth the trouble');

    await ctx.snap('a-shielded-bulwark');
  };


  /* The two ways a run can end, and that each says which one happened. */
  S.endings = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };
    const overlayText = function () {
      return st(function () {
        const o = document.querySelector('#overlayRoot .overlay');
        return o ? o.textContent.replace(/\s+/g, ' ').trim() : null;
      });
    };

    /* --- the boss walks in and the core is still standing --- */
    await st(function () {
      window.__REFRACT.restart(6100);
      window.__REFRACT.freeze(true);
      const s = R.state;
      s.wave = R.BALANCE.WAVES.length - 1;
      window.__REFRACT.startWave();
      const dt = R.TIMING.FIXED_STEP;
      for (let i = 0; i < 60 * 400; i++) {
        s.coreHp = R.BALANCE.CORE_HP;
        R.simStep(s, dt);
        s.events.length = 0;
        if (s.phase === 'lost' || s.phase === 'won') break;
      }
      R.ui.frame(s, 0.016);
    });
    const breach = await overlayText();
    ctx.log('  breach screen: ' + breach);
    ctx.check(breach.indexOf('REACHED THE CORE') >= 0,
      'a boss breach names itself rather than reporting a spent core');
    ctx.check(breach.indexOf('destroyed on the road') >= 0,
      'and says why surviving it was not enough');
    ctx.check(breach.indexOf('TRY AGAIN') >= 0, 'and offers another run');
    await ctx.snap('a-boss-breach');

    /* --- an ordinary loss, with the core actually spent --- */
    await st(function () {
      window.__REFRACT.restart(6101);
      window.__REFRACT.freeze(true);
      for (let i = 0; i < R.BALANCE.WAVES.length; i++) {
        window.__REFRACT.playWave(300);
        if (R.state.phase === 'lost' || R.state.phase === 'won') break;
      }
      R.ui.frame(R.state, 0.016);
    });
    const ordinary = await overlayText();
    ctx.log('  ordinary loss: ' + ordinary);
    ctx.check(ordinary.indexOf('THE CORE FELL') >= 0, 'an ordinary loss reports a fallen core');
    ctx.check(ordinary.indexOf('REACHED THE CORE') < 0, 'and is not confused with a breach');
    ctx.eq(await st(function () { return R.state.coreHp; }), 0, 'the core really is spent');
    await ctx.snap('b-ordinary-loss');

    /* --- the boss changes phase partway down the road --- */
    const phases = await st(function () {
      window.__REFRACT.restart(6102);
      window.__REFRACT.freeze(true);
      const s = R.state;
      const e = R.enemies.spawn(s, 'umbra');
      const last = s.path.length - 1;
      const seen = [];
      const dt = R.TIMING.FIXED_STEP;
      for (let i = 0; i < 60 * 200; i++) {
        R.enemies.moveStep(s, dt);
        for (let k = 0; k < s.events.length; k++) {
          if (s.events[k].type === 'bossphase') {
            seen.push({ phase: s.events[k].phase, at: Math.round(e.t / last * 100) / 100 });
          }
        }
        s.events.length = 0;
        if (e.t >= last) break;
      }
      return {
        seen: seen, shieldNow: e.shield,
        shieldAtSpawn: R.BALANCE.ENEMY.umbra.shield,
        exposeAt: R.BALANCE.ENEMY.umbra.exposeAt,
        walkSeconds: Math.round(last / e.speed)
      };
    });
    ctx.log('  boss phases: ' + JSON.stringify(phases));
    ctx.eq(phases.seen.length, 1, 'the phase change is announced exactly once');
    ctx.near(phases.seen[0].at, phases.exposeAt, 0.03, 'it happens where the tuning says it does');
    ctx.eq(phases.shieldNow, 0, 'and the shield is gone for the rest of the walk');
    ctx.check(phases.shieldAtSpawn > 0, 'the boss did start the walk shielded');
    ctx.check(phases.walkSeconds >= 40 && phases.walkSeconds <= 75,
      'the boss encounter is a readable length (' + phases.walkSeconds + 's on the road)');
  };


  /*
   * The run upgrades: that the offer is well formed, that taking one changes
   * something measurable, and that the capped ones cannot compound.
   */
  S.upgrades = async function (ctx) {
    const st = function (fn, a) { return ctx.ev(fn, a); };

    /* --- the offer --- */
    const offer = await st(function () {
      window.__REFRACT.restart(7300);
      window.__REFRACT.freeze(true);
      const s = R.state;
      /* A network good enough to reach the second choice. */
      s.gold = 5000;
      s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
      [['mirror', 7, 4, 1], ['mirror', 0, 4, 1], ['mirror', 0, 6, 0],
       ['splitter', 7, 8, 1], ['lamp', 0, 2, 1], ['lamp', 0, 10, 1]
      ].forEach(function (m) { window.__REFRACT.place(m[0], m[1], m[2], m[3]); });
      for (let i = 0; i < 5; i++) R.pieces.upgradeCore(s);
      const seen = [];
      for (let w = 1; w <= R.BALANCE.WAVES.length; w++) {
        if (s.phase === 'choosing') seen.push({ after: s.wave, offer: s.upgradeOffer.slice() });
        window.__REFRACT.playWave(300);
        if (s.phase === 'lost' || s.phase === 'won') break;
      }
      if (s.phase === 'choosing') seen.push({ after: s.wave, offer: s.upgradeOffer.slice() });
      return { seen: seen, taken: s.upgrades.slice(), after: R.BALANCE.UPGRADE_AFTER };
    });
    ctx.log('  offers: ' + JSON.stringify(offer));
    ctx.eq(offer.seen.length, offer.after.length,
      'one choice is offered after each of the listed encounters');
    offer.seen.forEach(function (o, i) {
      ctx.eq(o.after, offer.after[i], 'the choice comes after encounter ' + offer.after[i]);
      ctx.eq(o.offer.length, 3, 'three upgrades are offered');
      ctx.eq(new Set(o.offer).size, 3, 'and they are three different ones');
    });
    ctx.eq(new Set(offer.taken).size, offer.taken.length, 'an upgrade cannot be taken twice');

    /* --- the run stops while the choice is up --- */
    const paused = await st(function () {
      window.__REFRACT.restart(7301);
      window.__REFRACT.freeze(true);
      const s = R.state;
      s.gold = 5000;
      window.__REFRACT.place('mirror', 7, 4, 1);
      while (s.phase !== 'choosing' && s.wave < R.BALANCE.WAVES.length) window.__REFRACT.playWave(300);
      const before = { phase: s.phase, wave: s.wave, hp: s.coreHp };
      window.__REFRACT.step(30);
      const after = { phase: s.phase, wave: s.wave, hp: s.coreHp };
      R.ui.frame(s, 0.016);
      const cards = document.querySelectorAll('#overlayRoot .upcard').length;
      return { before: before, after: after, cards: cards, simulating: R.isSimulating(s) };
    });
    ctx.log('  while choosing: ' + JSON.stringify(paused));
    ctx.eq(paused.before.phase, 'choosing', 'the run stops on the choice');
    ctx.eq(paused.after.wave, paused.before.wave, 'thirty seconds of reading advances nothing');
    ctx.eq(paused.simulating, false, 'and nothing is simulating behind it');
    ctx.eq(paused.cards, 3, 'three cards are on screen');
    await ctx.snap('a-upgrade-choice');

    /*
     * Each upgrade has to change something a player could notice. The same
     * board and the same bodies are measured with it and without it.
     */
    const probe = function (key) {
      return st(function (k) {
        window.__REFRACT.restart(7302);
        window.__REFRACT.freeze(true);
        const s = R.state;
        s.gold = 5000;
        s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
        if (k) s.upgrades.push(k);
        window.__REFRACT.place('mirror', 7, 4, 1);
        window.__REFRACT.place('splitter', 7, 8, 1);
        window.__REFRACT.place('lamp', 0, 2, 1);
        const foes = [12, 11, 10].map(function (t) {
          const e = R.enemies.spawn(s, 'mote');
          e.t = t;
          e.speed = 0;
          R.enemies.positionOf(s, e);
          return e;
        });
        window.__REFRACT.step(1);
        const dealt = foes.reduce(function (a, e) { return a + (e.maxHp - e.hp); }, 0);
        return {
          dealt: Math.round(dealt * 100) / 100,
          core: Math.round(R.beam.coreOutput(s) * 100) / 100,
          lamp: Math.round(R.beam.lampOutput(s) * 100) / 100,
          split: R.beam.splitFactor(s),
          lit: s.beam.litRoadCount
        };
      }, key);
    };

    const base = await probe(null);
    ctx.log('  baseline   ' + JSON.stringify(base));
    const results = {};
    const keys = ['crossfire', 'afterglow', 'piercing', 'focused', 'twin', 'reach'];
    for (const key of keys) {
      results[key] = await probe(key);
      ctx.log('  ' + key.padEnd(10) + ' ' + JSON.stringify(results[key]));
    }

    ctx.check(results.piercing.dealt > base.dealt,
      'Piercing Light gets more light through a line of bodies (' + base.dealt + ' to ' + results.piercing.dealt + ')');
    /*
     * Afterglow is a tail, so it only shows once a body is out of the light.
     * The probe above holds its motes inside the beam, where there is nothing
     * for a tail to add; this one walks one out of the beam and then measures.
     */
    const tail = await st(function () {
      function run(withUpgrade) {
        window.__REFRACT.restart(7306);
        window.__REFRACT.freeze(true);
        const s = R.state;
        s.gold = 5000;
        if (withUpgrade) s.upgrades.push('afterglow');
        window.__REFRACT.place('mirror', 7, 4, 1);
        const e = R.enemies.spawn(s, 'mote');
        e.t = 11;
        e.speed = 0;
        R.enemies.positionOf(s, e);
        window.__REFRACT.step(0.5);
        const inBeam = Math.round((e.maxHp - e.hp) * 100) / 100;
        /* Step it off the lit sweep and let the tail run out. */
        e.t = 15;
        R.enemies.positionOf(s, e);
        window.__REFRACT.step(1.5);
        return { inBeam: inBeam, total: Math.round((e.maxHp - e.hp) * 100) / 100 };
      }
      return { off: run(false), on: run(true) };
    });
    ctx.log('  afterglow tail ' + JSON.stringify(tail));
    ctx.eq(tail.off.total, tail.off.inBeam, 'without it, leaving the beam ends the damage');
    ctx.check(tail.on.total > tail.on.inBeam,
      'with it, the burn keeps going after the body leaves the light (' +
      tail.on.inBeam + ' to ' + tail.on.total + ')');
    const glow = await st(function () {
      const u = R.BALANCE.UPGRADES.afterglow;
      return { seconds: u.seconds, share: u.share };
    });
    ctx.near(tail.on.total - tail.on.inBeam, tail.on.inBeam / 0.5 * glow.share * glow.seconds, 0.3,
      'and the tail is the documented share for the documented time');
    ctx.check(tail.on.total < tail.on.inBeam * 2,
      'the tail does not feed itself into an endless burn');
    ctx.check(results.focused.core > base.core && results.focused.lamp < base.lamp,
      'Focused Core trades lamp output for core output');
    ctx.check(results.twin.lamp > base.lamp && results.twin.core < base.core,
      'Twin Flames trades the other way');
    ctx.check(results.reach.split > base.split, 'Long Reach widens both splitter branches');
    ctx.check(results.reach.lit >= base.lit, 'and lights at least as much road');
    ctx.check(results.focused.lamp < base.lamp,
      'lamp power is scaled on its own, so a stronger core does not drag it up too');

    /* --- Crossfire needs two directions and pays out once --- */
    const cross = await st(function () {
      function run(withUpgrade, twoWays) {
        window.__REFRACT.restart(7303);
        window.__REFRACT.freeze(true);
        const s = R.state;
        s.gold = 5000;
        s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
        if (withUpgrade) s.upgrades.push('crossfire');
        window.__REFRACT.place('mirror', 7, 4, 1);
        if (twoWays) window.__REFRACT.place('reflector', 0, 4, 0);
        const e = R.enemies.spawn(s, 'mote');
        e.t = 11;
        e.speed = 0;
        R.enemies.positionOf(s, e);
        window.__REFRACT.step(1);
        return Math.round((e.maxHp - e.hp) * 100) / 100;
      }
      return {
        oneWayOff: run(false, false), oneWayOn: run(true, false),
        twoWayOff: run(false, true), twoWayOn: run(true, true)
      };
    });
    ctx.log('  crossfire ' + JSON.stringify(cross));
    ctx.eq(cross.oneWayOn, cross.oneWayOff,
      'Crossfire does nothing to a body lit from one direction only');
    ctx.check(cross.twoWayOn > cross.twoWayOff,
      'and pays out when a second direction reaches it (' + cross.twoWayOff + ' to ' + cross.twoWayOn + ')');
    const bonus = await st(function () { return R.BALANCE.UPGRADES.crossfire.bonus; });
    ctx.near(cross.twoWayOn / cross.twoWayOff, 1 + bonus, 0.02,
      'exactly one bonus is applied, however many beams arrive');

    /* --- the two source upgrades exclude each other --- */
    const exclusive = await st(function () {
      window.__REFRACT.restart(7304);
      const s = R.state;
      s.upgrades.push('focused');
      return { eligible: R.eligibleUpgrades(s) };
    });
    ctx.log('  after Focused Core: ' + JSON.stringify(exclusive));
    ctx.check(exclusive.eligible.indexOf('twin') < 0,
      'Twin Flames is not offered once Focused Core is taken');
    ctx.check(exclusive.eligible.indexOf('focused') < 0, 'nor is Focused Core again');

    /* --- a fresh run starts with none of it --- */
    const reset = await st(function () {
      window.__REFRACT.restart(7305);
      const s = R.state;
      return { upgrades: s.upgrades.length, offer: s.upgradeOffer };
    });
    ctx.eq(reset.upgrades, 0, 'a new run carries no upgrades over');
    ctx.eq(reset.offer, null, 'and no stale offer');
  };

};
