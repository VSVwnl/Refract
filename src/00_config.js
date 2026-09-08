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
    START_GOLD: 60,
    CORE_POWER: [10, 13, 17, 22, 28, 35],
    CORE_UPGRADE_COST: [60, 100, 150, 220, 300],
    LAMP_FACTOR: 0.5,
    SPLIT_FACTOR: 0.5,
    REFLECT_FACTOR: 0.6,
    MIN_POWER: 0.5,
    MAX_DEPTH: 48,
    MAX_SEGMENTS: 128,
    PIECE_COST: { mirror: 20, splitter: 45, reflector: 60, lamp: 90 },
    LAMP_COST_STEP: 20,
    SELL_RATE: 0.7,
    UNDO_WINDOW: 3.0,
    /*
     * A piece is transparent to light while it re-forms after a move. Editing
     * during planning is free; this delay only applies mid-combat, so it is
     * short enough to stay a tactical cost rather than a punishment.
     */
    MOVE_REFORM: 0.3,
    GROUP_GAP: 1.5,
    WAVE_CLEAR_BASE: 24,
    WAVE_CLEAR_PER_WAVE: 12,
    HP_MULT_PER_WAVE: 0.2,
    UNLOCK_WAVE: { splitter: 3, reflector: 4, lamp: 5 },
    SPEED_OPTIONS: [1, 2],
    /*
     * Two separate constants govern how a body interacts with light, so they
     * can be tuned and tested independently:
     *
     *   absorb  how much of the beam this body removes from what continues
     *           behind it. This is what shields the enemies further along.
     *   shield  how much incoming damage is deflected when light meets this
     *           enemy head on, in the face it is walking towards. Light that
     *           reaches its flank or its back is not reduced at all.
     *
     * A shield reduces damage; it is never total immunity. Attacking from
     * another direction, adding a return pass, or simply lighting more of the
     * road are all legitimate answers with different costs.
     */
    ENEMY: {
      mote:      { hp: 30,  speed: 1.0,  absorb: 0.25, shield: 0,    gold: 4,   leak: 1,  radius: 0.28 },
      runner:    { hp: 16,  speed: 1.9,  absorb: 0.10, shield: 0,    gold: 5,   leak: 1,  radius: 0.22 },
      swarmling: { hp: 8,   speed: 1.3,  absorb: 0.15, shield: 0,    gold: 1,   leak: 1,  radius: 0.14 },
      bulwark:   { hp: 95,  speed: 0.55, absorb: 0.55, shield: 0.60, gold: 18,  leak: 2,  radius: 0.36 },
      bruteking: { hp: 460, speed: 0.45, absorb: 0.70, shield: 0.60, gold: 50,  leak: 6,  radius: 0.50, boss: true },
      /*
       * Umbra advances behind its shield, then drops it for the rest of the
       * walk. `exposeAt` is the fraction of the road at which that happens, so
       * the armoured phase rewards reaching its back or bringing a return
       * pass, and the exposed phase rewards everything the player has built.
       */
      umbra:     { hp: 430, speed: 0.55, absorb: 0.70, shield: 0.70, exposeAt: 0.45, gold: 100, leak: 10, radius: 0.56, boss: true }
    },
    /*
     * Eight encounters. Each one either introduces a decision, combines ideas
     * already taught, or pays one off. Each group is [type, count, gapSeconds];
     * groups run in order with GROUP_GAP between them.
     *
     * 1 first light   one slow group; place a mirror and watch it burn.
     * 2 absorption    a small clump that shields itself; then the first upgrade.
     * 3 distribution  two clusters close together; one line cannot cover both.
     * 4 the shield    Bulwarks walk in facing the light; reflectors unlock.
     * 5 fast and deep a swarm behind a Bulwark; lamps unlock, then the second
     *                 upgrade choice.
     * 6 payoff        the specialisation chosen above gets to work.
     * 7 everything    all four threats, and the last spending decision.
     * 8 Umbra         armoured advance, then an exposed phase with escorts.
     */
    WAVES: [
      [ ['mote', 5, 1.2] ],
      [ ['mote', 4, 0.5], ['mote', 5, 0.9] ],
      [ ['runner', 4, 0.5], ['mote', 6, 0.7] ],
      [ ['bulwark', 2, 2.0], ['mote', 5, 0.8] ],
      [ ['bulwark', 1, 0], ['swarmling', 12, 0.25], ['runner', 5, 0.5] ],
      [ ['bulwark', 2, 1.6], ['runner', 6, 0.45], ['mote', 5, 0.7] ],
      [ ['swarmling', 12, 0.22], ['bulwark', 2, 1.4], ['runner', 6, 0.45], ['mote', 6, 0.6] ],
      [ ['umbra', 1, 0], ['runner', 5, 0.6], ['bulwark', 1, 0], ['mote', 5, 0.7] ]
    ],
    ENDLESS: { BASE_COUNT: 8, SPEED_PER_WAVE: 0.02, SPEED_CAP: 1.5, KING_EVERY: 5 }
  };

  R.PIECE_TYPES = ['mirror', 'splitter', 'reflector', 'lamp'];

  /*
   * The fixed map "Switchback". Four long sweeps alternate direction down the
   * board, joined by short connectors. Every long sweep has a buildable cell at
   * both ends, so any of them can be lit from either direction, and columns 0
   * and 7 are left open as trunks for chaining between them.
   *
   * Enemies are spawned one cell above the portal and walk in.
   */
  R.MAP = {
    name: 'Switchback',
    spawn: [5, 0],
    core: [7, 11],
    path: [
      [5, 0], [5, 1], [5, 2],
      [4, 2], [3, 2], [2, 2], [1, 2],
      [1, 3], [1, 4],
      [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
      [6, 5], [6, 6],
      [5, 6], [4, 6], [3, 6], [2, 6], [1, 6],
      [1, 7], [1, 8],
      [2, 8], [3, 8], [4, 8], [5, 8], [6, 8],
      [6, 9], [6, 10],
      [7, 10],
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
      bulwark: 0x1a1526,
      bruteking: 0x241a10,
      umbra: 0x140b22
    },
    enemyGlint: {
      mote: 0xd63bff,
      runner: 0x35e0d0,
      swarmling: 0xff56b0,
      bulwark: 0x8a7bd6,
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
