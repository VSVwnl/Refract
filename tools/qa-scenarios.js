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

};
