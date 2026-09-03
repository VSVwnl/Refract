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
    ctx.check(vic.indexOf('CONTINUE') < 0, 'endless is not offered yet');
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

};
