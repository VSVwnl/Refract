/*
 * Audio. Everything is synthesised with the Web Audio API at run time; there
 * are no sound files. The context is created on the first user gesture, and
 * the whole module fails silently if audio is unavailable or blocked.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});

  var audio = {};
  R.audio = audio;

  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var blocked = false;

  var hum = null;
  var humGain = null;

  var voices = [];
  var MAX_VOICES = 8;

  var lastAt = {};
  var rng = null;

  var MASTER_GAIN = 0.5;
  var HUM_MAX = 0.08;
  var HUM_FULL_POWER = 260;

  /* ---------- lifecycle ---------- */

  function makeNoiseBuffer() {
    var len = Math.floor(ctx.sampleRate * 0.5);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function buildHum() {
    humGain = ctx.createGain();
    humGain.gain.value = 0;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    humGain.connect(filter);
    filter.connect(master);

    hum = [];
    [[55, 0], [110, 4], [55.6, -3]].forEach(function (spec) {
      var osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = spec[0];
      osc.detune.value = spec[1];
      var g = ctx.createGain();
      g.gain.value = spec[0] > 100 ? 0.35 : 0.6;
      osc.connect(g);
      g.connect(humGain);
      osc.start();
      hum.push(osc);
    });
  }

  /* Called on every user gesture; creates the context the first time. */
  audio.ensure = function () {
    if (blocked) return false;
    try {
      if (!ctx) {
        var Ctor = global.AudioContext || global.webkitAudioContext;
        if (!Ctor) {
          blocked = true;
          return false;
        }
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = R.meta.muted ? 0 : MASTER_GAIN;
        master.connect(ctx.destination);
        noiseBuffer = makeNoiseBuffer();
        rng = R.util.makeRng(0x9e3779b9);
        buildHum();
      }
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      return true;
    } catch (err) {
      blocked = true;
      ctx = null;
      return false;
    }
  };

  audio.available = function () {
    return !!ctx && !blocked;
  };

  audio.state = function () {
    return ctx ? ctx.state : 'none';
  };

  audio.setMuted = function (muted) {
    R.meta.muted = !!muted;
    R.util.storeSet(R.STORAGE.MUTED, muted ? '1' : '0');
    if (master) {
      try {
        master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime, 0.02);
      } catch (err) {
        master.gain.value = muted ? 0 : MASTER_GAIN;
      }
    }
    return R.meta.muted;
  };

  audio.toggleMute = function () {
    return audio.setMuted(!R.meta.muted);
  };

  /* ---------- voice management ---------- */

  function reap(now) {
    for (var i = voices.length - 1; i >= 0; i--) {
      if (voices[i].until <= now) voices.splice(i, 1);
    }
  }

  /* Returns a gain node to hang a voice on, or null when the cap is reached. */
  function claim(peak, duration) {
    var now = ctx.currentTime;
    reap(now);
    if (voices.length >= MAX_VOICES) {
      var quietest = 0;
      for (var i = 1; i < voices.length; i++) {
        if (voices[i].peak < voices[quietest].peak) quietest = i;
      }
      if (voices[quietest].peak >= peak) return null;
      try {
        voices[quietest].gain.gain.cancelScheduledValues(now);
        voices[quietest].gain.gain.setTargetAtTime(0, now, 0.01);
      } catch (err) {
        /* the node may already have finished */
      }
      voices.splice(quietest, 1);
    }
    var g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    voices.push({ gain: g, peak: peak, until: now + duration + 0.05 });
    return g;
  }

  audio.voiceCount = function () {
    if (!ctx) return 0;
    reap(ctx.currentTime);
    return voices.length;
  };

  /* Small random detune so repeated hits do not sound mechanical. */
  function vary(amount) {
    return 1 + (rng() * 2 - 1) * (amount === undefined ? 0.06 : amount);
  }

  function tone(opts) {
    if (!ctx) return;
    var dur = opts.dur || 0.1;
    var peak = opts.peak === undefined ? 0.3 : opts.peak;
    var g = claim(peak, dur + (opts.delay || 0));
    if (!g) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var osc = ctx.createOscillator();
    osc.type = opts.type || 'sine';
    var f0 = opts.from * (opts.steady ? 1 : vary(opts.varyAmount));
    var f1 = (opts.to === undefined ? opts.from : opts.to) * (opts.steady ? 1 : vary(opts.varyAmount));
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(opts) {
    if (!ctx || !noiseBuffer) return;
    var dur = opts.dur || 0.08;
    var peak = opts.peak === undefined ? 0.2 : opts.peak;
    var g = claim(peak, dur + (opts.delay || 0));
    if (!g) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    var filter = ctx.createBiquadFilter();
    filter.type = opts.filter || 'bandpass';
    filter.frequency.setValueAtTime(opts.freq || 1200, t0);
    if (opts.freqTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqTo), t0 + dur);
    filter.Q.value = opts.q || 1;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function throttled(key, seconds) {
    if (!ctx) return false;
    var now = ctx.currentTime;
    if (lastAt[key] !== undefined && now - lastAt[key] < seconds) return false;
    lastAt[key] = now;
    return true;
  }

  /* ---------- the sound set ---------- */

  var SFX = {
    place: function () {
      tone({ from: 880, to: 1320, dur: 0.06, type: 'sine', peak: 0.3 });
    },
    flip: function () {
      noise({ dur: 0.02, filter: 'highpass', freq: 2400, peak: 0.18 });
    },
    sweep: function () {
      noise({ dur: 0.12, filter: 'bandpass', freq: 500, freqTo: 2600, q: 2, peak: 0.14 });
    },
    sizzle: function () {
      if (!throttled('sizzle', 0.15)) return;
      noise({ dur: 0.03, filter: 'highpass', freq: 4200, peak: 0.07 });
    },
    gold: function () {
      if (!throttled('gold', 0.1)) return;
      tone({ from: 1760, dur: 0.08, type: 'triangle', peak: 0.14 });
    },
    killSmall: function () {
      tone({ from: 520, to: 150, dur: 0.09, type: 'sine', peak: 0.2 });
    },
    kill: function () {
      tone({ from: 300, to: 80, dur: 0.1, type: 'sine', peak: 0.24 });
    },
    killBig: function () {
      tone({ from: 180, to: 50, dur: 0.22, type: 'sine', peak: 0.34 });
      noise({ dur: 0.18, filter: 'lowpass', freq: 380, peak: 0.22 });
    },
    leak: function () {
      tone({ from: 90, to: 40, dur: 0.2, type: 'sine', peak: 0.36, steady: true });
      noise({ dur: 0.16, filter: 'lowpass', freq: 260, peak: 0.2 });
    },
    waveStart: function () {
      tone({ from: 220, dur: 0.14, type: 'square', peak: 0.16, steady: true });
      tone({ from: 330, dur: 0.18, type: 'square', peak: 0.16, steady: true, delay: 0.13 });
    },
    waveClear: function () {
      [523, 659, 784].forEach(function (f, i) {
        tone({ from: f, dur: 0.13, type: 'triangle', peak: 0.2, steady: true, delay: i * 0.08 });
      });
    },
    unlock: function () {
      [1046, 1318, 1568].forEach(function (f, i) {
        tone({ from: f, dur: 0.09, type: 'sine', peak: 0.16, steady: true, delay: i * 0.06 });
      });
    },
    upgrade: function () {
      tone({ from: 400, to: 1200, dur: 0.2, type: 'sawtooth', peak: 0.16, steady: true });
    },
    deny: function () {
      tone({ from: 150, to: 110, dur: 0.1, type: 'square', peak: 0.14, steady: true });
    },
    victory: function () {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) {
        tone({ from: f, dur: 0.24, type: 'triangle', peak: 0.24, steady: true, delay: i * 0.14 });
      });
    },
    defeat: function () {
      [330, 262, 196].forEach(function (f, i) {
        tone({ from: f, dur: 0.4, type: 'sine', peak: 0.26, steady: true, delay: i * 0.22 });
      });
    }
  };

  audio.names = Object.keys(SFX);

  audio.play = function (name) {
    if (!ctx || blocked || R.meta.muted) return false;
    var fn = SFX[name];
    if (!fn) return false;
    try {
      fn();
      return true;
    } catch (err) {
      return false;
    }
  };

  /* ---------- reacting to the simulation ---------- */

  audio.handleEvents = function (state) {
    if (!ctx || R.meta.muted) return;
    for (var i = 0; i < state.events.length; i++) {
      var e = state.events[i];
      switch (e.type) {
        case 'place': audio.play('place'); audio.play('sweep'); break;
        case 'flip': audio.play('flip'); audio.play('sweep'); break;
        case 'move': audio.play('sweep'); break;
        case 'sell':
        case 'undo': audio.play('flip'); audio.play('gold'); break;
        case 'denied': audio.play('deny'); break;
        case 'kill':
          audio.play(e.boss ? 'killBig' : (e.enemy === 'bulwark' ? 'killBig' : (e.enemy === 'swarmling' ? 'killSmall' : 'kill')));
          audio.play('gold');
          break;
        case 'leak': audio.play('leak'); break;
        case 'wavestart': audio.play('waveStart'); break;
        case 'waveclear': audio.play('waveClear'); break;
        case 'unlock': audio.play('unlock'); break;
        case 'upgrade': audio.play('upgrade'); break;
        case 'win': audio.play('victory'); break;
        case 'lose': audio.play('defeat'); break;
        default: break;
      }
    }
  };

  /* The hum tracks how much light is falling on the road. */
  audio.frame = function (state) {
    if (!ctx || !humGain) return;
    var burning = false;
    for (var i = 0; i < state.enemies.length; i++) {
      if (state.time - state.enemies[i].hitAt < 0.1) { burning = true; break; }
    }
    if (burning) audio.play('sizzle');

    var live = state.phase === 'building' || state.phase === 'wave';
    var target = live
      ? HUM_MAX * R.util.clamp(state.beam.litRoadPower / HUM_FULL_POWER, 0, 1)
      : 0;
    try {
      humGain.gain.setTargetAtTime(target, ctx.currentTime, 0.12);
    } catch (err) {
      humGain.gain.value = target;
    }
  };

  audio.humLevel = function () {
    return humGain ? humGain.gain.value : 0;
  };

  audio.init = function () {
    var start = function () { audio.ensure(); };
    global.addEventListener('pointerdown', start, true);
    global.addEventListener('keydown', start, true);
    global.addEventListener('touchstart', start, true);
  };
})(typeof window !== 'undefined' ? window : globalThis);
