/*
 * Configuration: every tunable number, the fixed map, colours and layout
 * constants. Systems read from here; they never hard-code values.
 */
(function (global) {
  'use strict';
  var R = global.R || (global.R = {});

  /* Direction codes. N is towards row 0 (up the screen). */
  R.N = 0;
  R.E = 1;
  R.S = 2;
  R.W = 3;
  R.DIR_NAMES = ['N', 'E', 'S', 'W'];

  /* Cell kinds stored in state.grid.kind. */
  R.EMPTY = 0;
  R.ROAD = 1;
  R.CORE = 2;
  R.SPAWN = 3;

  R.BALANCE = {
    COLS: 8,
    ROWS: 12,
    CORE_HP: 20,
    START_GOLD: 40,
    CORE_POWER: [10, 13, 17, 22, 28, 35],
    CORE_UPGRADE_COST: [60, 100, 150, 220, 300],
    LAMP_FACTOR: 0.5,
    SPLIT_FACTOR: 0.55,
    REFLECT_FACTOR: 0.6,
    MIN_POWER: 0.5,
    MAX_DEPTH: 48,
    MAX_SEGMENTS: 128,
    PIECE_COST: { mirror: 20, splitter: 45, reflector: 60, lamp: 90 },
    LAMP_COST_STEP: 20,
    SELL_RATE: 0.7,
    UNDO_WINDOW: 3.0,
    MOVE_REFORM: 0.75,
    COUNTDOWN: 8,
    FIRST_COUNTDOWN: 10,
    GROUP_GAP: 1.5,
    EARLY_CALL_RATE: 1.5,
    WAVE_CLEAR_BASE: 12,
    WAVE_CLEAR_PER_WAVE: 3,
    HP_MULT_PER_WAVE: 0.15,
    UNLOCK_WAVE: { splitter: 2, reflector: 4, lamp: 7 },
    SPEED_OPTIONS: [1, 2],
    ENEMY: {
      mote:      { hp: 30,  speed: 1.0,  absorb: 0.25, gold: 4,   leak: 1,  radius: 0.28 },
      runner:    { hp: 16,  speed: 1.9,  absorb: 0.10, gold: 5,   leak: 1,  radius: 0.22 },
      swarmling: { hp: 8,   speed: 1.3,  absorb: 0.15, gold: 1,   leak: 1,  radius: 0.14 },
      brute:     { hp: 120, speed: 0.55, absorb: 0.70, gold: 16,  leak: 3,  radius: 0.36 },
      bruteking: { hp: 400, speed: 0.45, absorb: 0.80, gold: 50,  leak: 6,  radius: 0.50, boss: true },
      umbra:     { hp: 900, speed: 0.40, absorb: 0.85, gold: 100, leak: 10, radius: 0.56, boss: true }
    },
    /* Each group is [type, count, gapSeconds]; groups run in order with GROUP_GAP between them. */
    WAVES: [
      [ ['mote', 4, 1.5] ],
      [ ['mote', 7, 1.2] ],
      [ ['runner', 4, 0.8], ['mote', 5, 1.2] ],
      [ ['mote', 10, 0.9], ['runner', 3, 0.7] ],
      [ ['brute', 2, 2.0], ['mote', 6, 1.0] ],
      [ ['swarmling', 8, 0.3], ['swarmling', 8, 0.3], ['runner', 4, 0.7] ],
      [ ['brute', 3, 1.5], ['mote', 8, 0.8] ],
      [ ['mote', 14, 0.6], ['runner', 6, 0.5] ],
      [ ['swarmling', 8, 0.25], ['swarmling', 8, 0.25], ['swarmling', 8, 0.25], ['brute', 2, 1.5] ],
      [ ['bruteking', 1, 0], ['runner', 8, 0.6] ],
      [ ['brute', 4, 1.2], ['mote', 10, 0.6], ['swarmling', 8, 0.25], ['swarmling', 8, 0.25] ],
      [ ['mote', 6, 0.7], ['brute', 2, 1.5], ['umbra', 1, 0], ['brute', 2, 1.5] ]
    ],
    ENDLESS: { BASE_COUNT: 8, SPEED_PER_WAVE: 0.02, SPEED_CAP: 1.5, KING_EVERY: 5 }
  };

  R.PIECE_TYPES = ['mirror', 'splitter', 'reflector', 'lamp'];

  /*
   * The fixed map "Stairway". Ordered path cells from the spawn portal to the
   * core; enemies walk in from one row above the first cell.
   */
  R.MAP = {
    name: 'Stairway',
    spawn: [1, 0],
    core: [7, 11],
    path: [
      [1, 0], [1, 1], [1, 2], [1, 3],
      [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
      [6, 4], [6, 5], [6, 6],
      [5, 6], [4, 6], [3, 6], [2, 6],
      [2, 7], [2, 8], [2, 9], [2, 10],
      [3, 10], [4, 10], [5, 10], [6, 10], [7, 10],
      [7, 11]
    ]
  };

  R.COLORS = {
    background: 0x0b0f1e,
    tile: 0x1c2541,
    tileTop: 0x223054,
    road: 0x0e1326,
    roadEdge: 0x2a3566,
    chevron: 0xffb45a,
    core: 0xfff0c4,
    coreRim: 0xffc247,
    beamHot: 0xffffff,
    beamMid: 0xffb545,
    beamLow: 0xff5528,
    litGlow: 0xffcf7a,
    mirror: 0xcfe3ff,
    mirrorEdge: 0x59e8ff,
    splitter: 0xb388ff,
    reflector: 0xffc861,
    lamp: 0xffb03a,
    valid: 0x4cd964,
    invalid: 0xff3b30,
    enemy: {
      mote: 0x2a1740,
      runner: 0x123536,
      swarmling: 0x140f1c,
      brute: 0x1a1526,
      bruteking: 0x241a10,
      umbra: 0x140b22
    },
    enemyGlint: {
      mote: 0xd63bff,
      runner: 0x35e0d0,
      swarmling: 0xff56b0,
      brute: 0x8a7bd6,
      bruteking: 0xffc247,
      umbra: 0xb14dff
    }
  };

  /* Camera and board framing. Margins are expressed in board cells. */
  R.VIEW = {
    TILT_DEG: 25,
    MARGIN_X: 0.18,
    MARGIN_TOP: 0.36,
    MARGIN_BOTTOM: 0.12,
    CAMERA_DISTANCE: 40
  };

  /* Fixed heights of the DOM rows, in CSS pixels. */
  R.LAYOUT = {
    HUD_H: 56,
    STRIP_H: 32,
    ACTION_H: 56,
    PALETTE_H: 96,
    MIN_CELL: 26,
    COLUMN_ASPECT: 0.56
  };

  R.TIMING = {
    FIXED_STEP: 1 / 60,
    MAX_FRAME_DT: 0.1,
    MAX_STEPS_PER_FRAME: 5
  };

  R.STORAGE = { BEST: 'refract.best', MUTED: 'refract.muted' };
})(typeof window !== 'undefined' ? window : globalThis);
