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
        return document.getElementById('statLit').textContent + ' / ' +
               document.getElementById('statGold').textContent;
      });
    };

    ctx.eq(await lit(), 1, 'default beam lights one road cell');
    ctx.check((await hud()).replace(/\s+/g, '') === 'LIT1/25/◆40', 'HUD shows LIT 1/25 and 40 gold');
    await ctx.snap('a-default');

    await ctx.tapCell(7, 3);
    ctx.eq(await lit(), 7, 'mirror at (7,3) lights row 3');
    ctx.eq(await gold(), 20, 'gold after one mirror');
    ctx.eq(await ctx.ev(function () { return R.pieces.at(R.state, 7, 3).orient; }), 1, 'smart orientation');
    await ctx.snap('b-mirror73');

    await ctx.tapCell(7, 3);
    ctx.check(await ctx.ev(function () { return R.state.ui.selectedPieceId !== null; }),
      'tapping a placed piece selects it');
    await ctx.tap('#actionBar button:nth-child(1)');
    ctx.eq(await lit(), 1, 'flipping sends the beam off the board');
    ctx.eq(await gold(), 20, 'flipping is free');
    await ctx.snap('c-flipped');

    await ctx.ev(function () { window.__REFRACT.restart(11); });
    ctx.eq(await lit(), 1, 'fresh board is back to one lit cell');
    await ctx.tapCell(7, 6);
    ctx.eq(await lit(), 6, 'mirror at (7,6) lights row 6');
    await ctx.snap('d-mirror76');

    await ctx.ev(function () { window.__REFRACT.restart(11); window.__REFRACT.setGold(200); });
    await ctx.tapCell(7, 3);
    await ctx.tapCell(0, 3);
    await ctx.tapCell(0, 10);
    ctx.eq(await lit(), 12, 'three mirror chain lights twelve road cells');
    ctx.eq(await gold(), 140, 'three mirrors cost 60');
    const chain = await ctx.ev(function () {
      return [R.pieces.at(R.state, 7, 3).orient, R.pieces.at(R.state, 0, 3).orient, R.pieces.at(R.state, 0, 10).orient];
    });
    ctx.eq(JSON.stringify(chain), '[1,0,1]', 'chain orientations');
    await ctx.snap('e-chain');

    await ctx.tapCell(1, 1);
    ctx.eq(await ctx.ev(function () { return R.state.pieces.size; }), 3, 'a road tile refuses a piece');
    await ctx.tapCell(7, 11);
    ctx.eq(await ctx.ev(function () { return R.state.pieces.size; }), 3, 'the core tile refuses a piece');
    await ctx.tapCell(1, 0);
    ctx.eq(await ctx.ev(function () { return R.state.pieces.size; }), 3, 'the spawn tile refuses a piece');

    /* Twenty rapid taps on one tile must buy exactly one mirror. */
    const before = await ctx.ev(function () { return R.state.pieces.size; });
    const pt = await ctx.cellPoint(5, 8);
    for (let i = 0; i < 20; i++) await ctx.page.touchscreen.tap(pt.x, pt.y);
    await ctx.page.waitForTimeout(80);
    ctx.eq(await ctx.ev(function () { return R.state.pieces.size; }), before + 1, 'rapid taps buy one piece');

    await ctx.ev(function () { window.__REFRACT.setGold(15); R.pieces.deselect(R.state); });
    const n = await ctx.ev(function () { return R.state.pieces.size; });
    await ctx.tapCell(3, 8);
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
    ctx.eq(await lit(), 12, 'lit count survives a resize');
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

    await ctx.ev(function () { window.__REFRACT.restart(101); window.__REFRACT.freeze(true); });
    let m = await snap();
    ctx.eq(m.wave, 0, 'starts before wave 1');
    ctx.eq(m.coreHp, 20, 'core hp');
    ctx.eq(m.gold, 40, 'start gold');
    ctx.near(m.countdown, 10, 0.01, 'first countdown');

    /* --- wave 1 with nothing placed: every mote leaks --- */
    await step(10.5);
    m = await snap();
    ctx.eq(m.phase, 'wave', 'wave 1 started after the countdown');
    ctx.eq(m.wave, 1, 'wave number');
    await ctx.snap('a-wave1-running');

    await until('s.phase === "building"', 120);
    m = await snap();
    ctx.eq(m.coreHp, 16, 'four motes leaked one HP each');
    ctx.eq(m.leaksBy.mote, 4, 'leaks attributed to motes');
    ctx.eq(m.gold, 55, 'gold is start plus the wave-1 clear bonus of 15');
    ctx.eq(m.wave, 1, 'wave 1 is over');
    ctx.eq(m.phase, 'building', 'back to building');
    ctx.near(m.countdown, 8, 0.02, 'countdown between waves');
    ctx.eq(m.unlocked.splitter, true, 'splitter unlocked for wave 2');
    ctx.eq(m.unlocked.reflector, false, 'reflector still locked');

    /* --- wave 1 with one mirror at (7,6): nothing gets through --- */
    await ctx.ev(function () { window.__REFRACT.restart(101); window.__REFRACT.freeze(true); });
    await ctx.tapCell(7, 6);
    m = await snap();
    ctx.eq(m.lit, 6, 'mirror lights six road cells');
    ctx.eq(m.gold, 20, 'mirror cost 20');

    await step(10.5);
    await until('s.phase === "building"', 120);
    m = await snap();
    ctx.eq(m.coreHp, 20, 'no leaks with the mirror in place');
    ctx.eq(m.gold, 20 + 16 + 15, 'gold: four kills at 4 plus a 15 clear bonus');
    ctx.eq(m.goldEarned, 31, 'earned gold counts kills and the bonus');
    await ctx.snap('b-wave1-cleared');

    /* --- waves 2 and 3 --- */
    await until('s.wave === 2 && s.phase === "wave"', 30);
    m = await snap();
    ctx.eq(m.wave, 2, 'wave 2 running');
    await ctx.snap('c-wave2');
    await until('s.wave === 2 && s.phase === "building"', 200);
    m = await snap();
    ctx.eq(m.wavesCleared, 2, 'two waves cleared');
    ctx.eq(m.unlocked.reflector, false, 'reflector unlocks later');

    await until('s.wave === 3 && s.phase === "building"', 240);
    m = await snap();
    ctx.eq(m.wavesCleared, 3, 'three waves cleared');
    ctx.eq(m.unlocked.reflector, true, 'reflector unlocked for wave 4');
    ctx.log('  after three waves: hp ' + m.coreHp + ' gold ' + m.gold + ' score ' + m.score);
    await ctx.snap('d-after-wave3');

    /* --- the beam dims past each enemy --- */
    await ctx.ev(function () {
      window.__REFRACT.restart(202);
      window.__REFRACT.freeze(true);
      window.__REFRACT.setGold(500);
      window.__REFRACT.place('mirror', 7, 3, 1);
      window.__REFRACT.nextWave();
    });
    await until('s.enemies.length >= 3 && s.enemies[0].t > 4', 60);
    const dim = await ctx.ev(function () {
      const s = R.state;
      const row = [];
      for (let c = 6; c >= 1; c--) row.push(Math.round(s.beam.lit[R.grid.idx(c, 3)] * 100) / 100);
      return { row: row, foes: s.enemies.map(function (e) { return [e.type, Math.round(e.t * 10) / 10, Math.round(e.hp)]; }) };
    });
    ctx.log('  row 3 power along the beam (east to west): ' + JSON.stringify(dim.row));
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
      s.countdown = 9999;
      R.enemies.spawn(s, 'runner');
      window.__REFRACT.stepUntil('s.enemies.length === 0', 60);
      return { leaks: s.leaksBy.runner, earned: s.goldEarned };
    });
    ctx.eq(oneCell.leaks, 1, 'a runner crossing one lit cell reaches the core');

    const segment = await ctx.ev(function () {
      window.__REFRACT.restart(304);
      window.__REFRACT.freeze(true);
      window.__REFRACT.setGold(500);
      window.__REFRACT.place('mirror', 7, 3, 1);
      const s = R.state;
      s.wave = 3;
      s.countdown = 9999;
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
    ctx.eq(m.phase, 'building', 'PLAY starts the run');
    ctx.near(m.countdown, 10, 0.4, 'first countdown');
    ctx.eq(await overlay(), null, 'the overlay is gone');

    /* --- lose for real, by placing nothing --- */
    await ctx.ev(function () { window.__REFRACT.freeze(true); });
    await until('s.phase === "lost"', 900);
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
    ctx.eq(m.gold, 40, 'gold reset');
    ctx.eq(m.coreHp, 20, 'core hp reset');
    ctx.eq(m.wave, 0, 'wave reset');
    ctx.eq(m.lit, 1, 'beam reset to one lit cell');
    ctx.eq(m.pieces.length, 0, 'no pieces');
    ctx.eq(m.enemies, 0, 'no enemies');
    ctx.eq(m.leaksBy.mote + m.leaksBy.runner + m.leaksBy.brute, 0, 'leak tally reset');
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
      delete sn.countdown;
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
      for (let w = 1; w <= 12; w++) {
        const q = R.enemies.buildQueue(w);
        const counts = {};
        q.forEach(function (x) { counts[x.type] = (counts[x.type] || 0) + 1; });
        out.push({ w: w, n: q.length, counts: counts, last: Math.round(q[q.length - 1].at * 10) / 10 });
      }
      return out;
    });
    ctx.log('  waves: ' + JSON.stringify(waves));
    ctx.eq(waves[0].n, 4, 'wave 1 has four enemies');
    ctx.eq(waves[9].counts.bruteking, 1, 'wave 10 has the Brute King');
    ctx.eq(waves[11].counts.umbra, 1, 'wave 12 has Umbra');
    ctx.eq(waves[10].n, 30, 'wave 11 has thirty enemies');
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
    ctx.eq(JSON.stringify(locked), '["open","WAVE 2","WAVE 4","WAVE 7"]', 'lock labels');
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
        bent: Math.round(R.state.beam.lit[R.grid.idx(6, 6)] * 100) / 100
      };
    });
    ctx.eq(branches.straight, 5.5, 'straight branch at 55 percent');
    ctx.eq(branches.bent, 5.5, 'reflected branch at 55 percent');
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
    const reform = await st(function () {
      const p = R.pieces.at(R.state, 0, 8);
      return Math.round((p.inactiveUntil - R.state.time) * 100) / 100;
    });
    ctx.near(reform, 0.75, 0.02, 'a moved piece re-forms for 0.75 s');
    ctx.eq(await st(function () { return Math.round(R.state.beam.lit[R.grid.idx(2, 8)] * 100) / 100; }), 0,
      'the light is off while it re-forms');
    await st(function () { window.__REFRACT.step(0.8); });
    ctx.check(await st(function () {
      const p = R.pieces.at(R.state, 0, 8);
      const c = p.c + R.grid.DC[p.dir];
      const r = p.r + R.grid.DR[p.dir];
      return R.grid.inBounds(c, r) && R.state.beam.lit[R.grid.idx(c, r)] > 0;
    }), 'the lamp lights again once re-formed');

    /* --- sell at 70 percent --- */
    await st(function () { window.__REFRACT.step(4); });
    const goldBeforeSell = await gold();
    await ctx.tapCell(7, 6);
    await ctx.tap('#actionBar button:nth-child(3)');
    ctx.eq(await pieceAt(7, 6), null, 'the splitter is gone');
    ctx.eq(await gold(), goldBeforeSell + 31, 'sell refunds 70 percent of 45, rounded down');

    /* --- undo returns the full price --- */
    const goldBeforeBuy = await gold();
    await ctx.tap('#palette .pbtn[data-type="mirror"]');
    await ctx.tapCell(3, 4);
    ctx.eq(await gold(), goldBeforeBuy - 20, 'mirror bought');
    const chip = await st(function () {
      const c = document.getElementById('undoChip');
      return { shown: c.style.display !== 'none', text: c.textContent.trim() };
    });
    ctx.check(chip.shown, 'the undo chip appears');
    await ctx.tap('#undoChip');
    ctx.eq(await gold(), goldBeforeBuy, 'undo returns the full price');
    ctx.eq(await pieceAt(3, 4), null, 'undo removes the piece');

    /* --- the undo window expires --- */
    await ctx.tapCell(3, 4);
    await st(function () { window.__REFRACT.step(3.2); });
    await ctx.page.waitForTimeout(80);
    ctx.eq(await st(function () { return document.getElementById('undoChip').style.display; }), 'none',
      'the chip disappears after three seconds');
    const g2 = await gold();
    await ctx.tapCell(3, 4);
    await ctx.tap('#actionBar button:nth-child(3)');
    ctx.eq(await gold(), g2 + 14, 'selling after the window refunds 70 percent of 20');

    /* --- drag a palette button onto a tile --- */
    const before = await st(function () { return R.state.pieces.size; });
    const btn = await ctx.page.$('#palette .pbtn[data-type="mirror"]');
    const box = await btn.boundingBox();
    const target = await ctx.cellPoint(2, 4);
    await ctx.drag({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, target);
    ctx.eq(await st(function () { return R.state.pieces.size; }), before + 1, 'dragging from the palette places a piece');
    ctx.eq((await pieceAt(2, 4)).type, 'mirror', 'the dragged mirror landed on the target tile');

    /* --- drag a placed piece to a new tile --- */
    await ctx.drag(await ctx.cellPoint(2, 4), await ctx.cellPoint(4, 4));
    ctx.eq(await pieceAt(2, 4), null, 'the piece left the old tile');
    ctx.eq((await pieceAt(4, 4)).type, 'mirror', 'the piece arrived on the new tile');

    /* --- drag onto the road: refused, piece stays --- */
    await ctx.drag(await ctx.cellPoint(4, 4), await ctx.cellPoint(4, 3));
    ctx.eq((await pieceAt(4, 4)).type, 'mirror', 'a drag onto the road leaves the piece where it was');

    /* --- drag outside the window cancels --- */
    const p1 = await ctx.cellPoint(4, 4);
    await ctx.drag(p1, { x: 5, y: ctx.height - 4 });
    ctx.eq((await pieceAt(4, 4)).type, 'mirror', 'a drag released off the board cancels');

    /* --- pointercancel --- */
    await ctx.drag(p1, await ctx.cellPoint(5, 4), { cancel: true });
    ctx.eq((await pieceAt(4, 4)).type, 'mirror', 'a cancelled drag leaves the piece alone');
    ctx.eq(await pieceAt(5, 4), null, 'and does not create one');

    /* --- a second finger is ignored --- */
    const twoFinger = await st(function () { return R.state.pieces.size; });
    await ctx.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: p1.x, y: p1.y, id: 1 }]
    });
    const other = await ctx.cellPoint(6, 8);
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
      window.__REFRACT.place('mirror', 7, 3, 1);
      window.__REFRACT.place('lamp', 0, 6, R.E);
    });
    const levels = [];
    for (let i = 0; i < 6; i++) {
      levels.push(await st(function () {
        const s = R.state;
        return {
          lv: s.coreLevel,
          cost: R.pieces.coreUpgradeCost(s),
          beam: Math.round(s.beam.lit[R.grid.idx(6, 3)] * 100) / 100,
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
    const poor = await st(function () {
      return Array.prototype.map.call(document.querySelectorAll('#palette .pbtn'), function (b) {
        return b.classList.contains('poor');
      });
    });
    ctx.eq(JSON.stringify(poor), '[true,true,true,true]', 'unaffordable palette buttons are marked');
    await ctx.tapCell(5, 8);
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
      s.wave = 12;
      out.umbra = R.enemies.spawn(s, 'umbra').maxHp;
      out.brute12 = R.enemies.spawn(s, 'brute').maxHp;
      return out;
    });
    ctx.log('  hp scaling: ' + JSON.stringify(hp));
    ctx.eq(hp.mote1, 30, 'mote hp at wave 1');
    ctx.eq(hp.mote5, 48, 'mote hp at wave 5 is 30 x 1.6');
    ctx.eq(hp.mote8, 61, 'mote hp at wave 8 is 30 x 2.05, rounded');
    ctx.eq(hp.mote12, 80, 'mote hp at wave 12 is 30 x 2.65, rounded');
    ctx.eq(hp.king, 400, 'the Brute King ignores the wave multiplier');
    ctx.eq(hp.umbra, 900, 'Umbra ignores the wave multiplier');
    ctx.eq(hp.brute12, 318, 'a wave 12 brute is scaled');

    /* --- every type renders with its own shape --- */
    await st(function () {
      window.__REFRACT.restart(1201);
      window.__REFRACT.freeze(true);
      const s = R.state;
      s.countdown = 9999;
      const types = ['mote', 'runner', 'swarmling', 'brute', 'bruteking', 'umbra'];
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
        s.countdown = 9999;
        s.gold = 5000;
        s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
        b.forEach(function (m) { window.__REFRACT.place(m[0], m[1], m[2], m[3]); });
        /* One brute in front, three motes behind it, all on row 3. */
        const brute = R.enemies.spawn(s, 'brute');
        brute.t = 8;
        R.enemies.positionOf(s, brute);
        const motes = [7, 6, 5].map(function (t) {
          const e = R.enemies.spawn(s, 'mote');
          e.t = t;
          e.speed = 0;
          R.enemies.positionOf(s, e);
          return e;
        });
        brute.speed = 0;
        window.__REFRACT.step(1);
        return {
          brute: Math.round((brute.maxHp - brute.hp) * 10) / 10,
          motes: Math.round(motes.reduce(function (a, e) { return a + (e.maxHp - e.hp); }, 0) * 10) / 10
        };
      }, build);
    };

    const against = await dirTest([['mirror', 7, 3, 1]]);
    const withFlow = await dirTest([['mirror', 7, 0, 1], ['mirror', 0, 0, 0], ['mirror', 0, 3, 1]]);
    ctx.log('  against the flow: ' + JSON.stringify(against) + '   with the flow: ' + JSON.stringify(withFlow));
    ctx.check(against.brute > withFlow.brute * 2, 'against the flow the brute takes the beam');
    ctx.check(withFlow.motes > against.motes * 2, 'with the flow the motes behind it burn instead');
    ctx.near(against.brute, 10, 0.3, 'the front brute takes full power');
    ctx.near(against.motes, 7.1, 0.5, 'the shielded motes take very little');

    /* --- swarms drain the beam --- */
    const drain = await st(function () {
      window.__REFRACT.restart(1400);
      window.__REFRACT.freeze(true);
      const s = R.state;
      s.countdown = 9999;
      s.gold = 5000;
      window.__REFRACT.place('mirror', 7, 3, 1);
      const clean = s.beam.lit[R.grid.idx(1, 3)];
      for (let i = 0; i < 12; i++) {
        const e = R.enemies.spawn(s, 'swarmling');
        e.t = 4 + i * 0.12;
        e.speed = 0;
        R.enemies.positionOf(s, e);
      }
      window.__REFRACT.step(1 / 60);
      const drained = s.beam.lit[R.grid.idx(1, 3)];
      for (let i = 0; i < 12; i++) {
        const e = R.enemies.spawn(s, 'swarmling');
        e.t = 5 + i * 0.12;
        e.speed = 0;
        R.enemies.positionOf(s, e);
      }
      window.__REFRACT.step(1 / 60);
      return {
        clean: Math.round(clean * 100) / 100,
        drained: Math.round(drained * 100) / 100,
        dead: Math.round(s.beam.lit[R.grid.idx(1, 3)] * 100) / 100
      };
    });
    ctx.log('  swarm drain: ' + JSON.stringify(drain));
    ctx.eq(drain.clean, 10, 'clean beam reaches the far end at full power');
    ctx.check(drain.drained < 2, 'twelve swarmlings drain the beam to under 2 power');
    ctx.eq(drain.dead, 0, 'twenty-four swarmlings put the beam out before the far end');

    /* --- endless generator --- */
    const endless = await st(function () {
      const out = [];
      for (let w = 13; w <= 18; w++) {
        const q = R.enemies.buildQueue(w);
        const counts = {};
        q.forEach(function (x) { counts[x.type] = (counts[x.type] || 0) + 1; });
        out.push({ w: w, n: q.length, counts: counts, speed: Math.round(R.enemies.speedMult(w) * 100) / 100 });
      }
      return out;
    });
    ctx.log('  endless waves: ' + JSON.stringify(endless));
    ctx.check(endless.every(function (x) { return x.n > 0; }), 'every endless wave has enemies');
    ctx.eq(endless[2].counts.bruteking, 1, 'a Brute King every fifth wave (wave 15)');
    ctx.eq(endless[0].speed, 1.02, 'endless speed multiplier starts at 1.02');
    ctx.eq(await st(function () { return R.enemies.speedMult(200); }), 1.5, 'the speed multiplier is capped at 1.5');

    /* --- a real victory over all twelve waves --- */
    const build = [
      ['mirror', 7, 3, 1],
      ['mirror', 0, 3, 0],
      ['mirror', 0, 10, 1]
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
      for (let w = 1; w <= 12; w++) {
        window.__REFRACT.stepUntil('s.wave === ' + w + ' && s.phase === "wave"', 40);
        window.__REFRACT.stepUntil('s.phase !== "wave"', 220);
        log.push({ w: w, hp: s.coreHp, gold: s.gold, t: Math.round(s.time) });
        if (s.phase === 'lost' || s.phase === 'won') break;
      }
      return { lit: lit, phase: s.phase, hp: s.coreHp, score: R.computeScore(s), time: Math.round(s.time), log: log };
    }, build);
    ctx.log('  victory run: lit ' + run.lit + '  phase ' + run.phase + '  hp ' + run.hp + '  score ' + run.score + '  sim time ' + run.time + 's');
    ctx.log('  per wave: ' + JSON.stringify(run.log));
    ctx.eq(run.lit, 12, 'the concentrated build lights 12 of 25 road cells at full power');
    ctx.eq(run.phase, 'won', 'twelve waves cleared');
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
      'ENDLESS12', 'the HUD says ENDLESS');

    const endlessRun = await st(function () {
      const s = R.state;
      const log = [];
      for (let i = 0; i < 3; i++) {
        const w = s.wave + 1;
        window.__REFRACT.stepUntil('s.wave === ' + w + ' && s.phase === "wave"', 40);
        window.__REFRACT.stepUntil('s.phase !== "wave"', 260);
        log.push({ w: s.wave, hp: s.coreHp, foes: s.waveEnemiesTotal });
        if (s.phase === 'lost') break;
      }
      return { log: log, wave: s.wave, phase: s.phase, score: R.computeScore(s) };
    });
    ctx.log('  endless run: ' + JSON.stringify(endlessRun));
    ctx.check(endlessRun.wave >= 15, 'three more endless waves ran (reached wave ' + endlessRun.wave + ')');
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
    /* Headless Chromium rasterises in software at deviceScaleFactor 3, so this
       bound is loose; the real target is checked on the desktop GPU run. */
    ctx.check(perf.median <= 45, 'headless frame time at peak stays workable (' + perf.median + ' ms)');
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
      'concentrated 12': {
        core: 6,
        pieces: [['mirror', 7, 3, 1], ['mirror', 0, 3, 0], ['mirror', 0, 10, 1]]
      },
      'concentrated + reflector': {
        core: 6,
        pieces: [['mirror', 7, 3, 1], ['mirror', 0, 3, 0], ['mirror', 0, 10, 1], ['reflector', 7, 9, 0]]
      },
      'two segments (split at row 6)': {
        core: 6,
        pieces: [['splitter', 7, 6, 1], ['mirror', 7, 3, 1], ['mirror', 0, 3, 0], ['mirror', 0, 10, 1]]
      },
      'wide 21': {
        core: 6,
        pieces: [['splitter', 7, 6, 1], ['splitter', 7, 5, 1], ['mirror', 7, 3, 1],
          ['mirror', 2, 5, 0], ['mirror', 0, 3, 0], ['mirror', 0, 10, 1]]
      },
      'row 3 + row 10 + lamp on row 6': {
        core: 6,
        pieces: [['mirror', 7, 3, 1], ['mirror', 0, 3, 0], ['mirror', 0, 10, 1], ['lamp', 7, 6, 3]]
      },
      'mirrors only, core 1': {
        core: 1,
        pieces: [['mirror', 7, 3, 1], ['mirror', 0, 3, 0], ['mirror', 0, 10, 1],
          ['mirror', 7, 6, 1], ['mirror', 1, 6, 0], ['mirror', 1, 4, 1]]
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
        for (let w = 1; w <= 12; w++) {
          window.__REFRACT.stepUntil('s.wave === ' + w + ' && s.phase === "wave"', 40);
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
    ctx.check(winners.length > 0, 'at least one build clears all twelve waves');
    const spread = results.map(function (x) { return x.r.wave; });
    ctx.check(Math.max.apply(null, spread) - Math.min.apply(null, spread) >= 2,
      'different strategies reach different waves: ' + JSON.stringify(spread));
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

    /* --- early call pays the countdown bonus --- */
    const early = await st(function () {
      window.__REFRACT.restart(2100);
      window.__REFRACT.freeze(true);
      const s = R.state;
      window.__REFRACT.step(3);
      R.ui.frame(s, 0.016);
      const before = { gold: s.gold, countdown: s.countdown, label: document.getElementById('btnNext').textContent };
      const bonus = R.earlyCallBonus(s);
      R.callWaveEarly(s);
      return { before: before, bonus: bonus, after: s.gold, phase: s.phase, wave: s.wave };
    });
    ctx.log('  early call: ' + JSON.stringify(early));
    ctx.eq(early.bonus, Math.ceil(early.before.countdown * 1.5), 'bonus is ceil(remaining x 1.5)');
    ctx.eq(early.after, early.before.gold + early.bonus, 'the bonus is paid');
    ctx.eq(early.phase, 'wave', 'the wave starts immediately');
    ctx.check(early.before.label.indexOf(String(early.bonus)) >= 0,
      'the button shows the bonus on offer (' + early.before.label.replace(/\s+/g, ' ') + ')');

    /* --- help pauses and resumes --- */
    await st(function () { window.__REFRACT.restart(2101); window.__REFRACT.nextWave(); });
    await ctx.tap('#btnHelp');
    let help = await overlay();
    ctx.check(help.indexOf('HOW TO PLAY') >= 0, 'help opens');
    ['MIRROR', 'SPLITTER', 'REFLECTOR', 'LAMP', 'SHIELDING', 'DIRECTION', 'LOOPS'].forEach(function (word) {
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
    const bruteTip = await tipFor({ brute: 4, mote: 3 });
    ctx.check(bruteTip.indexOf('Brutes') === 0, 'brute-heavy loss gets the brute tip');
    const swarmTip = await tipFor({ swarmling: 12, mote: 2 });
    ctx.check(swarmTip.indexOf('Swarms') === 0, 'swarm-heavy loss gets the swarm tip');
    const runnerTip = await tipFor({ runner: 9, mote: 2 });
    ctx.check(runnerTip.indexOf('Runners') === 0, 'runner-heavy loss gets the runner tip');
    const moteTip = await tipFor({ mote: 6 });
    ctx.check(moteTip.indexOf('Light along the road') === 0, 'a plain loss gets the coverage tip');
    ctx.log('  brute tip: ' + bruteTip);

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
    ctx.eq(await st(function () { return R.state.beam.litRoadCount; }), 6, 'the real beam matches what the ghost showed');

    /* --- the incoming strip lists the wave in spawn order --- */
    const strip = await st(function () {
      window.__REFRACT.restart(2105);
      const s = R.state;
      s.wave = 11;
      s.phase = 'building';
      s.countdown = 8;
      R.ui.frame(s, 0.016);
      return document.getElementById('strip').textContent.replace(/\s+/g, ' ').trim();
    });
    ctx.log('  strip at wave 12: ' + strip);
    ctx.check(strip.indexOf('NEXT') === 0, 'the strip announces the next wave');
    const order = await st(function () {
      return R.enemies.composition(12).map(function (g) { return g.type + 'x' + g.count; }).join(' ');
    });
    ctx.eq(order, 'motex6 brutex2 umbrax1 brutex2', 'composition is listed in spawn order');
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
      window.__REFRACT.place('mirror', 7, 3, 1);
      window.__REFRACT.place('mirror', 0, 3, 0);
      window.__REFRACT.nextWave();
      window.__REFRACT.step(6);
      R.pieces.select(R.state, R.pieces.at(R.state, 0, 3));
    });
    await ctx.page.waitForTimeout(90);
    m = await measure();
    checkFits(m, 'mid-wave');
    ctx.log('  ' + ctx.width + 'x' + ctx.height + ' cell ' + m.cell + ' board ' + JSON.stringify(m.rects.board));
    await ctx.snap('02-midwave');

    /* action bar sits above a low piece and below a top-row piece */
    const barLow = await st(function () {
      R.pieces.select(R.state, R.pieces.at(R.state, 0, 3));
      R.ui.frame(R.state, 0.016);
      const b = document.getElementById('actionBar').getBoundingClientRect();
      const p = R.render.projectCell(0, 3, 0);
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
    await st(function () { window.__REFRACT.restart(3100); window.__REFRACT.place('mirror', 7, 3, 1); });
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
      { kind: 'mirror', c: 7, r: 3 },
      { kind: 'mirror', c: 0, r: 3 },
      { kind: 'mirror', c: 0, r: 10 },
      { kind: 'core' },
      { kind: 'core' },
      { kind: 'core' },
      { kind: 'lamp', c: 2, r: 11 },
      { kind: 'lamp', c: 1, r: 6 },
      { kind: 'core' },
      { kind: 'lamp', c: 1, r: 4 },
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
      await st(function (n) { window.__REFRACT.stepUntil('s.wave === ' + n + ' && s.phase === "wave"', 40); }, w);
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
      s.countdown = 9999;
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

    /* --- brute death shakes, boss death shakes harder and stops time --- */
    const bruteShake = await st(function () {
      R.render.clearParticles();
      const s = R.state;
      const e = R.enemies.spawn(s, 'brute');
      e.t = 6;
      R.enemies.positionOf(s, e);
      e.hp = 0;
      R.enemies.resolveStep(s);
      R.render.handleEvents(s);
      return { amp: R.render.feel.shakeAmp, parts: R.render.particleCount() };
    });
    ctx.check(bruteShake.amp >= 4, 'a brute death shakes the board (' + bruteShake.amp + 'px)');

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
    ctx.check(bossShake.amp > bruteShake.amp, 'a boss death shakes harder');
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
      const e = R.enemies.spawn(s, 'brute');
      e.t = 25.5;
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
      R.pieces.place(s, 'mirror', 5, 8);
      R.pieces.sell(s, 5, 8);
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
      window.__REFRACT.place('mirror', 7, 3, 1);
      window.__REFRACT.place('mirror', 0, 3, 0);
      window.__REFRACT.place('mirror', 0, 10, 1);
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

};
