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
    setText(el.waveLbl, s.endless ? 'ENDLESS' : 'WAVE');
    setText(el.waveVal, String(s.wave));
    setText(el.waveSub, s.endless ? '' : '/12');
    if (s.beam.litRoadCount > lastLit) ui.pulseLit();
    lastLit = s.beam.litRoadCount;
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
  var lastLit = 0;

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
          ui.bumpGold();
          ui.hint(s, 'placed');
          break;
        case 'sell':
          ui.bumpGold();
          ui.floaterAtCell('+' + e.refund, 'gold', e.c, e.r);
          break;
        case 'upgrade':
          ui.bumpGold();
          ui.notice('CORE LEVEL ' + e.level, 1.6);
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
          if (e.wave === 1) ui.hint(s, 'along', 6);
          if (e.wave === 3) ui.hint(s, 'core', 6);
          break;
        case 'wavestart':
          ui.notice('WAVE ' + e.wave, 1.4);
          break;
        case 'runstart':
          lastLit = 0;
          ui.hint(s, 'start', 7);
          break;
        case 'spawn':
          if (e.type === 'brute' || e.type === 'bruteking') ui.hint(s, 'brute', 6);
          if (e.type === 'swarmling') ui.hint(s, 'swarm', 6);
          break;
        case 'endless':
          ui.notice('ENDLESS MODE', 2.4);
          break;
        case 'unlock':
          ui.notice(String(TYPE_LABEL_PIECE[e.type] || e.type).toUpperCase() + ' UNLOCKED', 3);
          ui.flashPalette(e.type);
          ui.hint(s, e.type, 6);
          break;
        case 'undo':
          ui.bumpGold();
          ui.floaterAtCell('+' + e.refund, 'gold', e.c, e.r);
          break;
        default:
          break;
      }
    }
  };

  var TYPE_LABEL_PIECE = {
    mirror: 'Mirror', splitter: 'Splitter', reflector: 'Reflector', lamp: 'Lamp'
  };


  /* ---------- overlays ---------- */

  var overlayKind = null;

  function node(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function button(cls, label, onClick) {
    var b = node('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', function (ev) {
      ev.preventDefault();
      onClick();
    });
    return b;
  }

  function openOverlay(kind, build) {
    overlayKind = kind;
    el.overlayRoot.innerHTML = '';
    var wrap = node('div', 'overlay');
    build(wrap);
    el.overlayRoot.appendChild(wrap);
    el.overlayRoot.classList.add('on');
    return wrap;
  }

  function closeOverlay() {
    overlayKind = null;
    el.overlayRoot.innerHTML = '';
    el.overlayRoot.classList.remove('on');
  }

  function bestLine() {
    return R.meta.best > 0 ? '<p class="tag">BEST ' + R.meta.best + '</p>' : '';
  }

  function buildTitle(wrap) {
    wrap.appendChild(node('h1', null, 'REFRACT'));
    wrap.appendChild(node('p', 'tag', 'Bend the light. Burn the shadows.'));
    var rows = node('div', 'rows');
    rows.appendChild(node('div', 'row', '<b>&#9670;</b> Your core fires one beam of light. Shadows walking the road burn in it.'));
    rows.appendChild(node('div', 'row', '<b>&#9655;</b> Tap a tile to place a mirror and bend the beam along the road.'));
    rows.appendChild(node('div', 'row', '<b>&#8635;</b> Tap a placed piece to flip, move or sell it. Survive twelve waves.'));
    wrap.appendChild(rows);
    if (R.meta.best > 0) wrap.appendChild(node('p', 'tag', 'BEST ' + R.meta.best));
    wrap.appendChild(button('bigbtn', 'PLAY', function () { R.startRun(); }));
    wrap.appendChild(node('p', 'note', 'Portrait &middot; single player &middot; works offline'));
  }

  function buildPause(wrap) {
    wrap.appendChild(node('h2', null, 'PAUSED'));
    wrap.appendChild(node('p', 'tag', 'Tap anywhere to resume'));
    wrap.addEventListener('click', function () { R.resume(); });
  }

  /*
   * The tip names whatever took the most core HP, which is what the player
   * actually needs to solve, rather than the most numerous leaker.
   */
  var DEFEAT_TIPS = {
    brute: 'Brutes soak up most of the light, and everything walking behind one is shielded. Meet them head on, or split the beam so a second line reaches the rest.',
    bruteking: 'Brutes soak up most of the light, and everything walking behind one is shielded. Meet them head on, or split the beam so a second line reaches the rest.',
    umbra: 'Umbra absorbs almost everything. Upgrade the core and light the long segments so it is burning for as long as possible.',
    swarmling: 'Swarms drain a beam fast: each one takes a bite before the light reaches the next. Split the light, or add a Lamp as a second source.',
    runner: 'Runners cross a single lit cell in half a second. Light a whole road segment lengthwise so they stay in the light.',
    mote: 'Light along the road burns for the whole segment; light across it burns for one cell. Try to get LIT above 15.'
  };

  function defeatTip(s) {
    var worst = null;
    var worstHp = -1;
    for (var type in s.leaksBy) {
      var hp = s.leaksBy[type] * (B.ENEMY[type] ? B.ENEMY[type].leak : 1);
      if (hp > worstHp) { worstHp = hp; worst = type; }
    }
    if (!worst || worstHp <= 0) return DEFEAT_TIPS.mote;
    return DEFEAT_TIPS[worst] || DEFEAT_TIPS.mote;
  }

  function statLine(label, value) {
    return node('p', 'statline', label + ' <b>' + value + '</b>');
  }

  function buildDefeat(wrap) {
    var s = R.state;
    var h = node('h2', null, 'THE CORE FELL');
    h.style.color = '#ff5d6c';
    wrap.appendChild(h);
    wrap.appendChild(statLine('Reached wave', s.wave + ' of 12'));
    wrap.appendChild(statLine('Score', s.score));
    if (R.meta.best > 0) wrap.appendChild(node('p', 'tag', 'BEST ' + R.meta.best));
    wrap.appendChild(node('div', 'tip', defeatTip(s)));
    wrap.appendChild(button('bigbtn', 'TRY AGAIN', function () { R.restartRun(); }));
  }

  function buildVictory(wrap) {
    var s = R.state;
    var h = node('h2', null, 'THE LIGHT HELD');
    h.style.color = '#ffc247';
    wrap.appendChild(h);
    wrap.appendChild(statLine('Waves cleared', s.wavesCleared));
    wrap.appendChild(statLine('Core HP left', s.coreHp + ' of ' + B.CORE_HP));
    wrap.appendChild(statLine('Road lit', s.beam.litRoadCount + ' of ' + s.roadCells));
    wrap.appendChild(statLine('Score', s.score));
    if (R.meta.best > 0) wrap.appendChild(node('p', 'tag', 'BEST ' + R.meta.best));
    wrap.appendChild(button('bigbtn', 'PLAY AGAIN', function () { R.restartRun(); }));
    if (R.continueEndless) {
      wrap.appendChild(button('bigbtn ghost', 'CONTINUE &mdash; ENDLESS', function () { R.continueEndless(); }));
    }
  }

  /* Rebuild only when the phase changes, so overlays do not flicker. */
  ui.syncOverlay = function (s) {
    var want = null;
    if (s.ui.helpOpen) want = 'help';
    else if (s.phase === 'title') want = 'title';
    else if (s.phase === 'paused') want = 'pause';
    else if (s.phase === 'lost') want = 'lost';
    else if (s.phase === 'won') want = 'won';

    if (want === overlayKind) return;
    if (!want) {
      closeOverlay();
      return;
    }
    if (want === 'help') openOverlay('help', buildHelp);
    else if (want === 'title') openOverlay('title', buildTitle);
    else if (want === 'pause') openOverlay('pause', buildPause);
    else if (want === 'lost') openOverlay('lost', buildDefeat);
    else if (want === 'won') openOverlay('won', buildVictory);
  };

  ui.overlayKind = function () {
    return overlayKind;
  };

  /* ---------- HUD buttons ---------- */

  function bindHudButtons() {
    el.btnPause.addEventListener('click', function () {
      var s = R.state;
      if (s.phase === 'paused') R.resume();
      else R.pause();
    });
    el.btnNext.addEventListener('click', function () {
      var s = R.state;
      if (s.phase === 'building') R.callWaveEarly(s);
    });
    el.btnCore.addEventListener('click', function () {
      R.pieces.upgradeCore(R.state);
    });
    el.btnHelp.addEventListener('click', function () {
      if (R.state.ui.helpOpen) ui.closeHelp();
      else ui.openHelp();
    });
    el.btnSpeed.addEventListener('click', function () {
      var s = R.state;
      var opts = B.SPEED_OPTIONS;
      var i = opts.indexOf(s.speed);
      s.speed = opts[(i + 1) % opts.length];
    });
  }

  function syncHudButtons(s) {
    var speedLabel = s.speed + '×';
    if (cache.speed !== speedLabel) {
      cache.speed = speedLabel;
      el.btnSpeed.textContent = speedLabel;
      el.btnSpeed.classList.toggle('on', s.speed !== 1);
    }
    var paused = s.phase === 'paused';
    if (cache.paused !== paused) {
      cache.paused = paused;
      el.btnPause.classList.toggle('playing', paused);
    }
    var showNext = s.phase === 'building';
    if (cache.showNext !== showNext) {
      cache.showNext = showNext;
      el.btnNext.hidden = !showNext;
    }
  }


  /* ---------- palette ---------- */

  var PIECE_LABEL = {
    mirror: 'MIRROR', splitter: 'SPLITTER', reflector: 'REFLECTOR', lamp: 'LAMP'
  };

  var paletteButtons = {};

  function buildPalette() {
    el.palette.innerHTML = '';
    R.PIECE_TYPES.forEach(function (type) {
      var b = node('button', 'pbtn');
      b.type = 'button';
      b.dataset.type = type;
      b.appendChild(node('span', 'picon ' + type));
      b.appendChild(node('span', 'pname', PIECE_LABEL[type]));
      b.appendChild(node('span', 'pcost', '0<span class="c">&#9670;</span>'));
      b.appendChild(node('span', 'plock', ''));
      b.addEventListener('click', function () {
        var s = R.state;
        R.pieces.deselect(s);
        s.ui.selectedType = type;
        if (!s.unlocked[type]) {
          ui.notice(PIECE_LABEL[type] + ' UNLOCKS AT WAVE ' + B.UNLOCK_WAVE[type], 2);
        }
      });
      b.addEventListener('pointerdown', function (ev) {
        R.input.beginPaletteDrag(type, ev);
      });
      el.palette.appendChild(b);
      paletteButtons[type] = {
        root: b,
        cost: b.querySelector('.pcost'),
        lock: b.querySelector('.plock')
      };
    });
  }

  function syncPalette(s) {
    R.PIECE_TYPES.forEach(function (type) {
      var pb = paletteButtons[type];
      var unlocked = s.unlocked[type];
      var cost = R.pieces.cost(s, type);
      var stamp = type + '|' + unlocked + '|' + cost + '|' + (s.gold >= cost) + '|' + (s.ui.selectedType === type);
      if (cache['pal' + type] === stamp) return;
      cache['pal' + type] = stamp;
      pb.cost.innerHTML = cost + '<span class="c">&#9670;</span>';
      pb.root.classList.toggle('sel', s.ui.selectedType === type);
      pb.root.classList.toggle('poor', unlocked && s.gold < cost);
      pb.root.classList.toggle('locked', !unlocked);
      pb.lock.textContent = unlocked ? '' : 'WAVE ' + B.UNLOCK_WAVE[type];
      pb.lock.style.display = unlocked ? 'none' : 'flex';
    });
  }

  ui.flashPalette = function (type) {
    var pb = paletteButtons[type];
    if (pb) pulse(pb.root, 'unlockflash');
  };

  /* ---------- action row ---------- */

  function syncActionRow(s) {
    var cost = R.pieces.coreUpgradeCost(s);
    var coreStamp = s.coreLevel + '|' + cost + '|' + (cost !== null && s.gold >= cost);
    if (cache.core !== coreStamp) {
      cache.core = coreStamp;
      el.btnCore.querySelector('.a1').innerHTML = 'CORE &#9650; Lv' + s.coreLevel;
      el.btnCore.querySelector('.a2').innerHTML = cost === null
        ? 'MAX'
        : cost + '<span class="c">&#9670;</span>';
      el.btnCore.classList.toggle('dim', cost === null || s.gold < cost);
    }
    var bonus = R.earlyCallBonus(s);
    var nextStamp = s.phase + '|' + bonus;
    if (cache.next !== nextStamp) {
      cache.next = nextStamp;
      el.btnNext.querySelector('.a2').innerHTML = '&#9654; +' + bonus + '<span class="c">&#9670;</span>';
    }
  }

  /* ---------- action bar over a selected piece ---------- */

  var actionBar = null;

  function buildActionBar() {
    actionBar = node('div', null);
    actionBar.id = 'actionBar';
    actionBar.style.display = 'none';
    actionBar.appendChild(button('', 'FLIP', function () {
      var s = R.state;
      var p = R.pieces.selected(s);
      if (p) R.pieces.flip(s, p.c, p.r);
    }));
    actionBar.appendChild(button('', 'MOVE', function () {
      var s = R.state;
      if (R.pieces.selected(s)) s.ui.moveMode = !s.ui.moveMode;
    }));
    actionBar.appendChild(button('danger', 'SELL', function () {
      var s = R.state;
      var p = R.pieces.selected(s);
      if (p) R.pieces.sell(s, p.c, p.r);
    }));
    el.overlayHost.appendChild(actionBar);
  }

  function syncActionBar(s) {
    var p = R.pieces.selected(s);
    if (!p || s.ui.drag) {
      if (actionBar.style.display !== 'none') actionBar.style.display = 'none';
      cache.bar = null;
      return;
    }
    var flip = actionBar.children[0];
    var move = actionBar.children[1];
    var sell = actionBar.children[2];
    var stamp = p.id + '|' + p.c + '|' + p.r + '|' + s.ui.moveMode + '|' + R.pieces.refundFor(s, p) + '|' + R.render.boardW;
    if (cache.bar === stamp) return;
    cache.bar = stamp;

    flip.style.display = p.type === 'reflector' ? 'none' : '';
    move.textContent = s.ui.moveMode ? 'TAP TILE' : 'MOVE';
    move.classList.toggle('danger', false);
    sell.innerHTML = 'SELL ' + R.pieces.refundFor(s, p);

    var above = p.r > 1;
    var pos = R.render.projectCell(p.c, p.r, above ? 0.6 : 0);
    actionBar.style.display = 'flex';
    /* Keep the whole bar on screen, whichever edge the piece sits near. */
    var half = actionBar.offsetWidth / 2 + 4;
    actionBar.style.left = Math.round(R.util.clamp(pos.x, half, R.render.boardW - half)) + 'px';
    actionBar.style.top = Math.round(above ? pos.y - 54 : pos.y + 30) + 'px';
  }

  /* ---------- undo chip ---------- */

  var undoChip = null;

  function buildUndoChip() {
    undoChip = button('', 'UNDO', function () {
      R.pieces.undo(R.state);
    });
    undoChip.id = 'undoChip';
    undoChip.style.display = 'none';
    el.overlayHost.appendChild(undoChip);
  }

  function syncUndoChip(s) {
    var live = R.pieces.undoLive(s);
    var show = !!live && !s.ui.drag;
    if (cache.undo === show) return;
    cache.undo = show;
    undoChip.style.display = show ? 'block' : 'none';
  }

  /* ---------- drag ghost ---------- */

  var ghost = null;

  function buildGhost() {
    ghost = node('div', null);
    ghost.id = 'dragGhost';
    ghost.style.display = 'none';
    ghost.appendChild(node('span', 'picon'));
    document.getElementById('app').appendChild(ghost);
  }

  function syncGhost(s) {
    var d = s.ui.drag;
    if (!d || !d.dragging) {
      if (cache.ghost !== false) {
        cache.ghost = false;
        ghost.style.display = 'none';
      }
      return;
    }
    cache.ghost = true;
    var app = document.getElementById('app').getBoundingClientRect();
    ghost.style.display = 'block';
    ghost.style.left = Math.round(d.x - app.left) + 'px';
    ghost.style.top = Math.round(d.y - app.top - 70) + 'px';
    ghost.firstChild.className = 'picon ' + d.type;
    ghost.style.opacity = d.valid ? '1' : '0.45';
  }


  /* ---------- hint toasts ---------- */

  var hintNode = null;
  var hintUntil = 0;
  var hintKey = null;

  var HINTS = {
    start: 'Tap a tile on the beam to bend it along the road.',
    placed: 'Tap a placed piece to flip, move or sell it.',
    along: 'Light along the road burns for the whole segment. Across it, only one cell.',
    brute: 'Brutes soak up the light. Anything walking behind one is shielded.',
    swarm: 'Swarms drain a beam fast. Split it, or add a second source.',
    splitter: 'SPLITTER unlocked: passes and bends at the same time, 55% each way.',
    reflector: 'REFLECTOR unlocked: sends the light back down the same chain at 60%.',
    lamp: 'LAMP unlocked: a second source, half the core power, aim it anywhere.',
    core: 'Gold also buys core power. A brighter beam burns everything faster.'
  };

  function buildHint() {
    hintNode = node('div', 'hint');
    hintNode.style.display = 'none';
    el.overlayHost.appendChild(hintNode);
  }

  /* Each hint fires at most once per run, and any new one replaces the old. */
  ui.hint = function (s, key, seconds) {
    if (!HINTS[key] || s.ui.hintsShown[key]) return;
    s.ui.hintsShown[key] = true;
    hintKey = key;
    hintUntil = realTime + (seconds || 4.5);
    hintNode.textContent = HINTS[key];
    hintNode.style.display = 'block';
  };

  ui.dismissHint = function () {
    hintUntil = 0;
  };

  function syncHint(s) {
    var show = hintKey !== null && realTime < hintUntil && !s.ui.drag && !R.pieces.selected(s);
    if (cache.hint === show) return;
    cache.hint = show;
    hintNode.style.display = show ? 'block' : 'none';
  }

  /* ---------- help ---------- */

  function buildHelp(wrap) {
    wrap.appendChild(node('h2', null, 'HOW TO PLAY'));
    var rows = node('div', 'rows');
    var lines = [
      ['MIRROR', 'Bends the beam a quarter turn. No power lost.'],
      ['SPLITTER', 'Passes straight <b>and</b> bends, at 55% each.'],
      ['REFLECTOR', 'Sends the light back the way it came at 60%, so it meets the road from the other end.'],
      ['LAMP', 'A second source at half the core power, aimed wherever you turn it.'],
      ['CORE', 'Upgrading the core brightens the beam and every lamp with it.'],
      ['BURNING', 'Anything standing in the light takes damage every moment it stays there. Long lit segments burn for longer than a single crossing.'],
      ['SHIELDING', 'Every shadow the light passes through takes a bite out of it, so the ones behind take less. Brutes take the biggest bite.'],
      ['DIRECTION', 'Light meets the road from the end it arrives at. Aim it against the walk to hit the leader, or with the walk to hit the back of the pack first.'],
      ['LOOPS', 'Light never retraces the same tile in the same direction, so a closed ring of mirrors goes dark.']
    ];
    lines.forEach(function (l) {
      rows.appendChild(node('div', 'row', '<span class="k">' + l[0] + '</span> ' + l[1]));
    });
    wrap.appendChild(rows);
    wrap.appendChild(button('bigbtn', 'BACK', function () { ui.closeHelp(); }));
  }

  ui.openHelp = function () {
    var s = R.state;
    if (s.ui.helpOpen) return;
    s.ui.helpOpen = true;
    if (R.isSimulating(s)) R.pause();
  };

  ui.closeHelp = function () {
    var s = R.state;
    if (!s.ui.helpOpen) return;
    s.ui.helpOpen = false;
    if (s.phase === 'paused') R.resume();
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
    el.waveLbl = key(el.statWave.querySelector('.lbl'), 'waveLbl');
    el.waveVal = key(el.statWave.querySelector('.val'), 'waveVal');
    el.waveSub = key(el.statWave.querySelector('.sub'), 'waveSub');
    el.litVal = key(el.statLit.querySelector('.val'), 'litVal');
    el.litSub = key(el.statLit.querySelector('.sub'), 'litSub');
    el.strip = byId('strip');
    el.stripText = key(byId('stripText'), 'strip');
    el.overlayRoot = byId('overlayRoot');
    el.btnPause = byId('btnPause');
    el.btnSpeed = byId('btnSpeed');
    el.btnHelp = byId('btnHelp');
    el.btnMute = byId('btnMute');
    el.btnCore = byId('btnCore');
    el.btnNext = byId('btnNext');
    el.palette = byId('palette');
    el.overlayHost = el.overlay;
    bindHudButtons();
    buildPalette();
    buildActionBar();
    buildUndoChip();
    buildGhost();
    buildHint();

    for (var i = 0; i < FLOATER_POOL; i++) floaters.push(makeFloater());
    ui.el = el;
  };

  ui.frame = function (s, dtReal) {
    realTime += dtReal;
    stepFloaters(dtReal);
    ui.handleEvents(s);
    ui.update(s);
    syncHudButtons(s);
    syncPalette(s);
    syncActionRow(s);
    syncActionBar(s);
    syncUndoChip(s);
    syncGhost(s);
    syncHint(s);
    ui.syncOverlay(s);
  };

  ui.reset = function () {
    ui.clearFloaters();
    cache = {};
    stripNotice = '';
    stripNoticeUntil = 0;
    lastLit = 0;
    hintKey = null;
    hintUntil = 0;
    if (hintNode) hintNode.style.display = 'none';
    overlayKind = null;
    if (el.overlayRoot) closeOverlay();
  };
})(typeof window !== 'undefined' ? window : globalThis);
