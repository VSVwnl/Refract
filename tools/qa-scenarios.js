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

    await ctx.ev(function () { window.__REFRACT.setGold(15); });
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

};
