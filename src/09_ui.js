/*
 * The DOM layer: HUD numbers, the incoming strip, floating text over the board
 * and (from later phases) the palette, action bar and overlays. Everything here
 * reads state and reacts to the feedback events the simulation emits.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});
  var B = R.BALANCE;

  var ui = {};
  R.ui = ui;

  var el = {};
  var cache = {};
  var floaters = [];
  var FLOATER_POOL = 28;

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(node, value) {
    if (cache[node.__key] === value) return;
    cache[node.__key] = value;
    node.textContent = value;
  }

  function key(node, name) {
    node.__key = name;
    return node;
  }

  /* ---------- floating text ---------- */

  function makeFloater() {
    var node = document.createElement('div');
    node.className = 'floater';
    node.style.display = 'none';
    el.overlay.appendChild(node);
    return { node: node, life: 0, ttl: 0, x: 0, y: 0, vy: 0, active: false };
  }

  ui.floater = function (text, kind, x, y, opts) {
    var f = null;
    for (var i = 0; i < floaters.length; i++) {
      if (!floaters[i].active) { f = floaters[i]; break; }
    }
    if (!f) return null;
    f.active = true;
    f.life = 0;
    f.ttl = (opts && opts.ttl) || 0.9;
    f.x = x;
    f.y = y;
    f.vy = (opts && opts.vy) || -46;
    f.node.className = 'floater ' + (kind || 'info');
    f.node.textContent = text;
    f.node.style.display = 'block';
    f.node.style.left = x + 'px';
    f.node.style.top = y + 'px';
    f.node.style.opacity = '1';
    return f;
  };

  ui.floaterAtCell = function (text, kind, c, r, opts) {
    var p = R.render.projectCell(c, r, 0.4);
    if (!p) return null;
    return ui.floater(text, kind, p.x, p.y, opts);
  };

  ui.floaterAtWorld = function (text, kind, x, z, opts) {
    var p = R.render.project(x, 0.4, z);
    if (!p) return null;
    return ui.floater(text, kind, p.x, p.y, opts);
  };

  function stepFloaters(dt) {
    for (var i = 0; i < floaters.length; i++) {
      var f = floaters[i];
      if (!f.active) continue;
      f.life += dt;
      if (f.life >= f.ttl) {
        f.active = false;
        f.node.style.display = 'none';
        continue;
      }
      var t = f.life / f.ttl;
      f.node.style.top = (f.y + f.vy * t) + 'px';
      f.node.style.opacity = String(1 - t * t);
    }
  }

  ui.clearFloaters = function () {
    for (var i = 0; i < floaters.length; i++) {
      floaters[i].active = false;
      floaters[i].node.style.display = 'none';
    }
  };

  /* ---------- one-shot CSS animations ---------- */

  function pulse(node, cls) {
    if (!node) return;
    node.classList.remove(cls);
    /* Reading offsetWidth restarts the animation. */
    void node.offsetWidth;
    node.classList.add(cls);
  }

  ui.bumpGold = function () { pulse(el.statGold, 'bump'); };
  ui.shakeGold = function () { pulse(el.statGold, 'shake'); };
  ui.shakeHp = function () { pulse(el.statHp, 'shake'); };
  ui.pulseLit = function () { pulse(el.statLit, 'bump'); };

  /* ---------- incoming strip ---------- */

  var stripNotice = '';
  var stripNoticeUntil = 0;
  var realTime = 0;

  function pips(comp) {
    var html = '';
    for (var i = 0; i < comp.length; i++) {
      var g = comp[i];
      var big = g.type === 'bruteking' || g.type === 'umbra';
      html += '<span class="pip ' + g.type + (big ? ' big' : '') + '"></span>';
      html += '<span class="' + (big ? 'warn' : '') + '">' + g.count + '</span> ';
    }
    return html;
  }

  ui.notice = function (text, seconds) {
    stripNotice = text;
    stripNoticeUntil = realTime + (seconds || 2.4);
    el.strip.classList.remove('flash');
    void el.strip.offsetWidth;
    el.strip.classList.add('flash');
  };

  function stripHtml(s) {
    if (stripNotice && realTime < stripNoticeUntil) return '<span class="warn">' + stripNotice + '</span>';
    if (s.phase === 'wave') {
      return '<span class="em">WAVE ' + s.wave + '</span> &middot; ' +
        R.enemies.remaining(s) + ' left';
    }
    var next = s.wave + 1;
    return 'NEXT ' + pips(R.enemies.composition(next)) +
      '&middot; in <span class="em">' + Math.max(0, Math.ceil(s.countdown)) + 's</span>';
  }

  /* ---------- HUD ---------- */

  ui.update = function (s) {
    setText(el.hpVal, String(Math.max(0, s.coreHp)));
    setText(el.goldVal, String(Math.floor(s.gold)));
    setText(el.waveVal, s.endless ? String(s.wave) : String(s.wave));
    setText(el.waveSub, s.endless ? ' ENDLESS' : '/12');
    setText(el.litVal, String(s.beam.litRoadCount));
    setText(el.litSub, '/' + s.roadCells);

    var html = stripHtml(s);
    if (cache.strip !== html) {
      cache.strip = html;
      el.stripText.innerHTML = html;
    }
  };

  /* ---------- events ---------- */

  var goldFloaterAt = 0;

  ui.handleEvents = function (s) {
    for (var i = 0; i < s.events.length; i++) {
      var e = s.events[i];
      switch (e.type) {
        case 'denied':
          if (e.reason === 'gold') {
            ui.shakeGold();
            ui.floaterAtCell('Need ' + e.cost, 'dmg', e.c, e.r);
          } else if (e.reason === 'locked') {
            ui.floaterAtCell('Locked', 'info', e.c, e.r);
          }
          break;
        case 'place':
        case 'sell':
        case 'upgrade':
          ui.bumpGold();
          break;
        case 'kill':
          /* Stagger simultaneous kills so the numbers stay readable. */
          if (realTime - goldFloaterAt > 0.04) {
            goldFloaterAt = realTime;
            ui.floaterAtWorld('+' + e.gold, 'gold', e.x, e.z);
          }
          ui.bumpGold();
          break;
        case 'leak':
          ui.shakeHp();
          ui.floaterAtWorld('-' + e.leak, 'dmg', e.x, e.z, { ttl: 1.1 });
          break;
        case 'waveclear':
          ui.notice('WAVE ' + e.wave + ' CLEARED  +' + e.bonus, 2.2);
          ui.bumpGold();
          break;
        case 'wavestart':
          ui.notice('WAVE ' + e.wave, 1.4);
          break;
        case 'unlock':
          ui.notice(String(TYPE_LABEL_PIECE[e.type] || e.type).toUpperCase() + ' UNLOCKED', 3);
          break;
        default:
          break;
      }
    }
  };

  var TYPE_LABEL_PIECE = {
    mirror: 'Mirror', splitter: 'Splitter', reflector: 'Reflector', lamp: 'Lamp'
  };

  /* ---------- lifecycle ---------- */

  ui.init = function () {
    el.overlay = byId('boardOverlay');
    el.statHp = byId('statHp');
    el.statGold = byId('statGold');
    el.statWave = byId('statWave');
    el.statLit = byId('statLit');
    el.hpVal = key(el.statHp.querySelector('.val'), 'hpVal');
    el.goldVal = key(el.statGold.querySelector('.val'), 'goldVal');
    el.waveVal = key(el.statWave.querySelector('.val'), 'waveVal');
    el.waveSub = key(el.statWave.querySelector('.sub'), 'waveSub');
    el.litVal = key(el.statLit.querySelector('.val'), 'litVal');
    el.litSub = key(el.statLit.querySelector('.sub'), 'litSub');
    el.strip = byId('strip');
    el.stripText = key(byId('stripText'), 'strip');

    for (var i = 0; i < FLOATER_POOL; i++) floaters.push(makeFloater());
    ui.el = el;
  };

  ui.frame = function (s, dtReal) {
    realTime += dtReal;
    stepFloaters(dtReal);
    ui.handleEvents(s);
    ui.update(s);
  };

  ui.reset = function () {
    ui.clearFloaters();
    cache = {};
    stripNotice = '';
    stripNoticeUntil = 0;
  };
})(typeof window !== 'undefined' ? window : globalThis);
