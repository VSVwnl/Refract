'use strict';
/*
 * map-candidates.js - road layouts under consideration, for tools/map-lab.js.
 * Development only; never part of the build.
 *
 * Each map is written as a start cell plus a list of legs, which is far harder
 * to get wrong than a hand-written list of coordinates. `build` walks the legs,
 * checks every step is a single orthogonal move onto a fresh cell, and returns
 * the path in the form the game expects.
 */

const STEP = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

function build(name, start, legs) {
  const path = [start.slice()];
  const seen = new Set([start[0] + ',' + start[1]]);
  let c = start[0];
  let r = start[1];
  legs.forEach(function (leg) {
    const d = STEP[leg[0]];
    if (!d) throw new Error(name + ': bad direction ' + leg[0]);
    for (let i = 0; i < leg[1]; i++) {
      c += d[0];
      r += d[1];
      if (c < 0 || c > 7 || r < 0 || r > 11) throw new Error(name + ': leaves the board at ' + c + ',' + r);
      const key = c + ',' + r;
      if (seen.has(key)) throw new Error(name + ': path crosses itself at ' + key);
      seen.add(key);
      path.push([c, r]);
    }
  });
  return {
    name: name,
    spawn: start.slice(),
    core: path[path.length - 1].slice(),
    path: path
  };
}

module.exports = {
  /* The layout that shipped: a serpentine hugging the left and right edges. */
  shipped: build('shipped', [1, 0], [
    ['S', 3], ['E', 5], ['S', 3], ['W', 4], ['S', 4], ['E', 5], ['S', 1]
  ]),

  /*
   * Three parallel six-cell rows joined by short verticals, with both side
   * columns left completely open as trunks.
   */
  cascade: build('cascade', [2, 0], [
    ['S', 2], ['E', 4], ['S', 3], ['W', 5], ['S', 3], ['E', 5], ['S', 2], ['E', 1], ['S', 1]
  ]),

  /*
   * Four six-cell rows at 2, 4, 6 and 8 with the connectors alternating
   * between column 1 and column 6, so every long run has a buildable cell at
   * both ends and the middle of the board stays open.
   */
  weave: build('weave', [3, 0], [
    ['S', 2], ['W', 2], ['S', 2], ['E', 5], ['S', 2], ['W', 5], ['S', 2], ['E', 5],
    ['S', 2], ['E', 1], ['S', 1]
  ]),

  /*
   * weave with a longer top row and the spawn moved right, so all four long
   * horizontals are 5 or 6 cells and every one has a buildable cell at both
   * ends.
   */
  weave2: build('weave2', [5, 0], [
    ['S', 2], ['W', 4], ['S', 2], ['E', 5], ['S', 2], ['W', 5], ['S', 2], ['E', 5],
    ['S', 2], ['E', 1], ['S', 1]
  ]),

  /*
   * weave with the connectors stretched to four cells, so the verticals are
   * worth lighting lengthwise too and a purely horizontal comb leaves a lot
   * of road dark.
   */
  weave3: build('weave3', [5, 0], [
    ['S', 2], ['W', 4], ['S', 3], ['E', 5], ['S', 2], ['W', 5], ['S', 3], ['E', 6], ['S', 1]
  ]),

  /* A spiral: long runs in all four directions, winding inward. */
  spiral: build('spiral', [0, 0], [
    ['E', 6], ['S', 4], ['W', 5], ['S', 3], ['E', 4], ['S', 3], ['E', 2], ['S', 1]
  ]),

  /*
   * Long runs that reach the board edges on alternating sides, so several of
   * them dead-end off the board and can only be served by a branch or a lamp.
   */
  terminals: build('terminals', [2, 0], [
    ['S', 2], ['E', 4], ['S', 3], ['W', 6], ['S', 3], ['E', 5], ['S', 2], ['E', 2], ['S', 1]
  ]),

  /*
   * Long vertical runs as well as horizontals, kept away from column 7 so the
   * core's own beam still only grazes the road.
   */
  columns: build('columns', [1, 0], [
    ['E', 4], ['S', 4], ['W', 3], ['S', 4], ['E', 4], ['S', 2], ['E', 1], ['S', 1]
  ])
};
