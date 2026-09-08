'use strict';
/*
 * make-readme-images.js - the small JPEGs the README points at.
 *
 * Development only, and kept small on purpose: the repository holds a handful
 * of illustrative frames, not a screenshot archive. Needs the dev server
 * running (node tools/serve.js) and tools/make-cover.js run first, which is
 * what leaves the cover page behind for the first shot.
 *
 * Usage: node tools/make-readme-images.js [path-to-cover.html]
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.resolve(__dirname, '..', 'docs', 'images');
const COVER_HTML = process.argv[2];
const PHONE = { width: 390, height: 844 };

function size(f) {
  return Math.round(fs.statSync(path.join(OUT, f)).size / 1024) + ' kB';
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  if (COVER_HTML && fs.existsSync(COVER_HTML)) {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 0.75 });
    const page = await ctx.newPage();
    await page.goto('file:///' + COVER_HTML.split(path.sep).join('/'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, 'cover.jpg'), type: 'jpeg', quality: 78 });
    await ctx.close();
    console.log('cover.jpg', size('cover.jpg'));
  }

  /* A wave in progress on a developed board. */
  let ctx = await browser.newContext(Object.assign({ isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, { viewport: PHONE }));
  let page = await ctx.newPage();
  await page.addInitScript(function () {
    try { localStorage.setItem('refract.taught', '1'); } catch (e) {}
  });
  await page.goto('http://localhost:8080/?debug=1');
  await page.waitForTimeout(1600);
  await page.evaluate(function () {
    window.__REFRACT.restart(31337);
    var s = R.state;
    s.gold = 100000;
    s.unlocked = { mirror: true, splitter: true, reflector: true, lamp: true };
    s.routesOpen = s.routes.length;
    [['mirror', 7, 4, 1], ['lamp', 0, 6, 1], ['lamp', 0, 8, 1],
     ['lamp', 0, 2, 1], ['mirror', 6, 2, 1], ['splitter', 7, 8, 1]]
      .forEach(function (m) { window.__REFRACT.place(m[0], m[1], m[2], m[3]); });
    for (var i = 1; i < 6; i++) R.pieces.upgradeCore(s);
    s.wave = 5;
    window.__REFRACT.startWave();
    window.__REFRACT.step(16);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'gameplay.jpg'), type: 'jpeg', quality: 80 });
  await ctx.close();
  console.log('gameplay.jpg', size('gameplay.jpg'));

  /* The walkthrough, exactly as a first-time player meets it. */
  ctx = await browser.newContext(Object.assign({ isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, { viewport: PHONE }));
  page = await ctx.newPage();
  await page.goto('http://localhost:8080/');
  await page.waitForTimeout(1600);
  const play = await page.$('#overlayRoot .bigbtn');
  const box = await play.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'tutorial.jpg'), type: 'jpeg', quality: 80 });
  await browser.close();
  console.log('tutorial.jpg', size('tutorial.jpg'));
})();
