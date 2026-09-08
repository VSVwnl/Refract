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
    f.tx = opts && opts.tx !== undefined ? opts.tx : null;
    f.ty = opts && opts.ty !== undefined ? opts.ty : null;
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

  /* Board-overlay coordinates of the gold counter, for arcing rewards. */
  function goldTarget() {
    var board = document.getElementById('board').getBoundingClientRect();
    var g = el.statGold.getBoundingClientRect();
    return { tx: g.left + g.width / 2 - board.left, ty: g.top + g.height / 2 - board.top };
  }

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
      if (f.tx !== null) {
        /* Arc towards the gold counter so the reward reads as banked. */
        var e = R.util.easeInCubic(t);
        f.node.style.left = (f.x + (f.tx - f.x) * e) + 'px';
        f.node.style.top = (f.y + (f.ty - f.y) * e - Math.sin(t * Math.PI) * 26) + 'px';
        f.node.style.opacity = String(t < 0.75 ? 1 : (1 - t) * 4);
      } else {
        f.node.style.top = (f.y + f.vy * t) + 'px';
        f.node.style.opacity = String(1 - t * t);
      }
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
  ui.pulseLight = function () { pulse(el.statLight, 'bump'); };

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
    var mouth = R.enemies.newMouthNote(s, next);
    /* A new entrance outranks the threat description: it changes the board. */
    var note = mouth
      ? '<span class="warn">' + mouth.toUpperCase() + '</span>'
      : '<span class="em">' + R.enemies.threatNote(next) + '</span>';
    return 'NEXT ' + pips(R.enemies.composition(next)) + '&middot; ' + note;
  }

  /* ---------- HUD ---------- */

  ui.update = function (s) {
    setText(el.hpVal, String(Math.max(0, s.coreHp)));
    setText(el.goldVal, String(Math.floor(s.gold)));
    setText(el.waveLbl, s.endless ? 'ENDLESS' : 'WAVE');
    setText(el.waveVal, String(s.wave));
    setText(el.waveSub, s.endless ? '' : '/' + B.WAVES.length);
    /*
     * Coverage is how much of the road is lit. It is deliberately a secondary
     * reading: it says how far the network reaches, not how much damage it
     * does, and the two come apart whenever a formation shields itself. The
     * damage figure behind that distinction is development telemetry, not
     * something to put in front of the player.
     */
    var taken = s.upgrades.join(',');
    if (cache.upgrades !== taken) {
      cache.upgrades = taken;
      el.upgradeBar.innerHTML = '';
      for (var ui2 = 0; ui2 < s.upgrades.length; ui2++) {
        el.upgradeBar.appendChild(node('span', 'uptag', B.UPGRADES[s.upgrades[ui2]].name));
      }
      el.upgradeBar.hidden = s.upgrades.length === 0;
    }

    var cov = s.beam.litRoadCount;
    if (cov > lastCov) ui.pulseLight();
    lastCov = cov;
    setText(el.covVal, String(cov));
    setText(el.covSub, '/' + s.roadCells);

    var html = stripHtml(s);
    if (cache.strip !== html) {
      cache.strip = html;
      el.stripText.innerHTML = html;
    }
  };

  /* ---------- events ---------- */

  var goldFloaterAt = 0;
  var lastCov = 0;

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
          if (!R.tutorialActive(s)) ui.hint(s, 'placed');
          break;
        case 'tutorialblocked':
          ui.floaterAtCell('Not yet', 'info', e.c, e.r, { ttl: 0.6 });
          break;
        case 'tutorialskip':
          ui.notice('TUTORIAL SKIPPED', 1.6);
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
            var target = goldTarget();
            target.ttl = 0.8;
            ui.floaterAtWorld('+' + e.gold, 'gold', e.x, e.z, target);
          }
          ui.bumpGold();
          break;
        case 'leak':
          ui.shakeHp();
          ui.flashVignette(0.35 + 0.1 * e.leak);
          ui.floaterAtWorld('-' + e.leak, 'dmg', e.x, e.z, { ttl: 1.1 });
          break;
        case 'waveclear':
          ui.notice('WAVE ' + e.wave + ' CLEARED  +' + e.bonus, 2.2);
          ui.banner('CLEARED', '+' + e.bonus + ' gold', 1.7);
          ui.bumpGold();
          if (e.wave === 1) ui.hint(s, 'along', 6);
          if (e.wave === 3) ui.hint(s, 'core', 6);
          break;
        case 'wavestart':
          ui.notice('WAVE ' + e.wave, 1.4);
          ui.banner(s.endless ? 'ENDLESS ' + e.wave : 'WAVE ' + e.wave, null, 1.5);
          break;
        case 'runstart':
          lastCov = 0;
          ui.hint(s, 'start', 7);
          break;
        case 'spawn':
          if (e.enemy === 'bulwark' || e.enemy === 'bruteking') ui.hint(s, 'bulwark', 6);
          if (e.enemy === 'swarmling') ui.hint(s, 'swarm', 6);
          break;
        case 'endless':
          ui.notice('ENDLESS MODE', 2.4);
          break;
        case 'unlock':
          ui.notice(String(TYPE_LABEL_PIECE[e.piece] || e.piece).toUpperCase() + ' UNLOCKED', 3);
          ui.flashPalette(e.piece);
          ui.hint(s, e.piece, 6);
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
    var wrap = node('div', 'overlay ov-' + kind);
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
    bulwark: 'A Bulwark carries its shield on the face it walks towards, so light meeting it head on mostly bounces off. Reach its flank or its back with a second line, or bring a return pass the other way.',
    bruteking: 'A Brute King shields its front and soaks up the rest, so everything walking behind it is in shadow. Light it from another direction.',
    umbra: 'Umbra absorbs almost everything. Upgrade the core and light the long segments so it is burning for as long as possible.',
    swarmling: 'Swarms drain a beam fast: each one takes a bite before the light reaches the next. Split the light, or add a Lamp as a second source.',
    runner: 'Runners cross a single lit cell in half a second. Light a whole road segment lengthwise so they stay in the light.',
    mote: 'Light along the road burns for the whole segment; light across it burns for one cell. Push COVERAGE up so they stay in the light for longer.'
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

  /*
   * A run can end two ways, and the screen has to say which. Surviving the
   * boss is not a win, so a breach gets its own heading and its own reason
   * rather than being reported as a core that ran out of health.
   */
  function buildDefeat(wrap) {
    var s = R.state;
    var breach = s.bossBreached;
    var name = breach === 'umbra' ? 'UMBRA' : 'THE BOSS';
    var h = node('h2', null, breach ? name + ' REACHED THE CORE' : 'THE CORE FELL');
    h.style.color = '#ff5d6c';
    wrap.appendChild(h);
    if (breach) {
      wrap.appendChild(node('p', 'reason',
        'It had to be destroyed on the road. The core was still standing at ' +
        Math.max(0, s.coreHp) + ' of ' + B.CORE_HP + ' HP, and that is not enough.'));
    }
    wrap.appendChild(statLine('Reached wave', s.wave + ' of ' + B.WAVES.length));
    wrap.appendChild(statLine('Score', s.score));
    if (R.meta.best > 0) wrap.appendChild(node('p', 'tag', 'BEST ' + R.meta.best));
    wrap.appendChild(node('div', 'tip', breach ? BREACH_TIP : defeatTip(s)));
    wrap.appendChild(button('bigbtn', 'TRY AGAIN', function () { R.restartRun(); }));
  }

  var BREACH_TIP = 'Umbra advances behind its shield, then drops it about halfway down the road. ' +
    'Light that meets the shield head on is mostly turned away, so reach its flank or its back, ' +
    'or add a return pass. Once the shield is down, everything you have built counts.';

  function buildVictory(wrap) {
    var s = R.state;
    var h = node('h2', null, 'THE LIGHT HELD');
    h.style.color = '#ffc247';
    wrap.appendChild(h);
    wrap.appendChild(statLine('Waves cleared', s.wavesCleared));
    wrap.appendChild(statLine('Core HP left', s.coreHp + ' of ' + B.CORE_HP));
    wrap.appendChild(statLine('Coverage', s.beam.litRoadCount + ' of ' + s.roadCells + ' road cells'));
    wrap.appendChild(statLine('Score', s.score));
    if (R.meta.best > 0) wrap.appendChild(node('p', 'tag', 'BEST ' + R.meta.best));
    wrap.appendChild(button('bigbtn', 'PLAY AGAIN', function () { R.restartRun(); }));
    if (R.continueEndless) {
      wrap.appendChild(button('bigbtn ghost', 'CONTINUE &mdash; ENDLESS', function () { R.continueEndless(); }));
    }
  }

  /*
   * The choice of three offered after certain encounters. The run is stopped
   * while it is up, so the descriptions can be read without a clock running,
   * and each card says plainly what it changes.
   */
  function buildUpgradeChoice(wrap) {
    var s = R.state;
    var h = node('h2', null, 'CHOOSE AN UPGRADE');
    h.style.color = '#ffc247';
    wrap.appendChild(h);
    wrap.appendChild(node('p', 'upnote', 'It lasts for the rest of this run.'));

    var cards = node('div', 'upcards');
    var offer = s.upgradeOffer || [];
    for (var i = 0; i < offer.length; i++) {
      cards.appendChild(upgradeCard(offer[i]));
    }
    wrap.appendChild(cards);
  }

  function upgradeCard(key) {
    var def = B.UPGRADES[key];
    var card = node('button', 'upcard');
    card.type = 'button';
    card.setAttribute('data-upgrade', key);
    card.appendChild(node('span', 'upname', def.name));
    card.appendChild(node('span', 'upblurb', def.blurb));
    card.addEventListener('click', function () {
      R.audio.ensure();
      R.chooseUpgrade(R.state, key);
    });
    return card;
  }

  /* Rebuild only when the phase changes, so overlays do not flicker. */
  ui.syncOverlay = function (s) {
    var want = null;
    if (s.ui.helpOpen) want = 'help';
    else if (s.phase === 'title') want = 'title';
    else if (s.phase === 'paused') want = 'pause';
    else if (s.phase === 'lost') want = 'lost';
    else if (s.phase === 'won') want = 'won';
    else if (s.phase === 'choosing') want = 'choosing';

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
    else if (want === 'choosing') openOverlay('choosing', buildUpgradeChoice);
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
      R.startWave(R.state);
    });
    el.btnCore.addEventListener('click', function () {
      R.pieces.upgradeCore(R.state);
    });
    el.btnMute.addEventListener('click', function () {
      R.audio.ensure();
      R.audio.toggleMute();
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
    if (cache.muted !== R.meta.muted) {
      cache.muted = R.meta.muted;
      el.btnMute.classList.toggle('muted', R.meta.muted);
      el.btnMute.setAttribute('aria-label', R.meta.muted ? 'Sound off' : 'Sound on');
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
    /*
     * The button says what it is for whenever a wave could be next, and is
     * merely dimmed while the walkthrough is still on an earlier step. It only
     * reads RUNNING once a wave actually is.
     */
    var planning = s.phase === 'building';
    var canStart = R.canStartWave(s);
    var nextStamp = s.phase + '|' + s.wave + '|' + canStart;
    if (cache.next !== nextStamp) {
      cache.next = nextStamp;
      el.btnNext.querySelector('.a1').textContent = planning ? 'START WAVE ' + (s.wave + 1) : 'WAVE ' + s.wave;
      el.btnNext.querySelector('.a2').innerHTML = planning ? '&#9654;' : 'RUNNING';
      el.btnNext.classList.toggle('dim', !canStart);
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

  /* ---------- the walkthrough ---------- */

  var tutorBar = null;
  var tutorText = null;

  function buildTutorial() {
    tutorBar = node('div', 'tutor');
    tutorBar.id = 'tutorBar';
    tutorText = node('p', 'tutortext', '');
    tutorBar.appendChild(tutorText);
    tutorBar.appendChild(button('tutorskip', 'SKIP TUTORIAL', function () {
      R.audio.ensure();
      R.skipTutorial(R.state);
    }));
    tutorBar.style.display = 'none';
    el.overlayHost.appendChild(tutorBar);
  }

  function syncTutorial(s) {
    var step = R.tutorialStep(s);
    if (cache.tutor === step) return;
    cache.tutor = step;
    tutorBar.style.display = step ? 'flex' : 'none';
    if (step) tutorText.textContent = R.TUTORIAL_TEXT[step];
    /* The button is only the answer on the last step, so it only glows then. */
    el.btnNext.classList.toggle('callout', step === 'start');
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
    start: 'Tap the marked tile to bend the beam along the road.',
    placed: 'Tap a placed piece to flip, move or sell it.',
    along: 'Light along the road burns for the whole segment. Across it, only one cell.',
    bulwark: 'A Bulwark shields the face it walks towards. Hit its flank or its back.',
    swarm: 'Swarms drain a beam fast. Split it, or add a second source.',
    splitter: 'SPLITTER unlocked: passes and bends at the same time, half the power each way.',
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
    /* The walkthrough is saying its own thing; two voices at once is noise. */
    if (R.tutorialActive(s)) return;
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
    /*
     * The hint and the undo chip share the foot of the board, so the hint
     * steps up out of the way while the chip is on screen rather than either
     * of them being lost behind the other.
     */
    var raised = show && (!!R.pieces.undoLive(s) || R.tutorialActive(s));
    var stamp = show + '|' + raised;
    if (cache.hint === stamp) return;
    cache.hint = stamp;
    hintNode.style.display = show ? 'block' : 'none';
    hintNode.classList.toggle('raised', raised);
  }

  /* ---------- help ---------- */

  function buildHelp(wrap) {
    wrap.appendChild(node('h2', null, 'HOW TO PLAY'));
    var rows = node('div', 'rows');
    var lines = [
      ['MIRROR', 'Bends the beam a quarter turn. No power lost.'],
      ['SPLITTER', 'Passes straight <b>and</b> bends, at half power each.'],
      ['REFLECTOR', 'Sends the light back the way it came at 60%, so it meets the road from the other end.'],
      ['LAMP', 'A second source at half the core power, aimed wherever you turn it.'],
      ['CORE', 'Upgrading the core brightens the beam and every lamp with it.'],
      ['BURNING', 'Anything standing in the light takes damage every moment it stays there. Long lit segments burn for longer than a single crossing.'],
      ['ABSORPTION', 'Every body the light passes through takes a bite out of it, so the ones behind take less. Bulwarks take the biggest bite.'],
      ['SHIELDS', 'A Bulwark carries its shield on the face it walks towards. Light meeting that face is mostly turned away; light reaching its flank or its back lands in full.'],
      ['DIRECTION', 'Light meets the road from the end it arrives at. Aim it against the walk to meet the leader head on, or with the walk to reach the backs of the pack.'],
      ['PLANNING', 'Nothing starts until you tap START WAVE. While you are planning, moving, turning and selling pieces is free.'],
      ['UPGRADES', 'After some encounters you choose one of three upgrades. They last the rest of the run and are meant to change how you build, not just how hard you hit.'],
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


  /* ---------- damage vignette ---------- */

  var vignette = null;
  var vignetteLevel = 0;

  function buildVignette() {
    vignette = node('div', null);
    vignette.id = 'vignette';
    document.getElementById('app').appendChild(vignette);
  }

  ui.flashVignette = function (strength) {
    vignetteLevel = Math.min(1, vignetteLevel + strength);
  };

  function stepVignette(dt) {
    if (vignetteLevel <= 0) {
      if (cache.vig !== 0) {
        cache.vig = 0;
        vignette.style.opacity = '0';
      }
      return;
    }
    vignetteLevel = Math.max(0, vignetteLevel - dt * 1.8);
    var v = Math.round(vignetteLevel * 100) / 100;
    if (cache.vig !== v) {
      cache.vig = v;
      vignette.style.opacity = String(v);
    }
  }

  /* ---------- wave banners ---------- */

  var banners = [];

  function buildBanners() {
    for (var i = 0; i < 2; i++) {
      var b = node('div', 'banner' + (i ? ' sub' : ''));
      b.style.display = 'none';
      el.overlayHost.appendChild(b);
      banners.push({ node: b, life: 0, ttl: 0 });
    }
  }

  ui.banner = function (main, sub, seconds) {
    var ttl = seconds || 1.6;
    banners[0].node.textContent = main;
    banners[0].life = 0;
    banners[0].ttl = ttl;
    banners[0].node.style.display = 'block';
    banners[1].node.textContent = sub || '';
    banners[1].life = 0;
    banners[1].ttl = sub ? ttl : 0;
    banners[1].node.style.display = sub ? 'block' : 'none';
  };

  function stepBanners(dt) {
    for (var i = 0; i < banners.length; i++) {
      var b = banners[i];
      if (b.ttl <= 0) continue;
      b.life += dt;
      var t = b.life / b.ttl;
      if (t >= 1) {
        b.ttl = 0;
        b.node.style.display = 'none';
        continue;
      }
      /* Slide in, hold, then rise away. */
      var slide = t < 0.18 ? (1 - R.util.easeOutCubic(t / 0.18)) * 40 : 0;
      var out = t > 0.75 ? (t - 0.75) / 0.25 : 0;
      b.node.style.transform = 'translate(-50%, ' + Math.round(-50 + slide - out * 30) + '%)';
      b.node.style.opacity = String(t < 0.18 ? t / 0.18 : (1 - out));
    }
  }

  ui.clearBanners = function () {
    for (var i = 0; i < banners.length; i++) {
      banners[i].ttl = 0;
      banners[i].node.style.display = 'none';
    }
  };

  /* ---------- lifecycle ---------- */

  ui.init = function () {
    el.overlay = byId('boardOverlay');
    el.statHp = byId('statHp');
    el.statGold = byId('statGold');
    el.statWave = byId('statWave');
    el.statLight = byId('statLight');
    el.hpVal = key(el.statHp.querySelector('.val'), 'hpVal');
    el.goldVal = key(el.statGold.querySelector('.val'), 'goldVal');
    el.waveLbl = key(el.statWave.querySelector('.lbl'), 'waveLbl');
    el.waveVal = key(el.statWave.querySelector('.val'), 'waveVal');
    el.waveSub = key(el.statWave.querySelector('.sub'), 'waveSub');
    el.covVal = key(el.statLight.querySelector('.val'), 'covVal');
    el.covSub = key(el.statLight.querySelector('.sub'), 'covSub');
    el.upgradeBar = byId('upgradeBar');
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
    buildTutorial();
    buildUndoChip();
    buildGhost();
    buildHint();
    buildVignette();
    buildBanners();

    for (var i = 0; i < FLOATER_POOL; i++) floaters.push(makeFloater());
    ui.el = el;
  };

  ui.frame = function (s, dtReal) {
    realTime += dtReal;
    /* Events first, so an effect started this frame is drawn this frame. */
    ui.handleEvents(s);
    stepFloaters(dtReal);
    stepBanners(dtReal);
    stepVignette(dtReal);
    ui.update(s);
    syncHudButtons(s);
    syncPalette(s);
    syncActionRow(s);
    syncActionBar(s);
    syncTutorial(s);
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
    lastCov = 0;
    vignetteLevel = 0;
    if (vignette) vignette.style.opacity = '0';
    ui.clearBanners();
    hintKey = null;
    hintUntil = 0;
    if (hintNode) hintNode.style.display = 'none';
    overlayKind = null;
    if (el.overlayRoot) closeOverlay();
  };
})(typeof window !== 'undefined' ? window : globalThis);
