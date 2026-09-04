'use strict';
/*
 * qa.js - browser test driver (development only, never shipped).
 *
 * Opens the dev server in Chromium with a mobile emulation profile, drives the
 * game with real touch events, captures console output, network requests and
 * screenshots, and asserts on the game state.
 *
 * Usage:
 *   node tools/qa.js <scenario> [--w 390] [--h 844] [--url http://localhost:8080/] [--headed] [--slow 50]
 *   node tools/qa.js list
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
function flag(name) {
  return process.argv.indexOf('--' + name) >= 0;
}

/* ---------- helpers available to every scenario ---------- */

class Ctx {
  constructor(page, log) {
    this.page = page;
    this.log = log;
    this.failures = [];
    this.checks = 0;
    this.shots = [];
    this.prefix = 'shot';
  }

  async snap(name) {
    if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
    const file = path.join(SHOTS, this.prefix + '-' + name + '.png');
    await this.page.screenshot({ path: file });
    this.shots.push(path.relative(ROOT, file).replace(/\\/g, '/'));
    return file;
  }

  check(cond, what) {
    this.checks++;
    if (!cond) this.failures.push(what);
    else this.log('  ok   ' + what);
    return cond;
  }

  eq(actual, expected, what) {
    return this.check(actual === expected, what + ' = ' + JSON.stringify(expected) + (actual === expected ? '' : ' (got ' + JSON.stringify(actual) + ')'));
  }

  near(actual, expected, tol, what) {
    const good = Math.abs(actual - expected) <= tol;
    return this.check(good, what + ' ~ ' + expected + (good ? '' : ' (got ' + actual + ')'));
  }

  ev(fn, arg) {
    return this.page.evaluate(fn, arg);
  }

  /* Client coordinates of the centre of a board cell. */
  async cellPoint(c, r) {
    return this.page.evaluate(function (a) {
      const rect = document.getElementById('board').getBoundingClientRect();
      const p = R.render.projectCell(a[0], a[1], 0);
      return { x: rect.left + p.x, y: rect.top + p.y };
    }, [c, r]);
  }

  async tapCell(c, r) {
    const p = await this.cellPoint(c, r);
    await this.page.touchscreen.tap(p.x, p.y);
    await this.page.waitForTimeout(60);
  }

  async tap(selector) {
    const el = await this.page.$(selector);
    if (!el) throw new Error('no element for ' + selector);
    const box = await el.boundingBox();
    if (!box) throw new Error('element not visible: ' + selector);
    await this.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.waitForTimeout(60);
  }

  async dragCells(from, to, opts) {
    const a = await this.cellPoint(from[0], from[1]);
    const b = await this.cellPoint(to[0], to[1]);
    await this.page.touchscreen.tap(a.x, a.y).catch(function () {});
    return this.drag(a, b, opts);
  }

  /* Pointer-event drag using CDP touch input. */
  async drag(a, b, opts) {
    const steps = (opts && opts.steps) || 8;
    const page = this.page;
    const cdp = this.cdp;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: a.x, y: a.y, id: 1 }]
    });
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, id: 1 }]
      });
      await page.waitForTimeout(16);
    }
    if (opts && opts.cancel) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    } else {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await page.waitForTimeout(80);
  }

  snapshot() {
    return this.page.evaluate(function () {
      return window.__REFRACT ? window.__REFRACT.snapshot() : null;
    });
  }

  step(seconds) {
    return this.page.evaluate(function (sec) {
      window.__REFRACT.step(sec);
    }, seconds);
  }
}

/* ---------- scenarios ---------- */

const SCENARIOS = {};
require('./qa-scenarios.js')(SCENARIOS, Ctx);

/* ---------- runner ---------- */

async function main() {
  const name = process.argv[2];
  if (!name || name === 'list') {
    console.log('scenarios: ' + Object.keys(SCENARIOS).join(', '));
    process.exit(name ? 0 : 1);
  }
  const scenario = SCENARIOS[name];
  if (!scenario) {
    console.error('unknown scenario: ' + name);
    console.error('available: ' + Object.keys(SCENARIOS).join(', '));
    process.exit(1);
  }

  const width = Number(arg('w', 390));
  const height = Number(arg('h', 844));
  const url = arg('url', 'http://localhost:8080/?debug=1');
  const dsf = Number(arg('dsf', 3));

  const gpu = flag('gpu');
  const browser = await chromium.launch({
    headless: !flag('headed') && !gpu,
    slowMo: Number(arg('slow', 0)),
    args: ['--enable-precise-memory-info']
      .concat(gpu ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=default'] : [])
      .concat(flag('nowebgl') ? ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] : [])
  });
  const desktop = flag('desktop');
  const context = await browser.newContext(desktop ? {
    viewport: { width: width, height: height },
    deviceScaleFactor: 1
  } : {
    viewport: { width: width, height: height },
    deviceScaleFactor: dsf,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });

  const consoleMsgs = [];
  const pageErrors = [];
  const requests = [];
  const page = await context.newPage();

  /* --offline aborts anything that is not the page being tested. */
  if (flag('offline')) {
    const origin = url.startsWith('file:') ? 'file:' : new URL(url).origin;
    await page.route('**/*', function (route) {
      const target = route.request().url();
      const local = origin === 'file:' ? target.startsWith('file:') : target.indexOf(origin) === 0;
      if (local) route.continue();
      else route.abort();
    });
  }

  page.on('console', function (m) { consoleMsgs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', function (e) { pageErrors.push(String(e && e.stack || e)); });
  page.on('requestfailed', function (r) { requests.push('FAILED ' + r.url()); });
  page.on('request', function (r) { requests.push(r.method() + ' ' + r.url()); });

  const lines = [];
  function log(s) { lines.push(s); console.log(s); }

  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  if (flag('nowebgl')) {
    await page.waitForFunction(function () { return window.R && window.R.state; }, null, { timeout: 10000 });
  } else {
    await page.waitForFunction(function () { return window.R && R.render && R.render.ready; }, null, { timeout: 10000 });
  }
  const loadMs = Date.now() - t0;

  const ctx = new Ctx(page, log);
  ctx.cdp = await context.newCDPSession(page);
  ctx.gpu = gpu;
  ctx.prefix = name + '-' + width + 'x' + height + (desktop ? '-desktop' : '');
  ctx.width = width;
  ctx.height = height;

  log('scenario ' + name + '  ' + width + 'x' + height + '  load ' + loadMs + 'ms');

  let thrown = null;
  try {
    await scenario(ctx);
  } catch (err) {
    thrown = err;
  }

  /* Driver and headless-Chromium noise is not produced by our code. */
  const NOISE = [
    /GL Driver Message/,
    /GPU stall due to ReadPixels/,
    /Automatic fallback to software WebGL/,
    /SwiftShader/,
    /* Three.js logs its own message before throwing on a device with no WebGL. */
    /THREE\.WebGLRenderer:/
  ];
  const ourErrors = consoleMsgs.filter(function (m) {
    if (!/^error/.test(m) && !/^warning/.test(m)) return false;
    return !NOISE.some(function (re) { return re.test(m); });
  });

  log('');
  log('requests (' + requests.length + '):');
  requests.forEach(function (r) { log('  ' + r); });
  if (consoleMsgs.length) {
    log('console (' + consoleMsgs.length + ' messages, ' + ourErrors.length + ' from our code):');
    consoleMsgs.forEach(function (m) { log('  ' + m); });
  } else {
    log('console: clean');
  }
  if (pageErrors.length) {
    log('page errors (' + pageErrors.length + '):');
    pageErrors.forEach(function (m) { log('  ' + m); });
  }
  if (ctx.shots.length) log('screenshots: ' + ctx.shots.join(' '));

  await browser.close();

  const bad = ctx.failures.length + pageErrors.length + ourErrors.length + (thrown ? 1 : 0);
  if (thrown) log('THREW: ' + (thrown.stack || thrown));
  if (ctx.failures.length) {
    log('failed checks:');
    ctx.failures.forEach(function (f) { log('  - ' + f); });
  }
  log(bad ? ('FAIL  ' + ctx.checks + ' checks, ' + bad + ' problems') : ('PASS  ' + ctx.checks + ' checks'));
  process.exit(bad ? 1 : 0);
}

main();
