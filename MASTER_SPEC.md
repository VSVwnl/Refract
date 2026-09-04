# REFRACT — Master Specification

**Status:** Authoritative design + build specification. Written in the design stage, before any gameplay code exists.
**Audience:** A fresh Claude Opus (Claude Code) session that will build the game autonomously from this repository.
**Rule of precedence:** Official competition rules > this document > CLAUDE.md > anything else. If browser playtesting proves a numeric value wrong, tune the number and log it; do not change the concept.

---

## Table of Contents

1. Project Title
2. One-Sentence Hook
3. Competition Category
4. Competition Requirements (verified)
5. Why This Concept
6. Concept Selection Rationale
7. Player Fantasy
8. Game Overview
9. Core Loop
10. First 10 Seconds
11. Full Session Flow
12. Core Mechanics (exact)
13. Strategic Decisions
14. Progression
15. Difficulty / Escalation
16. Economy
17. Entities / Units / Resources
18. Initial Balance Values
19. Controls
20. Portrait Mobile UX
21. UI / HUD
22. Visual Direction
23. Game Feel
24. Audio Direction
25. Technical Architecture
26. Game State Model
27. Major Systems
28. File Structure
29. Offline Architecture
30. Performance Constraints
31. Edge Cases
32. Debug Tools
33. Implementation Phases
34. Browser Test Plan
35. Acceptance Tests
36. Human Playtest Plan
37. Judging Strategy
38. Special Award Strategy
39. Explicit Non-Goals
40. Stretch Goals
41. Submission Packaging
42. Build Log Procedure
43. Design Intent Notes
44. Final Competition Compliance Checklist
45. Schedule Reality

---

## 1. Project Title

**REFRACT**

Working fiction (kept minimal): a crystal called the **Lumen Core** sits at the foot of a dark stairway. Shadow creatures descend the winding road toward it. The core emits one beam of light. You do not build towers. You place mirrors and glass to bend that beam so it burns the shadows before they reach the core.

## 2. One-Sentence Hook

A tower defense with no towers: one beam of light comes out of the thing you are defending, and you win by bending, splitting and bouncing that single beam so it runs along the enemy road instead of merely crossing it.

## 3. Competition Category

**Tower Defense & Strategy** (select this genre at Devpost submission time).

Genre floor mapping (from the official Design Guidance, "must include"):

| Guidance requirement | REFRACT |
|---|---|
| Defenses the player places or manages | Mirrors, Splitters, Reflectors, Lamps; the Lumen Core itself is upgraded |
| Threats that escalate across the session | 12 scripted waves, 4 enemy types + 2 bosses, HP scaling, then Endless |
| A spend or upgrade decision that matters | Piece purchases vs. core upgrades vs. early-wave-call bonus; every piece has a distinct role |
| Recommended portrait layout | Enemies enter at the top, the defended core is at the bottom, defender palette across the base |

## 4. Competition Requirements (verified)

Source: Devpost main page, Official Rules, FAQ, Design Guidance, organizer forum replies, and the three official PDFs (Build Log guidance, Design-Intent template, "Building a Prototype with AI"). Verified on 2026-09-03.

**Hard requirements (must all hold in the final build):**

- Single-player. No multiplayer of any kind, no networking code.
- One fixed portrait orientation. The game must not rotate or reflow into a landscape layout during play.
- "A single .zip file, no larger than 35MB, with index.html at the top level of the .zip and not inside a folder."
- "Your submitted index.html must contain all of your own game code, in readable, unminified form."
- "Libraries such as Three.js must be included in the .zip inside a folder named vendor, and referenced with relative paths." Libraries may be minified; only our own code must be unminified.
- "All assets, fonts, images, audio and data must be included in the .zip and referenced with relative paths."
- "The build must not make any external network request while it is running." CDN references fail validation.
- Core loop: "a repeatable cycle of player actions with real-time feedback, a clear goal and a win, lose, or reset state, and one or more forms of meaningful progression within a single play session." Must be "playable and repeatable, not a static mockup or click-through."
- Built with AI tools (prompt-built). Minor manual edits to fix bugs or tune are fine.
- Original work; may use genre-standard mechanics; must not replicate a specific existing game.
- Nothing "half-finished or left in as a stub."
- No "hidden or embedded instructions, prompts, or text designed to influence, manipulate, or bias automated evaluation tools." Code comments must be plain technical documentation only. No evaluative language about the game in comments, no messages addressed to reviewers or AI systems.
- All text in English.

**Three submission artifacts:**

1. The build (.zip as above).
2. Design-Intent document: `.docx`, text only, 500 words max, on the official template, seven fixed sections in fixed order, no creator name or identifying information.
3. Build log: Markdown, named `buildlog.md`, a running record with (a) "Decisions locked so far" and (b) one entry per session. Not scored on quality. Must not contain personal information or other people's names.

**Judging facts that shape design:**

- Weights: Player Engagement 30%, Playability 25%, Core Loop Design 20%, Focus 15%, Originality 10%.
- Visual polish is intentionally not scored. Legibility is required: "A player can tell your game pieces apart and read what is happening at a glance."
- Phase one is an AI-assisted ranking that reads the code and checks packaging; phase two is human judges who "will be played on a mobile device in a browser." Design for safe areas.
- Judges see one sitting. There is no stated session length; the session must reach a result on its own.
- Special awards (Most Innovative, Most Fun to Play, Most Satisfying Progression) are judged on those qualities directly, not the weighted rubric. An entry can win only one prize.
- Organizer guidance: "One mechanic done well beats four that work partially." "Focus penalises sprawl and half-built systems, not ambition and not depth."
- Recommended offline test: rebuild, unzip into a clean folder, serve with a local web server, open in a private window, turn internet off, play a full session in portrait. Do not rely on double-clicking index.html.
- Deadline: **September 8, 2026, 1:00 PM PDT**. Resubmission before the deadline is allowed; upload early.

**Requirements that could not be verified:** none of the hard requirements are unverified. One open item: the forum question "Is browser-local save state acceptable?" had no organizer reply at time of research. REFRACT therefore uses `localStorage` only for a best score and the mute preference, wrapped in try/catch, and never requires it.

## 5. Why This Concept

- **Instant comprehension, deep discovery.** "Light hurts shadows. Put a mirror in the light." is understood in seconds. "Light along the road burns for the whole segment, light across the road for one cell" is discovered in the first minute. "Beam direction relative to enemy flow decides who shields whom" is discovered around minute three. That is exactly the "I understand this" → "Oh, that's clever" → "I want to try again differently" ladder.
- **The best mechanic is exposed at second one.** The beam is already firing when the board appears. The first tap bends it.
- **It is unmistakably its genre while being fresh.** Waves, a road, a defended core, a palette at the bottom. But there are no towers with ranges and cooldowns; there is one resource of light and a spatial puzzle about routing it.
- **Every system feeds the central mechanic.** Absorption, splitting, reflection, the second light source, the core upgrade, and wave composition all only exist to change how you route the beam.
- **It is deterministic and grid-based**, so an autonomous agent can test it reliably in a browser and with pure-function unit tests of the beam solver.
- **It renders well with nothing but primitives.** Glowing strips, low-poly shapes, emissive colors. No art pipeline.
- **Visible growth within one session.** The light network physically spreads across the board as the player builds; the HUD shows "road cells lit" climbing. Progression is literally visible.

## 6. Concept Selection Rationale

Thirty-plus concepts were generated internally across the three genres (rising-tide survival building, oxygen-budget diving, root-network survival, cloud-seeding farm sim, ant-colony tunnels, orbit-ring defense, gravity-well path bending, pinball-bumper defense, growth-age towers, draw-the-maze defense, and others) and scored against engagement, playability, loop depth, focus, originality, special-award potential, portrait/touch fit, replayability, feel potential, ease of understanding, technical feasibility, AI implementation reliability, browser testability, bug risk, scope risk and time-to-polish.

Why REFRACT beat the runners-up:

- **Rising-tide survival builder** (strongest survival candidate): dramatic, but needs structural-stability rules, a scrolling camera and three interlocking systems before it gets interesting; more bug surface, slower to feel good.
- **Orbit-ring defense**: tactile, but strategy collapses into "spin the ring" and it is fiddly on touch.
- **Gravity-well path bending**: original, but illegible at phone size and hard to balance.
- **Cloud-seeding farm sim**: charming, but the invest → harvest response is slow and the touch verb is weak.

REFRACT scored highest on the criteria with the largest judging weights (engagement, playability, core loop) and on testability, and it has the clearest special-award story (Most Innovative: no towers; Most Satisfying Progression: the visible spread of light and thickening beam).

Tower Defense is likely the most crowded genre in this competition. That is accepted deliberately: a distinctive mechanic stands out more against a crowd of conventional entries, and the genre is the safest to build and test autonomously.

## 7. Player Fantasy

You are a keeper of light. The fantasy is not "commander with an army" but "engineer of a single beautiful machine": every mirror you place makes the light do something new, and by the end your one beam has become a lattice of fire that the shadows cannot cross. The pleasure is watching your own cleverness burn things.

## 8. Game Overview

- Portrait board of 8 columns × 12 rows. A road switchbacks down the board from a portal near the top and ends at the Lumen Core in the bottom-right corner.
- The Core fires one beam straight up its column, forever. Untouched, it only crosses the road once, right before the core.
- The player buys and places pieces on empty tiles: **Mirror** (bends 90°), **Splitter** (bends and passes, two weaker beams), **Reflector** (sends the beam back the way it came), **Lamp** (a second, weaker light source). The Core can be upgraded to fire a stronger beam, which also strengthens Lamps.
- Enemies walk the road. Any enemy standing in a lit cell takes damage every frame equal to the beam's power at that cell. Each enemy the beam passes through absorbs part of it, so the beam dims as it goes.
- Twelve waves, each announced in spawn order before it starts, escalate from slow motes to shielding brutes, swarms and two bosses. Survive all twelve to win. Lose when the Core's HP reaches zero. After a win, an Endless mode continues for score.
- Session length target: 6–9 minutes to victory at 1× speed, less at 2×.

## 9. Core Loop

```
Look at the incoming wave (composition, in order)
   → Place / flip / move pieces so the beam covers more road, in the right direction
      → Wave runs in real time; light burns enemies; beam visibly dims past each one
         → Kills pay gold; leaks cost Core HP
            → Spend gold on pieces or Core power; unlock new pieces at set waves
               → Call the next wave early for bonus gold, or wait and rearrange
```

Loop period: one wave, 20–40 seconds. Repeatable inside a session (12 waves + Endless) and across sessions (score, strategies).

## 10. First 10 Seconds

1. Title card: "REFRACT", one line of premise, three icon-illustrated control lines, a large PLAY button. (One tap.)
2. Board appears. The Core pulses, its beam already shooting up the right column, faintly lighting the tiles it crosses. Wave 1 countdown starts (10 s). The Mirror button at the bottom is pre-selected and pulsing. A hint reads: "Tap a lit tile to place a mirror."
3. The player taps any tile on the beam column. A mirror pops in with a chime; the beam sweeps sideways at high speed across the board; if it lands along a road segment those road tiles light up. "LIT 1/31" in the HUD jumps to e.g. "LIT 7/31" with a pulse.
4. Wave 1's four motes come down the road and burn in the light. Gold floats to the counter. The player already understands the whole game.

If the player does nothing: wave 1 arrives at ~10 s, the four motes take the single-cell zap before the core, survive, leak 4 HP total. The Core flashes red each time, the HP number shakes. The hint pulses again. Pressure is legible and survivable.

## 11. Full Session Flow

| Time (1×) | What happens | What the player is learning |
|---|---|---|
| 0:00–0:15 | Title → board, first mirror placed, beam bends | The verb. Light kills. |
| 0:15–1:00 | Waves 1–2. Second mirror, maybe a third. Splitter unlocks after wave 1 clears. | Along-road beats across-road. "LIT n/31" is the goal number. |
| 1:00–2:30 | Waves 3–4. Runners (fast). Reflector unlocks after wave 3. First Core upgrade affordable. | Coverage in cells × time in cells = damage. Fast enemies need long lit segments. |
| 2:30–4:00 | Waves 5–6. First Brutes (absorb 70%), first Swarm. | Absorption. Who is in front matters. Splitting beats swarms; concentration beats brutes. Reflector reverses the order. |
| 4:00–6:00 | Waves 7–9. Lamp unlocks after wave 6. Dense mixed waves. | Multiple sources, Reflector return passes on separate routes, prioritising segments by enemy type. |
| 6:00–8:00 | Waves 10–12. Brute-King, then Umbra with escorts. | Everything at once. Core upgrades matter. |
| End | Victory screen: waves cleared, Core HP left, score, best score. Buttons: PLAY AGAIN, CONTINUE (ENDLESS). | Replay motivation: try a different route / beat the score. |
| Loss | Defeat screen with wave reached, score, and one contextual tip based on what killed the core. Button: TRY AGAIN. | Loss is explained. |

## 12. Core Mechanics (exact)

### 12.1 Board and coordinates

- Grid: `COLS = 8`, `ROWS = 12`. Column `c` in 0..7 left→right; row `r` in 0..11 top→bottom. Cell index `i = r * 8 + c`.
- Cell kinds: `EMPTY` (buildable), `ROAD` (enemies walk here; not buildable), `CORE` (7,11), `SPAWN` (5,0) (a road cell with a portal decoration; not buildable).
- Directions: `N = 0` (row − 1), `E = 1` (col + 1), `S = 2` (row + 1), `W = 3` (col − 1). Opposite = `(d + 2) % 4`.
- World mapping (Three.js): `x = c − 3.5`, `z = r − 5.5`, `y = 0` on the board plane. +z points toward the bottom of the screen.

### 12.2 The road (fixed map "Switchback")

Ordered path cells (spawn to core). Enemies are spawned one cell above the board at virtual cell (5, -1) and walk in.

```
(5,0) (5,1) (5,2)                             segment 1: south, column 5
(4,2) (3,2) (2,2) (1,2)                       segment 2: west, row 2
(1,3) (1,4)                                   segment 3: south, column 1
(2,4) (3,4) (4,4) (5,4) (6,4)                 segment 4: east, row 4
(6,5) (6,6)                                   segment 5: south, column 6
(5,6) (4,6) (3,6) (2,6) (1,6)                 segment 6: west, row 6
(1,7) (1,8)                                   segment 7: south, column 1
(2,8) (3,8) (4,8) (5,8) (6,8)                 segment 8: east, row 8
(6,9) (6,10)                                  segment 9: south, column 6
(7,10)                                        segment 10: east, row 10
(7,11)                                        CORE
```

31 road cells + core. Path length for movement = 32 cells from the virtual start.

ASCII (S = spawn, # = road, C = core, `|` = the default beam column, `.` = buildable):

```
      c0 c1 c2 c3 c4 c5 c6 c7
r0     .  .  .  .  .  S  .  |
r1     .  .  .  .  .  #  .  |
r2     .  #  #  #  #  #  .  |
r3     .  #  .  .  .  .  .  |
r4     .  #  #  #  #  #  #  |
r5     .  .  .  .  .  .  #  |
r6     .  #  #  #  #  #  #  |
r7     .  #  .  .  .  .  .  |
r8     .  #  #  #  #  #  #  |
r9     .  .  .  .  .  .  #  |
r10    .  .  .  .  .  .  #  #
r11    .  .  .  .  .  .  .  C
```

Why this map works (do not change it without a design reason):

- The default beam (column 7, going north) touches only the corner road cell (7,10). The player must act.
- **Column 7 is a trunk, not a wall.** Four long sweeps run at rows 2, 4, 6 and 8, and the core beam runs up past all four of them. Because light meets the lowest piece first, a mirror at (7,8) claims the row 8 sweep and starves everything above it; reaching a second sweep costs either a splitter on the trunk or a chain out to column 0 and back. That single fact is what makes splitters structural rather than optional.
- **Every long sweep has a buildable cell at both ends.** Rows 4, 6 and 8 run cols 1..6 with columns 0 and 7 open; row 2 runs cols 1..5 with column 0 and cell (6,2) open. Eight of the ten straight runs are open at both ends, so any sweep can be entered from either direction, and direction is a genuine choice on each of them rather than a property of the map.
- Columns 0 and 7 are clear top to bottom, so a beam can be carried the full height of the board and re-entered anywhere. This is what lets a Reflector sit at the far end of a sweep and send a second pass back through it, and what gives a Lamp on column 0 an independent network that never touches the core's chain.
- The four connectors (columns 1 and 6, three cells each) are short on purpose: they are worth crossing but never worth a dedicated chain, so the interesting decisions stay on the sweeps.
- Measured on this map with every tool unlocked: four distinct opening mirrors are within 15% of each other, five late-game layouts are viable, and a full build using all four piece types draws 18 beam segments and lights 23 of 31 road cells.

### 12.3 Light sources

- **Lumen Core** at (7,11): emits one beam northward (dir N) with power `CORE_POWER[level]`. Cannot be moved or rotated. Absorbs any beam that hits it.
- **Lamp** (placeable piece): emits one beam in its facing direction with power `LAMP_FACTOR × CORE_POWER[level]` (so Core upgrades strengthen Lamps too). Absorbs any beam that hits it.

### 12.4 Pieces

| Piece | Orientation states | Behaviour on incoming beam of power P |
|---|---|---|
| Mirror | 2: `/` (orient 0) or `\` (orient 1) | Reflects 90°, power P (no loss). |
| Splitter | 2: `/` or `\` | Passes straight with `P × SPLIT_FACTOR` AND reflects (mirror rule) with `P × SPLIT_FACTOR`. |
| Reflector | 1 (none) | Returns the beam in the opposite direction with `P × REFLECT_FACTOR`. |
| Lamp | 4 facings (N, E, S, W) | Is a source; absorbs incoming beams. |

Reflection table (screen space, y down; `/` runs from bottom-left to top-right):

| Incoming dir | `/` (orient 0) | `\` (orient 1) |
|---|---|---|
| N (moving up) | E | W |
| E (moving right) | N | S |
| S (moving down) | W | E |
| W (moving left) | S | N |

Pieces may be placed on `EMPTY` cells only. Any number of pieces may exist; the only limit is gold.

### 12.5 Beam solver (pure function, run every simulation tick)

Input: grid, pieces map, enemy occupancy (cell → enemies sorted by position along the beam's travel direction), core level.
Output: list of beam segments `{c0, r0, c1, r1, dir, powerStart, powerEnd, sourceId}` for rendering, the set of lit cells with their power, and damage events.

Algorithm:

```
for each source (core first, then lamps in placement order):
    trace(startCell = source cell, dir = source dir, power = source power, visited = new Set(), depth = 0)

trace(cell, dir, power, visited, depth):
    if depth > MAX_DEPTH (48) or power < MIN_POWER (0.5): return
    cur = step(cell, dir)                       // first cell in front of the emitter/piece
    segmentStart = cur
    loop:
        if cur is off-board: emit segment (segmentStart .. last on-board cell); return
        key = cellIndex(cur) * 4 + dir
        if visited has key: emit segment; return      // loop guard
        visited.add(key)
        mark cur as lit with current power
        for each enemy in occupancy[cur] (in order along dir):
            enemy.damage += power * dt                 // recorded as an event; applied by the caller
            power *= (1 - enemy.absorb)
            if power < MIN_POWER: emit segment ending at cur; return
        piece = pieces.get(cur)
        if piece and piece is inactive (re-forming after a move): piece = null   // beam passes through
        if piece:
            emit segment (segmentStart .. cur)
            if piece is Mirror:    trace(cur, reflect(dir, piece.orient), power, visited, depth+1)
            if piece is Splitter:  trace(cur, dir, power*SPLIT_FACTOR, visited, depth+1)
                                   trace(cur, reflect(dir, piece.orient), power*SPLIT_FACTOR, visited, depth+1)
            if piece is Reflector: trace(cur, opposite(dir), power*REFLECT_FACTOR, visited, depth+1)
            if piece is Lamp:      return               // absorbed
            return
        if cur is CORE: emit segment; return            // absorbed
        cur = step(cur, dir)

    global guard: stop emitting once the solve has produced MAX_SEGMENTS (128) segments in total.
```

Notes:
- `visited` is per source, keyed on (cell, direction). Rule stated to players in Help: "Light never retraces the same path in the same direction." A beam may cross a cell twice in different directions (e.g. the return pass from a Reflector) but can never loop. A closed square of four mirrors therefore terminates on the first repeat, and a second Reflector facing the first adds nothing; it must open a new route to be useful.
- Damage per tick is `power × dt` where power is the beam power *at that cell after absorption by enemies earlier in the beam*. This is what makes beam direction matter: a beam travelling against enemy flow meets the front enemy first; a beam travelling with the flow meets the rearmost first.
- The solver ignores enemies when used for previews and smart orientation (pass an empty occupancy map).
- Determinism: no randomness in the solver.

### 12.6 Enemies

- Move along the road with progress `t` in cells (`t += speed × dt`). An enemy spawns at `t = −1` (the virtual cell one row above the spawn portal) and walks in; for `t < 0` it occupies no cell and cannot be hit. For `t ≥ 0` the occupied cell is `path[floor(t)]`. Position = interpolation between consecutive path cell centers (the virtual start counts as a cell center). Reaching the core means `t ≥ path.length − 1` (the core cell, index 25).
- On reaching the core cell: `coreHp -= leakDamage`, enemy removed, leak feedback fires.
- HP ≤ 0: enemy dies, gold awarded, death feedback fires.
- Absorption is a per-type constant (see balance).
- No enemy attacks pieces. No enemy targets anything. They only walk.

### 12.7 Waves

- A wave is an ordered list of groups `{type, count, gap}` spawned sequentially; there is a `GROUP_GAP` between groups. Spawn order = front-to-back order on the road.
- Wave ends when the spawn queue is empty and no enemies are alive. Then: wave-clear bonus, unlock checks, `COUNTDOWN` seconds (8) of building time, next wave. Wave 1's countdown after PLAY is 10 s.
- During the countdown the NEXT WAVE button is available: starts the wave immediately and pays `ceil(remainingSeconds × EARLY_CALL_RATE)` gold.
- After wave 12 is cleared: victory. The player may continue into Endless (waves 13+), which is the same loop with generated waves until the core falls; score keeps counting.

### 12.8 Placement, flipping, moving, selling, undo

- **Place:** with a piece type selected in the palette, tap an `EMPTY` tile: pay cost, create piece, choose orientation by the smart-orientation rule, recompute beam immediately. Placement allowed during countdown and during waves.
- **Smart orientation:** for Mirror/Splitter evaluate both orientations (for Lamp all four facings) with the enemy-free solver; score = sum over lit road cells of power at that cell; choose the best; tie → orient 0 (Lamp: N). The player can flip afterwards.
- **Flip:** tapping a placed Mirror/Splitter selects it and shows the action bar; the FLIP action toggles orientation; for Lamp, rotates facing 90° clockwise. Reflector has no flip.
- **Move:** drag a placed piece to another `EMPTY` tile, or use the MOVE action then tap a target tile. A moved piece is inactive (translucent, beam passes through it) for `MOVE_REFORM` seconds (0.75). Moving is free.
- **Sell:** action bar SELL refunds `SELL_RATE` (70%) of the purchase price. Within `UNDO_WINDOW` (3 s) of placement, an UNDO chip appears; using it (or SELL in that window) refunds 100%.
- **Core upgrade:** a dedicated button in the action row. Costs `CORE_UPGRADE_COST[level]`; increases `level` (max 6). Immediate beam recompute and thickening.
- Insufficient gold: the palette button is dimmed; tapping a tile shakes the gold counter and floats "Need 20".

### 12.9 Win / lose / reset

- **Lose:** `coreHp <= 0` at any time → phase `lost`. Remaining enemies freeze and fade. Defeat overlay with wave reached, score, one contextual tip. TRY AGAIN performs a full reset and starts a new run directly at the board (no title screen).
- **Win:** wave 12 cleared → phase `won`. Victory overlay with stats, PLAY AGAIN (full reset) and CONTINUE (ENDLESS) (keeps state, continues with wave 13).
- **Reset** rebuilds the entire state object, clears all pooled entities, cancels timers/tweens, resets the RNG to a fresh seed, and recomputes the beam. Nothing from the previous run may survive except best score and mute preference.

### 12.10 Score

`score = goldEarnedTotal + 50 × wavesCleared + 10 × coreHp (at end)`. Best score is stored (`localStorage`, guarded). Shown on title, victory and defeat screens.

## 13. Strategic Decisions

1. **Which segments to light, and in which order along the chain.** Early segments in the beam chain get full power; later ones get what is left after absorption.
2. **Along vs. across.** A crossing costs one mirror and covers one cell; lighting a segment lengthwise covers 4–6 cells but requires the beam to reach the segment's extension line.
3. **Direction relative to enemy flow.** Against-flow beams hit the front enemy first (good when the front is fragile, bad when a Brute leads). With-flow beams hit the back first (good against a Brute leading a swarm).
4. **Concentrate or split.** Splitters give two beams at 55% each (110% total) but each is weaker against absorbers.
5. **Reflect or extend.** A Reflector at the end of a chain sends the light back through every segment behind it (second pass at 60%, in reverse order, so it meets the enemies from the other side). Because light never retraces a path in the same direction, each Reflector must terminate a distinct route.
6. **Core power vs. more pieces.** Core upgrades multiply everything (including Lamps) but cost more each level.
7. **Call early or rearrange.** Bonus gold for tempo versus time to re-route for the announced composition.
8. **Where the Lamp goes.** A second source can light segments the main chain cannot reach.

There is no single dominant line: absorption caps the value of one long chain, swarms punish concentration, Brutes punish splitting, and the road geometry forces trade-offs about which segments are reachable from which side.

## 14. Progression

Within one session, the player sees all of these:

- **Toolset unlocks:** Splitter after wave 1, Reflector after wave 3, Lamp after wave 6. Each unlock animates in the palette with a chime and a one-line hint.
- **Core levels 1→6:** the beam visibly thickens and brightens with each level. Lamps strengthen with it.
- **The light network grows across the board.** The HUD's "LIT n/31" rises. By the late game, most of the road glows.
- **Enemy roster grows:** motes → runners → brutes → swarms → Brute-King → Umbra.
- **Score and best score.**
- **Endless** after victory for players who want more.

## 15. Difficulty / Escalation

- Non-boss enemy HP is multiplied by `hpMult(wave) = 1 + 0.15 × (wave − 1)`.
- Wave density rises (more enemies, smaller gaps), and compositions are designed to change the best beam direction between waves.
- Bosses have fixed HP (no multiplier) tuned to their wave.
- Endless (wave ≥ 13): enemy count `8 + wave`, rotating pattern (mote-heavy, runner-heavy, swarm-heavy, brute-heavy), a Brute-King every 5th wave, `hpMult` continues, and speed multiplier `1 + 0.02 × (wave − 12)` capped at 1.5.

Tuning targets for Phase 10 (playtest-driven; numbers are initial):
- A player who never places anything loses by wave 3.
- A first-time player who follows the hints reaches wave 6–9 on run one.
- A player who understands absorption and direction wins run two or three with 6–14 core HP left.
- No single piece purchased repeatedly (e.g. only mirrors, only core upgrades) wins alone.

## 16. Economy

- Start gold: 40 (two mirrors).
- Income: kill gold per enemy type; wave-clear bonus `12 + 3 × wave`; early-call bonus `ceil(remaining × 1.5)`.
- Spend: pieces, core upgrades. Sell refunds 70% (100% inside the undo window).
- Rough budget over 12 waves: ~1,150–1,350 gold earned; buying Core to level 6 costs 830; 6 mirrors 120; 2 splitters 90; 2 reflectors 120; 1 lamp 90. A winning player cannot afford everything; choices remain real.

## 17. Entities / Units / Resources

**Resources:** Gold (currency), Core HP (life, max 20), Light (not a stored resource; it is the beam's power, produced continuously).

**Pieces:** Mirror, Splitter, Reflector, Lamp (see 12.4). **Core** (source, upgradeable).

**Enemies:**

| Type | Role | Look |
|---|---|---|
| Mote | Baseline walker | Dark violet sphere, faint magenta core |
| Runner | Fast, low HP, low absorb | Small teal-edged cone pointing along travel |
| Swarmling | Packs of 8, tiny, low absorb | Tiny black tetrahedra with pink glints |
| Brute | Slow, tanky, absorbs 70% (shields those behind) | Large dark cube with a visible shell |
| Brute-King | Wave 10 mini-boss | Brute, 1.6× size, gold ring |
| Umbra | Wave 12 boss | Large dark octahedron, slow rotation, ring of shards |

## 18. Initial Balance Values

All numbers live in one `BALANCE` object in `src/00_config.js`. Opus may tune them during Phase 10 and must log every change in the build log.

```js
const BALANCE = {
  COLS: 8, ROWS: 12,
  CORE_HP: 20,
  START_GOLD: 40,
  CORE_POWER: [10, 13, 17, 22, 28, 35],          // index = level-1, 6 levels
  CORE_UPGRADE_COST: [60, 100, 150, 220, 300],   // cost to go from level i+1 to i+2
  LAMP_FACTOR: 0.5,
  SPLIT_FACTOR: 0.55,
  REFLECT_FACTOR: 0.6,
  MIN_POWER: 0.5,
  MAX_DEPTH: 48,             // max recursion depth per source
  MAX_SEGMENTS: 128,         // hard cap on emitted beam segments per solve (matches the render pool)
  PIECE_COST: { mirror: 20, splitter: 45, reflector: 60, lamp: 90 },
  LAMP_COST_STEP: 20,            // each additional lamp costs +20
  SELL_RATE: 0.7,
  UNDO_WINDOW: 3.0,
  MOVE_REFORM: 0.75,
  COUNTDOWN: 8, FIRST_COUNTDOWN: 10, GROUP_GAP: 1.5,
  EARLY_CALL_RATE: 1.5,
  WAVE_CLEAR_BASE: 12, WAVE_CLEAR_PER_WAVE: 3,
  HP_MULT_PER_WAVE: 0.15,
  UNLOCK_WAVE: { splitter: 2, reflector: 4, lamp: 7 },   // available from the start of this wave's countdown
  SPEED_OPTIONS: [1, 2],
  ENEMY: {
    mote:      { hp: 30,  speed: 1.0,  absorb: 0.25, gold: 4,   leak: 1,  radius: 0.28 },
    runner:    { hp: 16,  speed: 1.9,  absorb: 0.10, gold: 5,   leak: 1,  radius: 0.22 },
    swarmling: { hp: 8,   speed: 1.3,  absorb: 0.15, gold: 1,   leak: 1,  radius: 0.14 },
    brute:     { hp: 120, speed: 0.55, absorb: 0.70, gold: 16,  leak: 3,  radius: 0.36 },
    bruteking: { hp: 400, speed: 0.45, absorb: 0.80, gold: 50,  leak: 6,  radius: 0.42, boss: true },
    umbra:     { hp: 900, speed: 0.40, absorb: 0.85, gold: 100, leak: 10, radius: 0.46, boss: true },
  },
  WAVES: [
    /* 1 */ [ ['mote', 4, 1.5] ],
    /* 2 */ [ ['mote', 7, 1.2] ],
    /* 3 */ [ ['runner', 4, 0.8], ['mote', 5, 1.2] ],
    /* 4 */ [ ['mote', 10, 0.9], ['runner', 3, 0.7] ],
    /* 5 */ [ ['brute', 2, 2.0], ['mote', 6, 1.0] ],
    /* 6 */ [ ['swarmling', 8, 0.3], ['swarmling', 8, 0.3], ['runner', 4, 0.7] ],
    /* 7 */ [ ['brute', 3, 1.5], ['mote', 8, 0.8] ],
    /* 8 */ [ ['mote', 14, 0.6], ['runner', 6, 0.5] ],
    /* 9 */ [ ['swarmling', 8, 0.25], ['swarmling', 8, 0.25], ['swarmling', 8, 0.25], ['brute', 2, 1.5] ],
    /* 10 */[ ['bruteking', 1, 0], ['runner', 8, 0.6] ],
    /* 11 */[ ['brute', 4, 1.2], ['mote', 10, 0.6], ['swarmling', 8, 0.25], ['swarmling', 8, 0.25] ],
    /* 12 */[ ['mote', 6, 0.7], ['brute', 2, 1.5], ['umbra', 1, 0], ['brute', 2, 1.5] ],
  ],
  // Each wave entry: [type, count, gapSeconds]. Groups spawn in order with GROUP_GAP between them.
  ENDLESS: { BASE_COUNT: 8, SPEED_PER_WAVE: 0.02, SPEED_CAP: 1.5, KING_EVERY: 5 },
};
```

Sanity numbers (wave 1, Core level 1, power 10): a Mote at 1 cell/s crossing one lit cell takes 10 damage (of 30). The default beam lights one road cell → all four motes leak (−4 HP). One mirror at (7,6) lights five road cells → 50 damage → every mote dies. One mirror at (7,3) lights six → dies with margin. This is the intended first-wave shape.

Beam thickness for rendering: `width = 0.10 + 0.30 × clamp(power / 35, 0, 1)` world units; color = white at ≥ 70% of source power, amber at 35%, red-orange near `MIN_POWER`.

## 19. Controls

Touch is primary; mouse works identically through Pointer Events.

| Action | Input |
|---|---|
| Select piece type | Tap a palette button (stays selected; Mirror is selected at run start) |
| Place piece | Tap an empty tile (or drag a palette button onto a tile) |
| Select a placed piece | Tap it (action bar appears above it: FLIP · MOVE · SELL) |
| Flip / rotate | FLIP in the action bar (Mirror/Splitter toggle; Lamp rotates 90°) |
| Move | Drag the piece, or MOVE then tap a destination tile |
| Sell / Undo | SELL in the action bar; UNDO chip for 3 s after placing |
| Upgrade Core | CORE ⬆ button in the action row |
| Start next wave early | NEXT WAVE ▶ button in the action row (during countdown only) |
| Speed | 1×/2× toggle (top-right) |
| Pause | ⏸ (top-right) or automatic on tab hide; tap overlay to resume |
| Help | ? (top-right) opens the how-to-play overlay and pauses |
| Mute | 🔊 toggle (top-right) |
| Deselect | Tap empty non-board area or the same palette button |

Drag details: a drag starts when the pointer moves > 10 px from pointerdown on a palette button or a placed piece. The ghost is drawn 70 px above the finger so the target tile is visible; the target tile highlights green (valid) or red (invalid). Release on a valid tile places/moves; release elsewhere cancels (a placed piece snaps back). `pointercancel` cancels. Only the first active pointer is tracked; other touches are ignored.

Keyboard (development convenience only, harmless in the build): `1–4` select piece type, `F` flip selected, `Space` next wave, `P` pause, `M` mute.

## 20. Portrait Mobile UX

- Logical primary target 390 × 844; verify at 360 × 800, 393 × 852, 430 × 932, and a short 360 × 640.
- Layout (top → bottom): status bar (safe-area padding) → HUD row (56 px) → incoming strip (32 px) → board (fills remaining, cell = `min(width / 8, remainingHeight / 12)`, centered) → action row (56 px) → palette (96 px + safe-area bottom).
- All tap targets ≥ 48 × 48 px. Board cells are ≥ 44 px on every listed viewport except the short 360 × 640 fallback.
- The action bar for a selected piece renders above the piece (below it if the piece is in row 0 or 1) and never under the finger.
- No hover states. Everything works with tap, hold-drag, release.
- `viewport-fit=cover`, `user-scalable=no`, `touch-action: none` on the game root, `overscroll-behavior: none`, `-webkit-user-select: none`, `-webkit-tap-highlight-color: transparent`. Prevent double-tap zoom and pull-to-refresh.
- Safe areas: `padding-top: env(safe-area-inset-top)`, `padding-bottom: env(safe-area-inset-bottom)`.
- Landscape / desktop: the game root is a centered column with `width = min(innerWidth, round(innerHeight × 0.5))` on dark side bars. The layout is always the portrait layout; nothing rotates. A small caption "Best played in portrait" shows on the side bars when width > height. No blocking overlay.
- Resize / orientation change: recompute layout, renderer size, camera frustum; state is untouched.
- Text: system font stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`), minimum 14 px, HUD numbers 18–22 px, high contrast on dark.

## 21. UI / HUD

**Title screen:** "REFRACT" wordmark (CSS text with glow), tagline "Bend the light. Burn the shadows.", three control lines with tiny icons (mirror, tap, beam), best score, PLAY button (min 64 px tall). Also a one-line note: "Portrait · single player · works offline".

**HUD row:** ♥ `coreHp`/20 (flashes red on leak) · ◆ `gold` (bumps on gain) · WAVE `n`/12 (or "ENDLESS n") · LIT `lit`/31 (pulses green when it increases) · buttons ⏸ 2× ? 🔊.

**Incoming strip:** during countdown: "NEXT: " + enemy icons in spawn order (front first, boss icon larger) + "in 7s". During a wave: "WAVE 5 · 9 left". Shows unlock notices briefly ("SPLITTER UNLOCKED").

**Board overlay elements (DOM, positioned over the canvas):** hint toasts (bottom of board, auto-dismiss 4 s or on action), floaters ("+4", "−3", "Need 20"), action bar for a selected piece, UNDO chip, wave banners ("WAVE 3", "CLEARED +21").

**Action row:** CORE ⬆ Lv2 · 60◆ (dimmed when unaffordable; "MAX" at level 6) · NEXT WAVE ▶ +9◆ (visible only during countdown).

**Palette:** four buttons: MIRROR 20 · SPLITTER 45 · REFLECTOR 60 · LAMP 90. Locked buttons show a lock and "W2/W4/W7". Selected button has a bright outline. Unaffordable buttons are dimmed but still tappable (to read the tooltip line: "Need 45").

**Overlays:** Pause ("PAUSED — tap to resume"), Help (one screen: what each piece does, absorption rule, direction rule, with small diagrams made of Unicode/CSS), Victory, Defeat.

**Defeat tips (choose by cause):** most leaks by brutes → "Brutes absorb most of the light. Enemies behind a Brute are shielded. Hit them from the front, or split the beam."; most leaks by swarmlings → "Swarms drain a beam fast. Split the light or add a second source."; most leaks by runners → "Runners cross a lit cell in half a second. Light a whole road segment lengthwise."; otherwise → "Light along the road burns for the whole segment. Try LIT above 15."

## 22. Visual Direction

**Look:** "Dark temple diorama." Low-poly, high-contrast, emissive light against deep indigo. Everything is Three.js primitives with procedural materials; zero image files.

- Background: `#0b0f1e`. Board tiles: raised boxes `#1c2541` with a 1 px darker gap; road tiles `#0e1326` with faint amber chevrons (thin planes) pointing along travel; lit tiles get an additive soft glow quad.
- Core: white-gold octahedron on a small pedestal, pulsing emissive; beam origin flare.
- Beam: additive planes, thickness by power, color white → amber → red as power drops; a brighter thin core line; bounce sparks at mirrors; the beam "sweeps" forward at ~60 cells/s when re-routed instead of appearing instantly.
- Mirror: thin silver slab at 45° with a cyan edge glow. Splitter: translucent violet cube with an internal diagonal plane. Reflector: golden concave cup. Lamp: amber lantern with a visible facing notch.
- Enemies: see 17; dark bodies, small saturated glints so they read on the dark board; HP bar (two tiny planes) appears once damaged.
- Spawn portal: a dark disc with a slow-rotating ring at (1,0); enemies fade in from above it.
- Camera: orthographic, tilted ~25° from straight-down looking from the bottom of the screen, so pieces show height without occluding the cells above them. Frustum fitted exactly to the board rectangle. Pieces ≤ 0.6 units tall.
- Lighting: one hemisphere light + one directional light; emissive materials for glows. No shadows (mobile).
- Text is always DOM, never rendered in WebGL.

## 23. Game Feel

Every meaningful action has immediate feedback:

| Event | Feedback |
|---|---|
| Piece placed | Scale pop 0 → 1.15 → 1 (200 ms), placement chime, beam sweep animation, lit tiles glow up, LIT counter pulses |
| Flip | Piece snaps to new orientation with a 120 ms rotate, tick sound, beam sweep |
| Move | Piece lifts (y + 0.3) while dragged, ghost preview of the beam at the hovered tile, drop pop, translucent while re-forming |
| Sell / Undo | Piece shrinks out, gold floats back to the counter |
| Enemy in beam | Emissive flash on the body, sparks every 0.1 s, HP bar drains, sizzle (throttled) |
| Enemy death | Shard burst (6–10 particles), gold floater "+4" arcing to the gold counter, pop sound pitched by type, brute: small screen shake (4 px, 120 ms), boss: hit-stop 60 ms + larger shake |
| Leak | Core flashes red, HP number shakes, "−3" floater, low thud, brief red vignette |
| Wave start | Banner slides in, horn sound, portal flares |
| Wave cleared | Banner "CLEARED +21", arpeggio, gold floater |
| Unlock | Palette button bursts with light, chime, hint |
| Core upgrade | Core brightens, beam thickens visibly with a pulse traveling along it, rising sweep sound |
| Insufficient gold | Gold counter shakes, "Need 45" floater, soft buzz |
| Victory | Beams flare white, confetti of shards, fanfare |
| Defeat | Beam gutters out over 1 s, screen darkens, low tone |

Readability rule: effects never obscure the road or the HUD numbers. Particles are small and short-lived. Screen shake is capped and disabled during placement drags.

## 24. Audio Direction

All sound is synthesized with the Web Audio API at runtime. No audio files.

- AudioContext is created lazily on the first `pointerdown` and resumed on every user gesture if suspended (autoplay policy). The game must function with audio unavailable.
- Master gain 0.5; mute toggle persisted in `localStorage` (guarded).
- Beam hum: two detuned oscillators (55 Hz, 110 Hz) through a low-pass filter, gain proportional to total lit power (max 0.08), always subtle.
- SFX (short, cheap): place (sine 880 → 1320 Hz, 60 ms), flip (noise tick 20 ms), sweep (filtered noise 120 ms), sizzle (hi-pass noise 30 ms, ≤ 1 per 150 ms), death pop (sine 300 → 80 Hz, 100 ms; swarmling higher, brute lower + noise thud), gold chime (triangle 1760 Hz, 80 ms, ≤ 1 per 100 ms), leak thud (sine 90 → 40 Hz 200 ms + noise), wave horn (square 220 → 330 Hz, two notes), wave clear (3-note rising arpeggio), unlock sparkle (3 quick sines), upgrade sweep (400 → 1200 Hz, 200 ms), victory fanfare (5 notes), defeat (3 descending notes).
- Pitch variation: ±6% random per hit/death to avoid machine-gun repetition.
- Concurrency cap: at most 8 SFX voices at once; drop the quietest.

## 25. Technical Architecture

**Stack:** HTML + CSS + vanilla JavaScript (ES2020, classic scripts, no modules) + **Three.js r149** (`vendor/three.min.js`, the last classic-script build that logs no deprecation warning). No frameworks, no bundler, no TypeScript, no minification, no service worker, no `fetch`/XHR at all.

**Why classic scripts and not ES modules:** a classic `<script src="vendor/three.min.js">` plus inline scripts works over HTTP and even from `file://`; ES modules and import maps fail from `file://` and add nothing we need.

**Source layout during development:** the game code is split into ordered files under `src/` sharing one global namespace object `R` (for "Refract"). A zero-dependency Node script (`tools/build.js`) inlines `src/styles.css` and every `src/*.js` in order into `index.html` at the repository root, each wrapped in a clearly labelled `<script>` block with a banner comment. The output is exactly what is submitted: readable, unminified, all own code in one file, Three.js referenced relatively from `vendor/`.

**Staleness guard:** `tools/serve.js` (zero-dependency Node static server) rebuilds `index.html` on every request for `/` or `/index.html`, so browser tests always see current source. Phase 12+ tests the explicitly built release file.

**Release vs. dev build:** `node tools/build.js` builds with `src/99_debug.js` excluded (release). `node tools/build.js --dev` includes it. `serve.js` serves the dev build; the release build is produced for Phases 12–14.

**Main loop:**
- `requestAnimationFrame` render loop; simulation uses a fixed timestep of 1/60 s with an accumulator; frame delta clamped to 0.1 s; game speed 2× runs two fixed steps per real step. Simulation is frame-rate independent (test at 30, 60, 120 Hz).
- Order per fixed step: input queue → wave spawner → enemy movement → beam solve + damage → deaths/leaks → economy/unlocks → phase transitions → feedback events. Render reads state; it never mutates it.
- `visibilitychange` hidden → pause; the accumulator is reset on resume so no catch-up burst occurs.

**Rendering:** one `WebGLRenderer` (antialias on, `setPixelRatio(min(devicePixelRatio, 2))`), one `Scene`, one `OrthographicCamera`. Static board built once. Pieces, enemies, beam segments, lit-tile glows, HP bars and particles are pooled. HUD and overlays are DOM.

**Input:** Pointer Events on the game root. Canvas hits are converted to board cells by raycasting against the `y = 0` plane. DOM buttons handle their own `pointerup`/`click`. Only one active pointer.

**Persistence:** `localStorage` keys `refract.best` and `refract.muted`, every access in try/catch.

**RNG:** mulberry32 seeded per run (`Date.now()` unless `?seed=N`). Used for spawn jitter (none by default), particle variation and pitch variation. Gameplay itself is deterministic given inputs.

## 26. Game State Model

```js
R.state = {
  phase: 'title' | 'building' | 'wave' | 'paused' | 'won' | 'lost',
  pausedFrom: 'building' | 'wave' | null,
  endless: false,
  wave: 0,                 // 1-based current wave; 0 before the first wave
  countdown: 10,           // seconds left in building phase
  time: 0,                 // simulated seconds this run
  speed: 1,
  gold: 40, goldEarned: 0,
  coreHp: 20, coreLevel: 1,
  score: 0,
  grid: { cols: 8, rows: 12, kind: Uint8Array(96) },   // 0 EMPTY, 1 ROAD, 2 CORE, 3 SPAWN
  path: [ {c, r} ... ],    // 26 cells + virtual start handled by index -1
  pieces: new Map(),       // cellIndex -> { id, type, orient, dir, cost, placedAt, inactiveUntil }
  nextPieceId: 1,
  lampsBought: 0,
  enemies: [],             // { id, type, hp, maxHp, t, speed, absorb, gold, leak, alive, lastHitAt }
  spawnQueue: [],          // [{ type, at }] absolute spawn times for the current wave
  waveEnemiesTotal: 0,
  beam: { segments: [], lit: Float32Array(96), litRoadCount: 0, totalPower: 0 },
  leaksBy: { mote:0, runner:0, swarmling:0, brute:0, bruteking:0, umbra:0 },
  ui: { selectedType: 'mirror', selectedPieceId: null, drag: null, hintsShown: {}, undo: null },
  unlocked: { mirror: true, splitter: false, reflector: false, lamp: false },
  rngSeed: 0,
  events: [],              // feedback events emitted this step, consumed by render/audio
};
```

`R.resetState(seed)` returns a brand-new object; nothing is patched in place.

## 27. Major Systems

| System | File | Responsibility |
|---|---|---|
| Config | `src/00_config.js` | `BALANCE`, colors, layout constants, enemy/wave tables |
| Util | `src/01_util.js` | RNG, clamp/lerp/easing, timers, simple object pool |
| Audio | `src/02_audio.js` | Context lifecycle, synth SFX, hum, mute |
| State | `src/03_state.js` | `resetState`, grid/path construction, unlock rules, score |
| Grid | `src/04_grid.js` | Cell math, neighbours, road segments, world↔cell mapping |
| Beam | `src/05_beam.js` | Pure solver (12.5), smart orientation, coverage scoring |
| Enemies | `src/06_enemies.js` | Wave scripting, endless generator, spawning, movement, leaks, occupancy |
| Pieces | `src/07_pieces.js` | Place/flip/move/sell/undo, core upgrade, affordability |
| Render | `src/08_render.js` | Three.js scene, pools, beam meshes, particles, camera/layout |
| UI | `src/09_ui.js` | DOM HUD, palette, action bar, overlays, hints, floaters, banners |
| Input | `src/10_input.js` | Pointer handling, drag state machine, raycast, keyboard |
| Game | `src/11_game.js` | Boot, main loop, fixed step, phase transitions, win/lose, restart, visibility |
| Debug | `src/99_debug.js` | Dev-only panel and `window.__REFRACT` API (excluded from release) |

Each file attaches to `R` and must not depend on load order beyond "config and util first, game last". No file may reference DOM elements before `R.boot()` runs on `DOMContentLoaded`.

## 28. File Structure

```
/                         repository root
├── index.html            GENERATED by tools/build.js — the submission file (do not hand-edit)
├── vendor/
│   ├── three.min.js      Three.js r149 UMD build, unmodified (license header intact)
│   └── LICENSE-three.txt Three.js MIT license text
├── src/
│   ├── template.html     HTML skeleton with <!-- BUILD:CSS --> and <!-- BUILD:JS --> markers
│   ├── styles.css
│   ├── 00_config.js … 11_game.js, 99_debug.js   (see 27)
├── tools/
│   ├── build.js          inline css + js into index.html; --dev includes 99_debug.js
│   ├── serve.js          static server on http://localhost:8080 with build-on-request
│   ├── check.js          compliance checks (see 41)
│   ├── package.js        builds release, verifies, writes dist/refract.zip (Python zipfile or bsdtar)
│   └── test-beam.js      Node unit tests for the beam solver and reflection table
├── docs/
│   ├── design-intent.md  draft text for the .docx (≤ 500 words, 7 fixed sections)
│   └── playtest-notes.md human playtest findings (Phase 10/13)
├── dist/                 gitignored packaging output (refract.zip, buildlog.md, design-intent.docx)
├── MASTER_SPEC.md        this file
├── CLAUDE.md             standing instructions for the build agent
├── BUILD_LOG.md          the running build log (exported as dist/buildlog.md at packaging)
├── OPUS_START_PROMPT.txt startup prompt for the build session
└── .gitignore            node_modules/, dist/, .playwright/, *.log
```

The ZIP contains exactly: `index.html`, `vendor/three.min.js`, `vendor/LICENSE-three.txt`. Nothing else is needed at runtime.

## 29. Offline Architecture

- The only external file the page loads is `vendor/three.min.js` via `<script src="vendor/three.min.js">`.
- No fonts, images, audio, JSON or data files. Textures (glow discs, chevrons) are drawn onto `<canvas>` elements at startup and uploaded as `CanvasTexture`.
- No `fetch`, `XMLHttpRequest`, `WebSocket`, `import()`, `navigator.sendBeacon`, `<link rel="preconnect">`, analytics, or web fonts. `tools/check.js` greps the built `index.html` for `http://`, `https://`, `//cdn`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `import(` and fails on any hit outside comments; it also confirms the only `src=`/`href=` values are relative and exist.
- The game must behave identically online and offline (verified in Phase 12 with the network disabled).

## 30. Performance Constraints

- Target 60 fps on a mid-range phone at wave 11 (≈ 40 enemies alive, ≈ 20 beam segments, 200 particles). Minimum acceptable: 30 fps with no simulation slowdown (fixed step guarantees correctness).
- Budgets: ≤ 150 draw calls; ≤ 300 active meshes; particles as one `InstancedMesh` (≤ 400 instances); beam segments pooled (128, matching `MAX_SEGMENTS`); lit-tile glows pooled (≤ 96); HP bars pooled (≤ 80).
- No per-frame allocations in the hot path beyond the solver's small arrays (reuse where easy). No `new THREE.Vector3` in loops; use scratch vectors.
- DOM updates only when values change (cache last-rendered strings).
- `devicePixelRatio` capped at 2. Antialias on; drop to off if measured fps < 40 on load benchmark (optional, Phase 11).
- Startup to interactive < 1.5 s on a phone.

## 31. Edge Cases

| Case | Required behaviour |
|---|---|
| Rapid tapping the same tile | First tap places; further taps select the piece (no double purchase). Placement is idempotent per pointerup. |
| Tapping while a drag is in progress | Ignored; only the first pointer is tracked. |
| Drag leaves the viewport / `pointercancel` / `pointerleave` on window | Drag cancels; a dragged placed piece snaps back to its origin; no gold change. |
| Multi-touch | Second and later pointers ignored entirely until the first is released. |
| Insufficient gold | Button dimmed; tile tap gives "Need N" floater; no state change. |
| Placing on road/core/spawn/occupied tile | Red flash on the tile, soft buzz, no state change. |
| Flip/Sell/Move on a piece that no longer exists | Action bar hides; no error. |
| Selling the piece that is currently being dragged | Not possible; the action bar hides on drag start. |
| Selecting a piece then upgrading the core | Selection persists; beam recomputes. |
| Undo after the 3 s window | Chip has disappeared; SELL gives 70%. |
| Enemy dies and leaks in the same step | Death is checked first; a dead enemy cannot leak. |
| Several enemies die simultaneously | Each awards gold once; floaters stagger by 40 ms. |
| Wave ends while the last enemy is mid-death animation | Wave-clear triggers on simulation death, not on animation end. |
| Input during `won`/`lost` | Board input disabled; only overlay buttons respond. |
| Restart during active effects/particles/sounds | All pools reset, tweens cancelled, hum reset to 0, banners cleared. |
| Restarting many times in a row | No growth in mesh count, listeners, timers or memory (verify via `renderer.info` and heap snapshots). |
| Orientation change / resize | Layout recomputed; game continues; no state change; drag in progress cancels. |
| Tab hidden | Auto-pause; on return show PAUSED overlay; resume clears the accumulator. |
| Frame drop / long frame | dt clamped to 0.1 s; fixed step keeps simulation deterministic. |
| 120 Hz displays | Fixed step decouples simulation; verify enemies move at the same cells/s as at 60 Hz. |
| Audio blocked (no gesture yet) | Silent; retries resume on each gesture; no errors thrown. |
| `localStorage` unavailable (private mode) | Best score/mute fall back to memory; no errors. |
| WebGL unavailable | Full-screen message "This device cannot run WebGL." No crash. |
| Beam loops (mirrors in a square) | `visited` guard terminates on the first repeated (cell, direction); solver never exceeds `MAX_DEPTH` or `MAX_SEGMENTS`. |
| Two reflectors facing each other through a chain | Second return is blocked by the `visited` guard; exactly one forward and one return pass; no error, segment count under the pool size. |
| Lamp aimed at the Core or another Lamp | Beam absorbed; no error. |
| Piece dropped on its own origin tile | Treated as no move; stays active. |
| Runaway timers | No `setInterval`; all timing derives from the fixed step; hints use state time. |
| Duplicate RAF loops after restart | Single loop started once in `boot()`; restart only resets state. |
| Speed 2× during countdown | Countdown also runs at 2×. |

## 32. Debug Tools

Available only when the dev build is served and the URL contains `?debug=1`. All of it lives in `src/99_debug.js`, which the release build excludes entirely. The release `index.html` must not contain the string `__REFRACT` or the debug panel markup.

Panel (top-left, collapsible): FPS, simulated time, enemy count, beam segments, draw calls (`renderer.info.render.calls`), seed. Buttons: +100 gold, skip wave, kill all, spawn [type], force win, force lose, speed ×1/×2/×4, toggle hitboxes (enemy radii as rings), toggle solver overlay (power numbers on lit cells), reset with seed.

Programmatic API for browser automation: `window.__REFRACT = { state, place(type,c,r,orient?), flip(c,r), sell(c,r), upgradeCore(), nextWave(), setGold(n), setSpeed(n), forceWin(), forceLose(), restart(seed), step(seconds), snapshot() }`. `snapshot()` returns a plain JSON object of the important state for assertions. `step(seconds)` advances the simulation synchronously without rendering (used for fast automated playthroughs).

## 33. Implementation Phases

General rules for every phase:
- A phase is DONE only when: implemented → launches → tested in the browser at a portrait viewport → visually inspected (screenshot) → console checked (zero errors, zero warnings from our code) → behaviour matches this spec → bugs found are fixed → retested → BUILD_LOG.md updated.
- The game must remain runnable at the end of every phase.
- Do not implement items listed under DO NOT IMPLEMENT YET; they belong to later phases.
- Commit at the end of each phase (see CLAUDE.md for git rules).

### Phase 0 — Compliant project foundation

OBJECTIVE: A blank, compliant, portrait Three.js scene that builds into a single `index.html`, serves locally, and passes the compliance checker.

IMPLEMENT: `.gitignore`; `vendor/three.min.js` (r149, downloaded once, plus license file); `src/template.html` with viewport meta (`width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no`), the game root layout (HUD row, incoming strip, board container, action row, palette) as empty shells; `src/styles.css` with the portrait column layout and safe areas; `00_config.js`, `01_util.js`, `03_state.js` (grid + path built from the fixed map), `04_grid.js`, `08_render.js` (renderer, camera, board tiles and road tiles rendered, core placeholder, resize handling), `11_game.js` (boot, RAF loop, fixed step skeleton, visibility pause); `tools/build.js`, `tools/serve.js`, `tools/check.js`, `tools/test-beam.js` (empty harness).

DO NOT IMPLEMENT YET: beam, pieces, enemies, HUD content, audio, effects.

BROWSER TEST: serve on localhost; open at 390 × 844 with touch emulation; screenshot; confirm the board fills the intended region with 8 × 12 tiles, the road is visually distinct, no scrollbars, no horizontal overflow; resize to 360 × 800 and 430 × 932 and a desktop 1280 × 800 window (portrait column centered); console clean; Network tab shows only `index.html` and `vendor/three.min.js`.

ACCEPTANCE: `node tools/check.js` passes on the built `index.html`; three viewports screenshot correctly; console clean.

DEFINITION OF DONE: all of the above plus a BUILD_LOG entry.

### Phase 1 — Smallest playable mechanic: bend the beam

OBJECTIVE: The Core beam renders, and tapping a tile places a Mirror that bends it, with flip.

IMPLEMENT: `05_beam.js` solver (full 12.5 including splitter/reflector/lamp branches, even though only mirrors are placeable yet) with unit tests in `tools/test-beam.js` (reflection table for all 8 cases; straight beam exits; mirror at (7,3) yields 7 lit road cells including the corner (7,10); loop of 4 mirrors terminates; splitter produces two branches with 0.55; reflector reverses with 0.6 and the return pass reaches the core; two facing reflectors produce exactly one return; `MAX_SEGMENTS` cap holds; enemy absorption ordering test with a fake occupancy). `07_pieces.js` place/flip for Mirror with gold cost (gold shown in a temporary HUD number). Beam rendering (pooled segments, thickness/colour by power, lit-tile glow). `10_input.js` tap → cell; tap empty tile places; tap mirror flips (temporary; the action bar comes in Phase 4). Smart orientation. LIT counter in HUD. `99_debug.js` first version: `window.__REFRACT` with `state`, `setGold`, `place`, `flip`, `snapshot` (grows in later phases; dev build only).

DO NOT IMPLEMENT YET: enemies, waves, other pieces in the palette, selling, overlays, audio, particles.

BROWSER TEST: load; verify the default beam goes up column 7 and lights (7,10) (LIT 1/31); tap (7,4) → LIT 7/31 (6 along row 4 + the corner cell (7,10)); tap the mirror → select → FLIP → beam goes east off-board → LIT 1/31; tap (7,6) with a fresh board → LIT 7/31; call `__REFRACT.setGold(200)` and build the 3-mirror chain (7,8) `\`, (0,8) `\`, (0,6) `/` → LIT 13/31 (1 corner + 6 on row 8 + 6 on row 6); try placing on a road tile → rejected; rapid double-tap on one tile → one mirror; check gold decreases by 20 each; with 15 gold left a tap does nothing but show "Need 20"; resize mid-state; console clean.

ACCEPTANCE: unit tests pass; the browser scenarios above match exactly.

DEFINITION OF DONE: as general rules.

### Phase 2 — Complete core loop

OBJECTIVE: Enemies walk, burn, die or leak; gold and core HP work; waves 1–3 play end to end.

IMPLEMENT: `06_enemies.js` (path following, occupancy map, spawn queue from `WAVES`, wave 1–3 only for now but data-driven), damage from the solver with absorption ordering, deaths (gold) and leaks (core HP), wave end → countdown → next wave, HUD row with real values, incoming strip (composition + countdown), minimal floaters ("+4", "−1"). Enemy meshes for Mote and Runner pooled with HP bars.

DO NOT IMPLEMENT YET: win/lose overlays, title screen, other piece types, upgrades, audio, particles.

BROWSER TEST: play waves 1–3 for real using taps; with no mirrors all 4 wave-1 motes leak (core 16/20); restart page, place (7,6) mirror before wave 1 → all motes die, gold rises by 16 + wave bonus; watch the beam visibly dim after passing each enemy; verify a runner crossing one lit cell survives and one lit along a 6-cell segment dies; verify wave counter and countdown; 2× speed via debug API; console clean; frame rate stable.

ACCEPTANCE: waves 1–3 play through with correct gold/HP arithmetic (log the numbers); absorption order visibly correct (front enemy in an against-flow beam takes full power).

DEFINITION OF DONE: as general rules.

### Phase 3 — Win / lose / restart

OBJECTIVE: Full run structure with states, title screen, victory/defeat overlays, and a flawless restart.

IMPLEMENT: phases (`title`, `building`, `wave`, `paused`, `won`, `lost`); title screen with PLAY; pause button + overlay + visibility auto-pause; victory overlay (PLAY AGAIN now; the CONTINUE button is added in Phase 5, not shown before), defeat overlay with TRY AGAIN and the contextual tip; full `resetState` and pool resets; score and best score (guarded `localStorage`); all 12 waves wired from data (enemy types beyond mote/runner may use the mote mesh temporarily, but must function).

DO NOT IMPLEMENT YET: splitter/reflector/lamp UI, core upgrade, audio, particles, hints.

BROWSER TEST: force loss via leaks → defeat overlay → TRY AGAIN → verify state is pristine (gold 40, HP 20, wave 0, no pieces, LIT 1/31, no leftover enemies or beam segments; `renderer.info` mesh counts equal to a fresh load); use debug `forceWin()` → victory → PLAY AGAIN → pristine; do five consecutive restarts and compare snapshots; pause/resume during a wave (enemies freeze); hide the tab and return (paused); console clean.

ACCEPTANCE: restart leaves no residue (snapshot equality, pool counts); both overlays reachable through real play (loss) and debug (win).

DEFINITION OF DONE: as general rules.

### Phase 4 — Progression / economy: pieces and upgrades

OBJECTIVE: The full toolset and economy.

IMPLEMENT: palette with four piece buttons, lock states and unlock schedule; Splitter, Reflector, Lamp placement (Lamp facing + rotate); piece selection with action bar (FLIP, MOVE, SELL); drag-to-move and MOVE-then-tap; re-form delay; SELL at 70%; UNDO chip (100% within 3 s); Core upgrade button and levels; Lamp cost step; affordability feedback ("Need N"); unlock notices.

DO NOT IMPLEMENT YET: audio, particles, hints tutorial, endless.

BROWSER TEST: buy each piece and verify behaviours: splitter shows two beams at reduced thickness; reflector returns the beam through the chain to the core (verify two facing reflectors give exactly one return pass and the solver terminates; segment count ≤ 128); lamp emits with 0.5 × core power and rotates; core upgrade thickens the beam and increases lamp power; sell/undo refunds exact amounts; move a piece during a wave and confirm 0.75 s inactivity; drag a piece off the board → snaps back; drag outside the window → cancels; multi-touch second finger ignored; locked buttons cannot place; unlocks appear at the right waves (use debug skip wave); console clean.

ACCEPTANCE: every control in section 19 works by touch emulation; gold arithmetic exact.

DEFINITION OF DONE: as general rules.

### Phase 5 — Escalation

OBJECTIVE: The full 12-wave script with all enemy types, bosses, HP scaling, and Endless.

IMPLEMENT: Swarmling, Brute, Brute-King, Umbra meshes and stats; `hpMult`; group gaps; boss presentation (larger, ring); wave 12 victory → CONTINUE (ENDLESS) enabled; endless generator; incoming strip icons for all types; leak attribution for defeat tips.

DO NOT IMPLEMENT YET: audio, particles, tutorial hints.

BROWSER TEST: play waves 1–12 with debug gold to verify every wave spawns the scripted composition in order with correct gaps; verify a Brute leading motes in an against-flow beam shields them (motes reach further) while a with-flow beam burns the motes first; verify swarms drain a beam (segment shortens visibly); play wave 12 to a real victory with a strong build; continue into Endless and play 3 more waves; verify `hpMult` numbers via snapshot; console clean; fps at wave 11 ≥ 50 on desktop unthrottled and ≥ 30 with 4× CPU throttling.

ACCEPTANCE: all waves function; victory reachable; endless runs.

DEFINITION OF DONE: as general rules.

### Phase 6 — Strategic depth and teaching

OBJECTIVE: The player can see the decisions and learn the rules without reading anything long.

IMPLEMENT: hint toasts (section 12.8 flow: first placement, flip, along-road, first brute, each unlock) shown once per run; Help overlay; defeat tips by cause; NEXT WAVE early-call button with bonus; incoming-strip ordering (front first); LIT pulse; the beam sweep animation on re-route; ghost beam preview while dragging.

DO NOT IMPLEMENT YET: audio, particles (beyond the sweep), performance work.

BROWSER TEST: fresh run without debug: confirm hint sequence timing and that hints never overlap the action bar; early call pays `ceil(remaining × 1.5)`; help overlay pauses and resumes; defeat tip matches the dominant leak type in a forced scenario; drag ghost preview shows the beam that will result; console clean.

ACCEPTANCE: a tester who reads only hints can explain the along/across and absorption rules after one run (verify in Phase 13 human playtest as well).

DEFINITION OF DONE: as general rules.

### Phase 7 — Mobile UX

OBJECTIVE: Flawless portrait touch experience at all target viewports.

IMPLEMENT: final layout math for 360 × 800, 390 × 844, 393 × 852, 430 × 932, 360 × 640 and desktop; safe-area padding; landscape column with side caption; touch-target audit (≥ 48 px); action bar placement rule (above/below); drag ghost offset 70 px; palette press states; prevent zoom/scroll/select; HUD text sizes; overlays scroll-safe on short screens.

DO NOT IMPLEMENT YET: audio, particles.

BROWSER TEST: screenshot every viewport in title, mid-wave with action bar open, victory, defeat, help; verify no clipping/overlap, no element under the thumb during placement, no page scroll or zoom on double-tap, `touch-action` effective; rotate emulation to landscape and back; run at iPhone safe-area emulation (`viewport-fit=cover`) and confirm HUD clears the notch; console clean.

ACCEPTANCE: all screenshots reviewed and clean; a full run completed purely with tap/drag at 360 × 800.

DEFINITION OF DONE: as general rules.

### Phase 8 — Game feel

OBJECTIVE: Every action in section 23 has its feedback.

IMPLEMENT: particle system (`InstancedMesh`), shard bursts, sparks, gold floaters arcing to the counter, leak vignette and shake, hit-stop for boss death, placement pops, flip rotations, core upgrade pulse, wave banners, victory/defeat transitions, lit-tile glow pulses, LIT and gold counter animations.

DO NOT IMPLEMENT YET: audio.

BROWSER TEST: trigger each row of the table in 23 and screenshot mid-effect; verify effects never cover the HUD numbers; verify shake is disabled during drags; run wave 11 and confirm particles stay under 400 and fps holds; restart mid-effect leaves no residue; console clean.

ACCEPTANCE: table 23 fully covered; performance budget respected.

DEFINITION OF DONE: as general rules.

### Phase 9 — Audio

OBJECTIVE: Synthesized sound that makes the beam feel physical, safely under autoplay rules.

IMPLEMENT: `02_audio.js` per section 24; mute toggle with persistence; hum tied to lit power; throttles and voice cap; pitch variation.

DO NOT IMPLEMENT YET: nothing new beyond audio.

BROWSER TEST: load with autoplay blocked (no gesture) → no errors; first tap starts audio; every SFX audible via a debug "play all" list; mute persists across reload; hum silent at LIT 1 and audible at LIT 15; no clicks/pops on rapid deaths (voice cap); console clean; verify nothing loads from the network.

ACCEPTANCE: audio works after a gesture, fails silently without one, and never throws.

DEFINITION OF DONE: as general rules.

### Phase 10 — Balancing

OBJECTIVE: Meet the tuning targets in section 15 through actual play.

IMPLEMENT: only `BALANCE` changes (and data fixes), plus a scripted "bot" playthrough in `tools/` or via `__REFRACT.step` that plays three canned strategies (mirrors-only, core-only, balanced) and reports the wave reached.

DO NOT IMPLEMENT YET: new features.

BROWSER TEST: play at least six full runs by hand through the browser (two naive, two informed, two speed-run at 2×); record wave reached, core HP, gold at each wave, and time; run the bot strategies; adjust values; repeat until targets hold; check for exploits (reflector return pass too strong? lamp spam? sell/undo abuse? early-call snowball? core-only build carrying too far?).

ACCEPTANCE: targets in 15 hold across runs; every change logged with before/after values and reasons.

DEFINITION OF DONE: as general rules.

### Phase 11 — Performance

OBJECTIVE: Smooth on phones at peak.

IMPLEMENT: pooling audit, allocation audit, draw-call reduction (merged static board geometry, shared materials), DPR cap, DOM update caching, optional antialias fallback.

BROWSER TEST: Performance panel recording at wave 11 with 4× CPU throttling: no long frames > 50 ms from our code; `renderer.info` draw calls ≤ 150; heap stable across five restarts; 30/60/120 Hz simulation parity (enemy reaches core at the same simulated time).

ACCEPTANCE: budgets in section 30 hold.

DEFINITION OF DONE: as general rules.

### Phase 12 — Offline / compliance

OBJECTIVE: The release build is provably self-contained and compliant.

IMPLEMENT: release build (`node tools/build.js`), `tools/check.js` final rules (no external URLs, no debug strings, single script chain, relative `vendor/` reference, file size), `tools/package.js` (zip with forward-slash entries, `index.html` at root).

BROWSER TEST: unzip `dist/refract.zip` into a clean temp folder; serve that folder; open in a fresh incognito context with network fully disabled (DevTools offline or a Playwright route that aborts all non-localhost requests); play a full session to a result; Network tab shows exactly two requests; open `index.html` in a text editor and confirm readable code; also open via `file://` once to confirm it still runs.

ACCEPTANCE: `check.js` passes; offline session completes; zip listing correct; size well under 35 MB.

DEFINITION OF DONE: as general rules.

### Phase 13 — Browser QA

OBJECTIVE: Execute the full Acceptance Tests (section 35) and the autonomous playtest questions, and fix everything found.

IMPLEMENT: fixes only.

BROWSER TEST: the entire section 34 checklist on the release build, at 390 × 844 and 360 × 800, plus desktop; three consecutive full runs (loss, win, endless); the human playtest (section 36) if a tester is available, otherwise the autonomous playtest questions answered honestly in the build log.

ACCEPTANCE: every box in section 35 checked with evidence (screenshot names, console output).

DEFINITION OF DONE: as general rules.

### Phase 14 — Final packaging

OBJECTIVE: Submission artifacts ready.

IMPLEMENT: final `dist/refract.zip`; `dist/buildlog.md` (copy of BUILD_LOG.md, names scrubbed); `docs/design-intent.md` finalized (≤ 500 words, 7 sections in order) and, if `python-docx` is available, `dist/design-intent.docx` generated from it; a `SUBMISSION_NOTES.md` listing exactly what to upload, which genre to select, and any manual steps left for the human (e.g., pasting the design intent into the official template).

BROWSER TEST: one last clean-unzip offline run of the exact zip that will be uploaded.

ACCEPTANCE: section 44 checklist fully ticked.

DEFINITION OF DONE: the human can upload the three artifacts without touching code.

## 34. Browser Test Plan

Tooling: use whatever browser automation the session has (Chrome DevTools MCP, Playwright MCP, or a local Playwright script with `npm i -D playwright && npx playwright install chromium` kept outside the zip). Always test with a mobile emulation profile: viewport 390 × 844, `deviceScaleFactor 3`, `isMobile true`, `hasTouch true`. Use `page.tap` / touch-style pointer events for gameplay, not just `click`. Capture console messages and failed requests on every run.

Standard checklist (run in full at Phases 7, 12, 13; relevant subset in every phase):

1. Loads from `http://localhost:8080/` in under 1.5 s; no console errors/warnings from our code.
2. Title screen visible; PLAY works by tap.
3. First interaction: tap a lit tile → mirror appears, beam bends, LIT increases.
4. Complete core loop: waves 1–3 by hand.
5. Every palette button, the action bar, CORE ⬆, NEXT WAVE, ⏸, 2×, ?, 🔊.
6. Drag: palette → tile; piece → tile; piece → off-board; piece → outside window; `pointercancel`.
7. Upgrades: core levels 1→6 (debug gold) with visible thickening.
8. Progression: unlocks at waves 2/4/7; incoming strip correct.
9. Intentional loss: place nothing; verify defeat overlay + tip; TRY AGAIN.
10. Intentional victory: strong build + debug gold; verify victory overlay; PLAY AGAIN and CONTINUE.
11. Three consecutive full runs without reload; snapshot parity after each restart.
12. Rapid inputs: 20 taps/second on tiles and buttons; nothing breaks; no double purchases.
13. Invalid actions: road tiles, core, spawn, occupied tiles, unaffordable pieces, locked pieces.
14. Resize: 360 × 800 ↔ 430 × 932 ↔ desktop mid-wave; landscape column.
15. Portrait viewports: screenshots at all five sizes in five screens.
16. Console: zero errors; only allowed warnings (none expected with r149).
17. Network: exactly `index.html` + `vendor/three.min.js`; then fully offline run.
18. UI overlap/clipping audit on screenshots.
19. Visual hierarchy: beam, enemies, road, pieces distinguishable at a glance in a 390 px-wide screenshot viewed at 50% scale.
20. Performance: wave 11 fps with CPU throttling; particle and mesh counts.
21. Pause/visibility: hide tab mid-wave, return; enemies did not advance.
22. Audio: gesture gating; mute persistence.
23. `localStorage` disabled (Playwright context with storage blocked or overriding `localStorage` getter) → no errors.

Autonomous playtest questions (answer in BUILD_LOG after Phases 6, 10, 13):
- Is the goal obvious within 10 s? Is the first interaction clear?
- Is placing a mirror satisfying? Does the beam sweep feel good?
- Does the loop work without explanation? Is there meaningful decision-making each wave?
- Does progression visibly affect play (core upgrade, unlocks, LIT)?
- Does difficulty escalate legibly? Can the tester say why they lost?
- Any exploits? Any dominant strategy? Does restart work perfectly? Does the game encourage another run?

Browser observations override code reading. If the code looks right but the game behaves wrong, fix the behaviour.

## 35. Acceptance Tests

Final checklist (tick with evidence in BUILD_LOG):

- [ ] Game loads locally from a static server.
- [ ] Game works with internet disabled (clean unzip, incognito, offline).
- [ ] No runtime dependency on remote resources (code grep + network log).
- [ ] No unexpected external requests (network log shows exactly two local requests).
- [ ] Portrait layout works at 360 × 800, 390 × 844, 393 × 852, 430 × 932 (and degrades acceptably at 360 × 640).
- [ ] Touch interaction requires no hover; every control works via tap/drag only.
- [ ] Core loop starts within 15 s of PLAY (beam live at 0 s, wave 1 at 10 s or on early call).
- [ ] First meaningful action (placing a mirror) is understandable from the hint alone.
- [ ] Core loop fully playable: place → wave → gold → spend → next wave.
- [ ] Progression within one sitting: unlocks, core levels, LIT growth, enemy roster.
- [ ] Escalation noticeable: wave 8 is clearly harder than wave 3 in a fixed build.
- [ ] Strategic decisions matter: mirrors-only, core-only and balanced bots reach different waves; direction matters against a Brute-led wave.
- [ ] Loss state functions with a correct tip; victory state functions; endless continues.
- [ ] Restart fully resets the run (snapshot parity, pool counts, no residue).
- [ ] Multiple consecutive runs work (≥ 3 without reload).
- [ ] No console errors during normal gameplay; no warnings from our code.
- [ ] No unfinished UI (every button does something; no placeholder text).
- [ ] No placeholder mechanics (every piece and enemy type behaves per spec).
- [ ] Performance acceptable at peak (≥ 30 fps under 4× CPU throttling; 60 fps normal desktop).
- [ ] Competition genre is obvious from a single screenshot of mid-wave play.
- [ ] Submission packaging meets official requirements (single zip ≤ 35 MB).
- [ ] `index.html` is at the zip root, not inside a folder.
- [ ] First-party code readable and unminified in `index.html`; banner comments per source file.
- [ ] Third-party library only in `vendor/`, referenced relatively; not embedded in `index.html`.
- [ ] Final zip well under 35 MB (expected < 1 MB).
- [ ] Release build contains no debug panel, no `__REFRACT`, no `?debug` handling.
- [ ] No comments or strings addressed to reviewers or AI systems anywhere in the build.
- [ ] No personal names, handles or emails anywhere in the build, build log, or design intent.
- [ ] Simulation identical at 30/60/120 Hz (enemy arrival times match).
- [ ] Works when `localStorage` is blocked and when audio cannot start.

## 36. Human Playtest Plan

Tester receives the phone with the title screen showing and no explanation. Observe silently. Record:

1. Time to first meaningful action (a placed mirror). Target < 15 s.
2. Did they say or show they understood the goal (protect the core / burn enemies) within wave 1?
3. Where they hesitated (which screen, which control).
4. Whether feedback was understood: "Why did that enemy survive?" asked after wave 5. Expect an answer mentioning shielding/absorption or direction.
5. Whether the loss reason was understood (ask "why did you lose?"); compare with the defeat tip.
6. Whether upgrades/choices felt meaningful (ask which purchase mattered most).
7. Whether progression was noticed (ask what changed between early and late waves).
8. Whether they voluntarily replayed after the result screen (do not prompt).
9. The mechanic they remember most (ask afterwards, open question).

Triggers:
- First action > 25 s or goal not understood by wave 2 → rework hints/title copy (tuning) or the first-mirror affordance (redesign of the prompt, not the mechanic).
- Hesitation on flipping/moving → enlarge action bar, add a one-time flip hint earlier.
- Absorption not understood by wave 6 → strengthen beam-dimming visuals and the brute hint; consider showing power numbers on lit cells while a piece is selected.
- Loss reason not understood → improve leak attribution and tips.
- No voluntary replay from two testers → revisit score visibility, victory/defeat copy, and whether wave 12 arrives too late (consider 10 waves).
- One purchase named by every tester as the only thing that mattered → rebalance that item (cost or effect) in Phase 10 terms.

Never change the core concept based on one tester. Log every session in `docs/playtest-notes.md` without names.

## 37. Judging Strategy

- **Engagement (30%)**: the beam is live at second zero; every wave changes the best answer; visible growth (LIT, thickness, unlocks); 2× speed; endless; score to beat. Judges should feel "one more wave" and "let me try the reflector route".
- **Playability (25%)**: deterministic grid logic, exhaustive edge-case handling, restart parity tests, fixed timestep, offline verified, touch-only controls, large targets. Zero console noise.
- **Core Loop (20%)**: place → wave → gold → spend, with real-time feedback and a clear number to push (LIT n/31, Core HP). Explained in the design intent's core loop section in two sentences.
- **Focus (15%)**: one map, four pieces, five enemy types plus a boss, twelve waves, no meta-progression, no menus beyond title/help/results. Nothing half-built: every stretch item is either complete or absent.
- **Originality (10%)**: no towers; one beam; direction and order mechanics; the Reflector's reverse pass.
- **AI ranking phase**: clean, readable single file with section banners and a plain technical header comment; no evaluative comments; obvious genre keywords in code (`wave`, `enemy`, `defense`, `core`), the game reachable within one tap.

## 38. Special Award Strategy

- **Most Innovative**: the pitch is one sentence ("a tower defense with no towers: bend one beam"). Reinforce in the design intent's "signature twist" section: beam direction vs. enemy order, and the Reflector's reverse pass.
- **Most Fun to Play**: the toy factor of bending light with an instant sweep and sizzle; snappy 2×; short waves; satisfying kill feedback; no downtime.
- **Most Satisfying Progression**: the light network spreading across the board, the beam physically thickening with each core level, unlocks at waves 2/4/7, LIT counter climbing, enemy roster escalating, endless after victory.

## 39. Explicit Non-Goals

Not in this prototype: multiple maps (except as a stretch), meta-progression between runs, difficulty settings, achievements, leaderboards beyond best score, narrative/lore beyond one line, tower-style shooting units, enemy attacks on pieces, hero units, physics, weather, day/night, character animation, a level editor, localization, analytics, accounts, backend, ES modules, frameworks, image or audio assets, fonts, minification, service workers.

## 40. Stretch Goals

Only after Phase 13 passes completely, in this order, and each must be finished or removed:

1. Second map "Descent" (a different fixed road), selectable on the title screen. Requires the same test matrix on the new map.
2. Daily seed label (cosmetic; the run is deterministic anyway).
3. "Beam path numbers" toggle showing power on lit cells while a piece is selected.

## 41. Submission Packaging

Steps (automated by `tools/package.js`, verified by hand):

1. `node tools/build.js` (release; excludes `99_debug.js`).
2. `node tools/check.js` must pass: `index.html` exists at root; contains `<script src="vendor/three.min.js">` and no other `src=`/`href=` to non-relative paths; no `http://`/`https://` outside comments; no `fetch(`, `XMLHttpRequest`, `WebSocket`, `import(`, `serviceWorker`; no `__REFRACT`, `debug=1`; no `.min.js` content inlined; line count sanity (no single line > 1,000 characters); `vendor/three.min.js` present and unchanged (size/hash logged).
3. Create `dist/refract.zip` containing `index.html`, `vendor/three.min.js`, `vendor/LICENSE-three.txt` with forward-slash entry names. On Windows do not use PowerShell `Compress-Archive` (it can write backslash entry names that break relative paths on other systems); use Python's `zipfile` module or `tar -a -c -f`. Verify with `python -m zipfile -l dist/refract.zip`.
4. Unzip into a fresh temp folder; serve; incognito; offline; full session; text-editor check of `index.html`.
5. Copy `BUILD_LOG.md` → `dist/buildlog.md` after scrubbing any names.
6. Finalize `docs/design-intent.md`; produce `dist/design-intent.docx` if `python-docx` is installed (`pip install python-docx`); otherwise `SUBMISSION_NOTES.md` tells the human to paste the seven sections into the official template and export .docx.
7. Record the zip size and file listing in the build log.

Upload: the zip, the .docx, and `buildlog.md`. Select genre **Tower Defense & Strategy**. Upload early and resubmit if improved before the deadline.

## 42. Build Log Procedure

`BUILD_LOG.md` follows the official guidance exactly: Part 1 "Decisions locked so far" at the top (kept current; when a decision changes, edit it there and note the change in that session's entry), Part 2 one entry per work session. Write entries during the session, not at the end. Be honest, including what did not work. No personal names, handles or emails.

Per-session template (append; never edit history):

```
## Session N — <date> — <short title>

### Goal
### Direction (what the AI was asked to do)
### Tools (which AI tools/models were used)
### Work Completed
### Browser Testing (what was actually run, viewports, screenshots taken)
### Problems Found
### Fixes
### Decisions Locked (and any changes to Part 1)
### Balance Changes (before → after, reason)
### Result (current working state)
### Next Step
```

At packaging, the file is copied to `dist/buildlog.md`.

## 43. Design Intent Notes

Fixed sections, in this order, total ≤ 500 words, text only, no identifying information. Draft content (to be finalized after the build reflects reality):

1. **Game title and genre** — "REFRACT — Tower Defense & Strategy."
2. **Target player and pitch** — Players who like short, tactical mobile sessions and light puzzle games; they want a five-to-eight-minute run where each wave is a small spatial problem and a plan that visibly works. REFRACT is a tower defense with no towers: one beam of light from the crystal you defend, bent with mirrors so it burns the shadows walking the road.
3. **How to play (controls)** — Tap PLAY. Tap a lit tile to place a mirror; the beam bends instantly. Tap a placed piece to flip, move or sell it; drag to move. Buttons at the bottom choose Mirror, Splitter, Reflector, Lamp. CORE upgrades the beam. NEXT WAVE starts early for bonus gold. 2× speed, pause and help at the top.
4. **Core loop** — Read the incoming wave, route the beam so it runs along road segments in the right direction, watch the wave burn, spend the gold, repeat. Feedback: the beam visibly dims past each enemy, LIT n/31 shows road coverage, core HP shows leaks. Win by clearing 12 waves; lose when the core's HP is gone; Endless after victory. It is fun to repeat because every wave's composition changes which route is best.
5. **What is in this prototype** — One map; four pieces; six-level core; six enemy types including two bosses; twelve scripted waves plus endless; hints and help; score with best score; synthesized audio; full offline single-file build. Not included: additional maps, meta-progression.
6. **Progression and signature twist** — Unlocks at waves 2, 4 and 7; core levels thicken the beam; the light network spreads across the board; enemies escalate from motes to brutes, swarms and Umbra. Signature twist to validate: absorption makes beam direction matter, so the same mirrors can be right or wrong depending on who leads the wave.
7. **Future-state vision** — A full game with hand-built maps that each teach a new optical piece (prisms, lenses, coloured light and colour-keyed enemies), daily seeded challenges, and a score chase, rebuilt natively on the creation tools.

## 44. Final Competition Compliance Checklist

- [ ] Single-player; no networking code.
- [ ] Fixed portrait layout; never reflows to landscape.
- [ ] `index.html` at zip root; all own code inside it; unminified and readable.
- [ ] Three.js only in `vendor/three.min.js`; referenced by relative path; license included.
- [ ] No external requests at runtime (verified offline).
- [ ] Core loop: repeatable action, real-time feedback, clear goal, win/lose/reset, progression within one session, repeatable.
- [ ] Genre elements (defenses placed, escalating threats, meaningful spend/upgrade) obvious.
- [ ] Nothing half-finished; no stubs; no placeholder text.
- [ ] Legible pieces and state at a glance.
- [ ] Zip ≤ 35 MB.
- [ ] Build log in Markdown as `buildlog.md`, two parts, honest, no names.
- [ ] Design intent .docx on the official template, ≤ 500 words, seven fixed sections, no identifying info.
- [ ] No embedded instructions or text aimed at evaluators or AI tools anywhere.
- [ ] All text in English.
- [ ] Genre selected at submission: Tower Defense & Strategy.
- [ ] Uploaded before September 8, 2026, 1:00 PM PDT.

## 45. Schedule Reality

Today is September 3, 2026. The deadline is September 8, 1:00 PM PDT. Order of priority if time runs short:

1. Phases 0–5 (a complete, winnable, losable game) — non-negotiable.
2. Phases 6, 7, 12, 13, 14 (teaching, mobile UX, compliance, QA, packaging) — non-negotiable.
3. Phases 8, 9 (feel, audio) — strongly expected; a reduced but complete subset is acceptable (every implemented effect must be finished).
4. Phase 10, 11 (balance, performance) — do the minimum that meets targets; log what was not done.
5. Stretch goals — only with everything above ticked.

Upload a working build early (after Phase 7 at the latest) and resubmit improved versions; the last upload before the deadline counts.
