/*
 * Utilities: deterministic random numbers, small math helpers, easing curves,
 * a fixed-capacity object pool and guarded local storage access.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});

  R.util = {};

  /* mulberry32: small, fast, seedable generator. Returns a function in [0,1). */
  R.util.makeRng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  R.util.clamp = function (v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  };

  R.util.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  R.util.invLerp = function (a, b, v) {
    return a === b ? 0 : (v - a) / (b - a);
  };

  R.util.easeOutCubic = function (t) {
    var u = 1 - t;
    return 1 - u * u * u;
  };

  R.util.easeInCubic = function (t) {
    return t * t * t;
  };

  R.util.easeOutBack = function (t) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    var u = t - 1;
    return 1 + c3 * u * u * u + c1 * u * u;
  };

  /* Blend two 0xRRGGBB integers. */
  R.util.mixColor = function (a, b, t) {
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    var r = Math.round(ar + (br - ar) * t);
    var g = Math.round(ag + (bg - ag) * t);
    var bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
  };

  /*
   * Fixed-capacity pool. create() builds one item up front; the pool never
   * grows past capacity, which keeps mesh counts stable across restarts.
   */
  R.util.Pool = function (capacity, create, reset) {
    this.items = new Array(capacity);
    this.capacity = capacity;
    this.active = 0;
    this.reset = reset || null;
    for (var i = 0; i < capacity; i++) this.items[i] = create(i);
  };

  R.util.Pool.prototype.acquire = function () {
    if (this.active >= this.capacity) return null;
    return this.items[this.active++];
  };

  R.util.Pool.prototype.releaseAll = function () {
    if (this.reset) {
      for (var i = 0; i < this.active; i++) this.reset(this.items[i]);
    }
    this.active = 0;
  };

  R.util.Pool.prototype.forEachActive = function (fn) {
    for (var i = 0; i < this.active; i++) fn(this.items[i], i);
  };

  /* Local storage is optional; a blocked or full store must never throw. */
  R.util.storeGet = function (key) {
    try {
      return global.localStorage ? global.localStorage.getItem(key) : null;
    } catch (err) {
      return null;
    }
  };

  R.util.storeSet = function (key, value) {
    try {
      if (global.localStorage) global.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  };

  /* "1.5" -> "1.5", "12" -> "12": short numbers for the HUD. */
  R.util.fmt = function (n) {
    return (Math.round(n * 10) / 10).toString();
  };
})(typeof window !== 'undefined' ? window : globalThis);
