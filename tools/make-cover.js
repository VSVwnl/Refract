'use strict';
/*
 * make-cover.js - builds the submission cover image from a real frame of the
 * game, so the art is the game rather than a drawing of it.
 *
 * Development only. The result is a submission-page asset and is never part
 * of the packaged zip, which stays index.html plus vendor/.
 *
 * Usage: capture shots/cover-board.png from the running game first, then
 *   node tools/make-cover.js
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.argv[2] || '.';
const board = fs.readFileSync(path.join(ROOT, 'shots', 'cover-board.png')).toString('base64');

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1920px; height: 1080px; }
  body {
    background:
      radial-gradient(1100px 900px at 74% 50%, rgba(255, 178, 71, 0.16), transparent 62%),
      radial-gradient(900px 700px at 18% 24%, rgba(89, 232, 255, 0.10), transparent 60%),
      linear-gradient(160deg, #0d1428 0%, #080b18 55%, #05070f 100%);
    font-family: "Segoe UI", Roboto, system-ui, -apple-system, sans-serif;
    color: #e8eeff;
    display: flex;
    align-items: center;
    overflow: hidden;
  }
  /* A faint grid, the same idea as the board's own tiles. */
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(120, 150, 220, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(120, 150, 220, 0.05) 1px, transparent 1px);
    background-size: 80px 80px;
  }
  .left { position: relative; width: 1040px; padding: 0 0 0 110px; }
  .kicker {
    font-size: 21px; letter-spacing: 0.34em; color: #7f8db5;
    text-transform: uppercase; margin-bottom: 26px;
  }
  h1 {
    font-size: 168px; line-height: 0.92; font-weight: 800; letter-spacing: 0.06em;
    background: linear-gradient(180deg, #ffffff 0%, #ffe6b0 46%, #ffb545 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    filter: drop-shadow(0 0 34px rgba(255, 181, 69, 0.45));
  }
  .rule {
    width: 210px; height: 4px; margin: 34px 0 30px;
    background: linear-gradient(90deg, #ffc247, rgba(255, 194, 71, 0));
    box-shadow: 0 0 18px rgba(255, 194, 71, 0.65);
  }
  .tag { font-size: 44px; line-height: 1.24; font-weight: 600; color: #f2f6ff; }
  .tag em { font-style: normal; color: #ffc247; }
  .sub { margin-top: 22px; font-size: 26px; line-height: 1.5; color: #93a1c8; max-width: 700px; }
  .meta {
    position: absolute; left: 110px; bottom: -250px;
    display: flex; gap: 14px;
  }
  .chip {
    font-size: 17px; letter-spacing: 0.14em; text-transform: uppercase;
    color: #9fb0da; border: 1px solid #2c3866; border-radius: 999px;
    padding: 9px 18px; background: rgba(20, 30, 60, 0.55);
  }
  .right {
    position: relative; flex: 1 1 auto; height: 1080px;
    display: flex; align-items: center; justify-content: center;
  }
  .phone {
    position: relative;
    height: 940px; aspect-ratio: 420 / 627;
    border-radius: 26px; overflow: hidden;
    border: 1px solid rgba(120, 160, 240, 0.28);
    box-shadow: 0 40px 110px rgba(0, 0, 0, 0.66), 0 0 90px rgba(255, 181, 69, 0.14);
    transform: rotate(-4deg);
  }
  .phone img { width: 100%; height: 100%; object-fit: cover; display: block; }
  /* Warm the shot slightly so it sits in the same light as the panel. */
  .phone::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(200deg, rgba(255, 194, 71, 0.06), transparent 45%);
  }
</style>
<div class="grid"></div>
<div class="left">
  <div class="kicker">Tower Defense &amp; Strategy</div>
  <h1>REFRACT</h1>
  <div class="rule"></div>
  <div class="tag">A tower defense<br>with <em>no towers</em>.</div>
  <div class="sub">
    Your core fires one beam of light. Bend it, split it and bounce it
    with mirrors and glass so it burns the shadows walking the road &mdash;
    instead of merely crossing it.
  </div>
  <div class="meta">
    <span class="chip">Single player</span>
    <span class="chip">Portrait</span>
    <span class="chip">Plays offline</span>
  </div>
</div>
<div class="right">
  <div class="phone"><img src="data:image/png;base64,${board}"></div>
</div>
`;

const out = path.join(ROOT, 'dist', 'cover.png');
const tmp = path.join(__dirname, 'cover.html');
fs.writeFileSync(tmp, html, 'utf8');

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  await p.goto('file:///' + tmp.replace(/\\/g, '/'));
  await p.waitForTimeout(600);
  await p.screenshot({ path: out });
  await b.close();
  console.log('wrote', out, fs.statSync(out).size, 'bytes');
})();
