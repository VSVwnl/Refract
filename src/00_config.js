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
    HP_MULT_PER_WAVE: 0.34,
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
      bulwark:   { hp: 80,  speed: 0.55, absorb: 0.55, shield: 0.60, gold: 18,  leak: 2,  radius: 0.36 },
      bruteking: { hp: 460, speed: 0.45, absorb: 0.70, shield: 0.60, gold: 50,  leak: 6,  radius: 0.50, boss: true },
      /*
       * Umbra advances behind its shield, then drops it for the rest of the
       * walk. `exposeAt` is the fraction of the road at which that happens, so
       * the armoured phase rewards reaching its back or bringing a return
       * pass, and the exposed phase rewards everything the player has built.
       */
      umbra:     { hp: 330, speed: 0.55, absorb: 0.70, shield: 0.70, exposeAt: 0.45, gold: 100, leak: 10, radius: 0.56, boss: true }
    },
    /*
     * Eight encounters. Each one either introduces a decision, combines ideas
     * already taught, or pays one off. Each group is
     * [type, count, gapSeconds, mouth], where mouth 0 is the north entrance
     * and mouth 1 is the west one; the mouth defaults to north when left off.
     *
     * The west mouth is not used until encounter 3, and the strip names it
     * during planning before anything walks out of it. Bodies entering there
     * skip the first sweep, so a network built only across the top misses them.
     *
     * 1 first light   one slow group; place a mirror and watch it burn.
     * 2 absorption    a clump that shields itself; then the first upgrade.
     * 3 two mouths    the west entrance opens and skips the top sweep.
     * 4 the shield    Bulwarks walk in facing the light; reflectors unlock.
     * 5 fast and deep a swarm one way, a shield the other; lamps unlock,
     *                 then the second upgrade choice.
     * 6 payoff        the specialisation chosen above gets to work.
     * 7 everything    all four threats through both mouths.
     * 8 Umbra         the boss the long way, escorts through the short one.
     */
    WAVES: [
      [ ['mote', 5, 1.2, 0] ],
      [ ['mote', 4, 0.5, 0], ['mote', 5, 0.9, 0] ],
      [ ['mote', 4, 0.8, 0], ['runner', 4, 0.6, 1] ],
      [ ['bulwark', 2, 2.0, 0], ['mote', 5, 0.8, 1] ],
      [ ['bulwark', 1, 0, 0], ['swarmling', 12, 0.25, 1], ['runner', 4, 0.5, 0] ],
      [ ['bulwark', 2, 1.6, 1], ['runner', 5, 0.45, 0], ['mote', 4, 0.7, 1] ],
      [ ['swarmling', 10, 0.22, 0], ['bulwark', 2, 1.4, 1], ['runner', 6, 0.45, 0], ['mote', 6, 0.6, 1] ],
      [ ['umbra', 1, 0, 0], ['runner', 5, 0.6, 1], ['bulwark', 1, 0, 1], ['mote', 5, 0.7, 0] ]
    ],
    /*
     * After the encounters listed in UPGRADE_AFTER the run pauses and offers a
     * choice of three. Each one is meant to change how the network is built,
     * not simply to add a percentage, and each is capped so it cannot compound
     * with itself. Focused Core and Twin Flames pull the same lever in
     * opposite directions and are mutually exclusive.
     */
    SECOND_MOUTH_WAVE: 3,
    UPGRADE_AFTER: [2, 5],
    UPGRADE_OFFER: 3,
    UPGRADES: {
      crossfire: {
        name: 'CROSSFIRE',
        blurb: 'An enemy lit from two different directions at once takes 25% more. Counted once, however many beams arrive.',
        bonus: 0.25
      },
      afterglow: {
        name: 'AFTERGLOW',
        blurb: 'Light leaves a burn behind. A body that has been hit keeps taking a third of that power for 0.75 s after it leaves the beam.',
        seconds: 0.75,
        share: 0.34
      },
      piercing: {
        name: 'PIERCING LIGHT',
        blurb: 'Bodies drink a quarter less of the beam, so more of it reaches whatever is standing behind them. Shields are unaffected.',
        absorbCut: 0.25
      },
      focused: {
        name: 'FOCUSED CORE',
        blurb: 'The core beam is a third stronger and every lamp is a third weaker. Commit to one efficient network.',
        core: 1.34,
        lamp: 0.66,
        excludes: 'twin'
      },
      twin: {
        name: 'TWIN FLAMES',
        blurb: 'Every lamp is two thirds stronger and the core beam is a fifth weaker. Commit to several independent sources.',
        core: 0.8,
        lamp: 1.65,
        excludes: 'focused'
      },
      reach: {
        name: 'LONG REACH',
        blurb: 'A splitter sends 60% down each branch instead of 50%, so spreading the light costs less.',
        split: 0.6
      }
    },
    ENDLESS: { BASE_COUNT: 8, SPEED_PER_WAVE: 0.02, SPEED_CAP: 1.5, KING_EVERY: 5 }
  };

  R.PIECE_TYPES = ['mirror', 'splitter', 'reflector', 'lamp'];

  /*
   * The fixed map "Switchback", which has two mouths.
   *
   * One road runs the length of the board: four long sweeps alternating
   * direction, joined by short connectors, ending at the core. Every sweep has
   * a buildable cell at both ends, so any of them can be lit from either
   * direction, and columns 0 and 7 are left open as trunks for chaining
   * between them.
   *
   * The second entrance is a side gate on the left edge at (0,3) that joins the
   * road at (1,3), below the first sweep. Bodies coming in that way skip that
   * whole sweep - seven cells of road - so a network built only across the top
   * catches one stream and misses the other almost entirely. That is the
   * decision the second entrance exists to create. It is placed on row 3
   * rather than on a sweep row so that every sweep keeps a buildable cell at
   * both ends.
   *
   * A fully separate second road was measured on this footprint and rejected:
   * it consumed the routing corridors, and a greedy build search stopped
   * choosing splitters and reflectors altogether. The reasoning and the
   * numbers are in the build log.
   *
   * Enemies are spawned one cell above their own portal and walk in.
   */
  R.MAP = {
    name: 'Switchback',
    core: [7, 11],
    /* The shared body of the road, from the junction at (1,2) to the core. */
    trunk: [
      [1, 2],
      [1, 3], [1, 4],
      [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
      [6, 5], [6, 6],
      [5, 6], [4, 6], [3, 6], [2, 6], [1, 6],
      [1, 7], [1, 8],
      [2, 8], [3, 8], [4, 8], [5, 8], [6, 8],
      [6, 9], [6, 10],
      [7, 10],
      [7, 11]
    ],
    /*
     * Each mouth is the cells it adds, plus the index in the trunk it joins
     * at. The cell before the join has to be an orthogonal neighbour of it.
     */
    mouths: [
      { name: 'north', spawn: [5, 0], lead: [[5, 0], [5, 1], [5, 2], [4, 2], [3, 2], [2, 2]], join: 0 },
      { name: 'west', spawn: [0, 3], lead: [[0, 3]], join: 1 }
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

  R.STORAGE = { BEST: 'refract.best', MUTED: 'refract.muted', TUTORIAL: 'refract.taught' };
})(typeof window !== 'undefined' ? window : globalThis);
