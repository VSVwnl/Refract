# Build Log: REFRACT

Genre: Tower Defense & Strategy
Competition: Meta Horizon Creator Competition: Game Prototype
Format note: this file is exported as `buildlog.md` at packaging time. It must never contain personal names, handles or contact details.

This is a running record kept during the build. Part 1 lists the decisions currently locked and is edited in place when a decision changes (the change is also noted in that session's entry). Part 2 has one entry per work session, written during the session. Entries are never rewritten after the fact.

---

## Part 1 — Decisions locked so far

Design (locked in the design session before any code existed; see `MASTER_SPEC.md` for detail):

- Concept: a tower defense with no towers. One beam of light from the defended Lumen Core; the player bends, splits and bounces it with placed pieces so it runs along the enemy road.
- Genre floor: placeable defenses (Mirror, Splitter, Reflector, Lamp, upgradeable Core), escalating waves (12 scripted + endless), meaningful spend/upgrade decisions. All three present.
- Board: 8 × 12 grid, one fixed map ("Stairway"), spawn top-left, core bottom-right, core beam fires north up column 7 and only touches one road cell by default.
- Central rule: enemies in a lit cell take beam power × dt; each enemy absorbs a fraction of the beam, so beam direction relative to enemy order matters.
- Pieces: Mirror (90°), Splitter (pass + reflect at 55% each), Reflector (return at 60%), Lamp (second source at 50% of core power). Core levels 1–6.
- Controls: tap palette → tap tile to place; tap piece → flip/move/sell; drag to move; undo within 3 s; portrait, touch-first, one active pointer.
- Session: 12 waves, ~6–9 minutes; win/lose/reset; endless after victory; score with best score.
- Scope: one map, four pieces, six enemy types incl. two bosses, no meta-progression, no menus beyond title/help/results.
- Art: Three.js primitives only, procedural canvas textures, DOM HUD, no image/audio/font files. Legibility first.
- Audio: synthesized with Web Audio; gesture-gated; mute persisted.

Technical:

- Stack: HTML + CSS + vanilla JS classic scripts + Three.js r149 UMD in `vendor/three.min.js`. No modules, frameworks, bundlers, minification or network calls.
- Source in `src/` under one global `R`; `tools/build.js` inlines everything into a readable `index.html` at the repo root; `tools/serve.js` rebuilds on request; release build excludes `src/99_debug.js`.
- Fixed-timestep simulation (1/60 s), render reads state only, pooled entities, Pointer Events input.
- Packaging: zip with `index.html` at root + `vendor/`, created with Python `zipfile` (forward-slash entries), tested from a clean unzip, offline, in a private window.

Competition constraints (verified 2026-09-03 against the official pages):

- Single-player; fixed portrait; self-contained; ≤ 35 MB zip; `index.html` at zip root with all own code unminified; libraries in `vendor/`; no external requests.
- Artifacts: build zip, design-intent .docx (≤ 500 words, seven fixed sections, no identifying info), this build log as `buildlog.md`.
- Deadline: September 8, 2026, 1:00 PM PDT. Upload early; resubmission allowed.

---

## Part 2 — Session entries

The build work is recorded one entry per implementation phase, since each phase
is a self-contained chunk of work with its own testing pass.

### Session 0 — 2026-09-03 — Research, concept selection and specification (no game code)

**Goal:** Choose the game and write the specification the build sessions will follow.

**Direction:** Research the official competition pages, generate concepts across all three genres, select one, fully specify it, and write `MASTER_SPEC.md`, `CLAUDE.md`, `OPUS_START_PROMPT.txt` and this log. Explicitly: do not implement the game yet.

**Tools:** Claude Code with the Claude Fable 5.1 model (design session). Build sessions are planned with Claude Opus in Claude Code.

**Work completed:** Read the Devpost main page, official rules, FAQ, design guidance, timeline, updates, organizer forum answers, and the three official PDFs (build log guidance, design-intent template, "Building a Prototype with AI" case study). Verified packaging and judging requirements. Verified that Three.js r149 is the last classic-script build that loads without a deprecation warning. Generated and scored 30+ concepts internally; selected REFRACT. Wrote the four planning files.

**Browser testing:** None. No build exists yet.

**Problems found:** The official PDFs could not be read through the page fetcher; their text was extracted with a local PDF text tool instead. The forum question about browser-local save state had no organizer answer, so the design only uses local storage for a best score and a mute flag, both optional.

**Decisions locked:** Everything in Part 1.

**Result:** Repository contains only planning files. No gameplay code.

**Next step:** Phase 0 of `MASTER_SPEC.md` section 33 — compliant project foundation.


### Session 1 — 2026-09-03 — Phase 0: compliant project foundation

**Goal:** A blank, compliant, portrait Three.js scene that builds into a single `index.html`, serves locally, and passes the compliance checker.

**Direction:** Execute `MASTER_SPEC.md` section 33 Phase 0, then test in a browser at portrait mobile viewports before moving on.

**Tools:** Claude Code with the Claude Opus model. Browser testing with Playwright (Chromium, mobile emulation) driven by `tools/qa.js`, plus interactive inspection in a live Chrome tab.

**Spec audit before coding.** Read the whole specification and checked it for internal conflicts:

- Section 14 ("Splitter after wave 1, Reflector after wave 3, Lamp after wave 6") and the `UNLOCK_WAVE: { splitter: 2, reflector: 4, lamp: 7 }` table describe the same schedule from different ends. No conflict; the table is authoritative.
- Verified the reflection table in 12.4 against vector reflection in screen space (y down): `/` maps (dx,dy) to (-dy,-dx) and `\` maps (dx,dy) to (dy,dx). All eight documented cases are correct.
- Verified the Phase 1 expected LIT numbers by hand against the map: default beam 1, mirror at (7,3) 7, mirror at (7,6) 6, three-mirror chain 12. All consistent with the fixed map.
- Verified the map ASCII, the 25 road cells and the 26-entry path.
- One implementation refinement recorded here rather than silently: the beam solver will split a run into extra render segments wherever an enemy absorbs power, so the dimming past each enemy is visible. The segment record keeps the fields the spec lists; `MAX_SEGMENTS` still caps total output.

**Work completed:**

- `vendor/three.min.js` — Three.js r149 UMD, taken from the published `three@0.149.0` package, unmodified (608,081 bytes, sha256 `8a5f7249…`), plus `vendor/LICENSE-three.txt`. `tools/check.js` pins the hash.
- `tools/build.js` (inlines `src/styles.css` and every `src/*.js` in filename order into `index.html`, `--dev` adds `99_debug.js`), `tools/serve.js` (dev server on 8080, rebuilds on request), `tools/static.js` (serves an unpacked release), `tools/check.js` (compliance), `tools/test-beam.js` (Node unit tests), `tools/qa.js` + `tools/qa-scenarios.js` (Playwright driver: mobile emulation, touch input, console/network capture, screenshots).
- `src/template.html` (portrait column shell: HUD row, incoming strip, board, action row, palette, overlay root), `src/styles.css`.
- `src/00_config.js` (BALANCE exactly as specified, map, colours, view and layout constants), `src/01_util.js` (mulberry32, math, easing, pool, guarded storage), `src/03_state.js` (`resetState`, board and path construction, score), `src/04_grid.js` (cell maths, reflection table, world mapping), `src/08_render.js` (renderer, tilted orthographic camera, instanced board tiles, road ribbon, direction chevrons, spawn portal, Lumen Core, layout and raycasting), `src/11_game.js` (boot, fixed-step loop, visibility pause, runtime-drawn favicon).
- Camera framing: orthographic, tilted 25 degrees. The frustum is fitted to the board rectangle in the tilted view (height scaled by cos 25) while the canvas is sized to the same cell count, so board cells project as exact squares and only piece height is foreshortened. Margins are expressed in cells so the camera never clips a piece at the top edge.

**Browser testing:** `node tools/qa.js layout` at 390x844, 360x800, 393x852, 430x932, 360x640 (all `deviceScaleFactor` 3, `isMobile`, `hasTouch`), and 1280x800 desktop. Screenshots `shots/layout-<size>-board.png` reviewed. Measured: no horizontal or vertical overflow at any size; board inside the column; cell sizes 46.65 / 43.06 / 47.01 / 51.44 / 33.81 / 44.87 px; 8 draw calls; load 0.58–0.73 s. Desktop shows the 400 px portrait column centred with the "Best played in portrait" caption. Network: exactly `GET /` and `GET /vendor/three.min.js` — the runtime-drawn favicon removes the browser's `favicon.ico` request. Console: no messages from our code (headless Chromium emits GPU "ReadPixels" driver warnings during screenshots; `tools/qa.js` classifies those as browser noise and reports them separately).

**Problems found:**

1. `tools/check.js` required at least ten banner comments, which fails while the source tree is still growing.
2. The road ribbon and the direction chevrons read too dimly in the first screenshot.
3. The Lumen Core's floor glow was clipped by the right edge of the board frustum.
4. A page opened in a background Chrome tab reports `document.hidden` true and never runs `requestAnimationFrame`, so interactive inspection in a live tab cannot rely on real time passing.

**Fixes:**

1. The banner check now compares the banner count with the number of inlined `<script>` blocks.
2. Chevron colour `#ffa53a` to `#ffb45a` and opacity 0.30 to 0.36.
3. `VIEW.MARGIN_X` 0.12 to 0.18 and the core haze plane 2.2 to 1.9 units.
4. Test plan adjusted: Playwright (where the page is always visible) drives timing-dependent tests; the live Chrome tab is used for visual inspection and real touch, with the simulation advanced explicitly through the debug API when needed.

**Decisions locked:** No changes to Part 1. Added tooling decisions: `tools/qa.js` is the browser test driver and lives outside the zip; the Three.js hash is pinned in the compliance checker; the favicon is drawn to a canvas at runtime so the build makes no extra request.

**Balance changes:** none.

**Result:** `node tools/test-beam.js` passes 6 tests. `node tools/build.js && node tools/check.js` passes on the release build (48,632 bytes, 1,847 lines, longest line 137 characters). The game serves at `http://localhost:8080/` and draws the full board, road, chevrons, spawn portal and core in a fixed portrait column at every target viewport.

**Next step:** Phase 1 — the beam solver, mirror placement and flipping.


### Session 1 — 2026-09-03 — Phase 1: bend the beam

**Goal:** The core beam renders and a tap places a mirror that bends it, with flipping, gold cost and the LIT counter.

**Direction:** `MASTER_SPEC.md` section 33 Phase 1, including the full solver (splitter, reflector and lamp branches) and its unit tests, even though only mirrors are placeable.

**Tools:** Claude Code with the Claude Opus model; Node unit tests; Playwright mobile-emulation browser tests.

**Work completed:**

- `src/05_beam.js`: the solver from spec 12.5. Per-source `(cell, direction)` visit stamps in a reused `Int32Array`, depth cap 48, segment cap 128, mirror/splitter/reflector/lamp branches, core and lamp sources, per-cell lit power, road-cell counting and total power. Enemies in a cell are ordered along the beam's direction of travel before they absorb, which is what makes beam direction matter.
- Two refinements over the pseudo-code, both deliberate: (a) a run of beam is split into an extra render segment wherever an enemy drops its power, so the dimming past each enemy is visible; (b) segments carry world-space endpoints as well as cell coordinates, so the beam can start at a source's centre, step down at a cell boundary and stop exactly at a piece.
- `src/07_pieces.js`: cost (including the lamp step), unlock and placement checks, `place` with smart orientation, `flip`. All feedback goes through `state.events`.
- `src/08_render.js` dynamic layer: instanced pools for lit road tiles, beam glow, beam core line, bounce sparks and all four piece types (8 instanced meshes, so draw calls do not grow with piece count). Beam width and colour follow power (white to amber to red); the lit glow is drawn only on road cells.
- `src/09_ui.js`: HUD numbers with change caching, a pooled floating-text system over the board, and counter bump/shake animations.
- `src/10_input.js`: Pointer Events on the board, one active pointer, 10 px drag threshold, raycast to a cell; tap places or flips. Double-tap zoom, context menu and touch scrolling are suppressed.
- `src/99_debug.js`: `window.__REFRACT` with `state`, `place`, `flip`, `setGold`, `setSpeed`, `restart`, `step` and `snapshot`. `debug=1` installs the API only, `debug=2` also shows the on-screen panel, which keeps test screenshots clean.
- `tools/test-beam-solver.js`: 20 solver tests covering the reflection table, the documented LIT numbers, gold rules, invalid placements, a mirror ring, splitter branch power, the reflector return pass reaching the core, two facing reflectors producing exactly one return, lamp power and absorption, core levels, enemy ordering (across cells and inside one cell), beam death below minimum power, the render split at an absorber, the segment cap under a full board of splitters, and determinism.

**Browser testing:** `node tools/qa.js beam` at 390x844, 360x800 and 430x932 (mobile emulation, real touch taps). 22 checks each, all passing: default beam LIT 1/25 and HUD reading `LIT 1/25` and 40 gold; tap (7,3) gives LIT 7/25, costs 20 gold and picks orientation 1; tapping it again flips it and LIT falls to 1; fresh board plus (7,6) gives LIT 6/25; the three-mirror chain (7,3)/(0,3)/(0,10) gives LIT 12/25 with orientations [1,0,1] and 60 gold spent; road, core and spawn tiles refuse a piece; twenty rapid taps on one tile buy exactly one mirror; with 15 gold a tap changes nothing and floats "Need 20"; resizing to 430x932 mid-state keeps the beam and the pieces; 20 draw calls. Screenshots: `shots/beam-390x844-a-default.png` … `-g-resized.png`. Network: two requests. Console: no messages from our code.

**Problems found:**

1. `resetState` built a plain beam object without the pooled segment records, so the first solve threw.
2. `__REFRACT.restart()` left the phase at `title`, after which the board ignored taps; three checks failed until this was traced.
3. First render of the beam was badly blown out: a full-cell radial glow on every lit cell (including buildable tiles) plus a wide additive beam turned the board into a white tube, and bounce sparks were being drawn at every power step rather than at real bends.

**Fixes:**

1. `resetState` now calls `R.beam.makeResult()`.
2. `R.newRun` sets the phase to `building` (the title screen replaces this in Phase 3), so restart behaves identically to a fresh load.
3. Visual pass: lit glow restricted to road cells, drawn with a new soft-square texture at 1.06 cells so neighbours merge into a band, warm amber tinted by power; beam glow width multiplier 2.1 to 1.7 and its additive intensity 0.5 to 0.28; core line 0.55 to 0.5 width at 0.85 intensity; a `bendAtStart` flag on segments so bounce sparks appear only where light actually turns.

**Decisions locked:** No changes to Part 1. Added: the debug build has two levels (`debug=1` API only, `debug=2` API plus panel).

**Balance changes:** none.

**Result:** 26 Node tests pass. `node tools/build.js && node tools/check.js` passes on the release build (79.3 kB, 10 source files). The game is playable to the extent Phase 1 defines: the beam is live at load, taps bend it, LIT and gold respond, and the whole board reads clearly at phone size.

**Next step:** Phase 2 — enemies, waves 1 to 3, damage, gold and core HP.


### Session 1 — 2026-09-03 — Phase 2: the complete core loop

**Goal:** Enemies walk, burn, die or leak; gold and core HP work; waves 1 to 3 play end to end.

**Direction:** `MASTER_SPEC.md` section 33 Phase 2.

**Tools:** Claude Code with the Claude Opus model; Playwright mobile-emulation tests; a live Chrome tab for a visual confirmation with real pointer input.

**Work completed:**

- `src/06_enemies.js`: pooled enemy records, the HP and speed multipliers, the wave tables flattened into a spawn schedule, the endless generator, the composition summary used by the incoming strip, path following with a virtual start one row above the portal, the occupancy map, and the per-step spawn, move and resolve passes. Deaths are settled before leaks, so a killing blow in the same step as arrival cannot cost core HP.
- Wave flow in `src/11_game.js`: countdown to wave, wave to clear bonus, unlock checks for the upcoming wave, then the next countdown. The fixed step now runs countdown, spawning, movement, light and damage, deaths and leaks, then the phase transitions those imply.
- Enemy rendering: instanced mote spheres and runner cones (the remaining four types arrive in Phase 5), an additive glint per enemy for readability on the dark board, and camera-facing HP bars that appear only once an enemy is damaged.
- `src/09_ui.js`: the incoming strip (enemy pips and counts in spawn order during the countdown, wave number and enemies left during a wave, and short notices for wave start, wave cleared and unlocks), gold and damage floaters over the board, HP and gold counter animations.
- Debug additions: `freeze`, `step`, `stepUntil`, `nextWave` and a fuller `snapshot`, so wave-length tests run deterministically instead of waiting on real time.

**Browser testing:** `node tools/qa.js waves` at 390x844. 31 checks, all passing, with the arithmetic recorded:

- No pieces, wave 1: all four motes cross the single lit corner cell, take 10 of their 30 HP and leak, core 20 to 16, `leaksBy.mote` 4, gold 40 plus the 15 clear bonus = 55, countdown returns to 8 s, Splitter unlocks for wave 2 and Reflector does not.
- One mirror at (7,6) before wave 1: LIT 6/25, no leaks, gold 20 + 16 (four kills at 4) + 15 (bonus) = 51 and `goldEarned` 31.
- Waves 2 and 3 clear; Reflector unlocks going into wave 4; after three waves core 20/20, gold 158, score 488.
- Absorption ordering: with a mirror at (7,3) and motes on row 3, the measured power along the beam east to west is [10, 10, 10, 10, 10, 7.5] — the cell past a mote is at 75 percent, exactly one mote's absorption.
- A runner crossing only the corner cell reaches the core; the same runner with row 3 lit dies before it arrives and pays gold.
- Speed 2 doubles the clock. 25 draw calls.

Screenshots `shots/waves-390x844-a-wave1-running.png` through `-e-absorption-zoom.png` reviewed. Also confirmed by hand in a live Chrome tab: clicking (7,3) places the mirror, the beam bends, motes burn with HP bars, the beam is visibly thinner and dimmer past each enemy. Console: no messages from our code. Network: two requests.

**Problems found:**

1. The beam did not visibly dim past an enemy. The colour ramp treated anything above 70 percent of source power as pure white, and a single mote only takes power to 75 percent, so the most important teaching visual in the game did nothing.
2. HP bars rendered muddy brown. The bar materials had coloured base colours which multiplied with the per-instance colour.
3. Enemies walking in from the virtual start were clipped in half by the top of the camera frustum.
4. In tests, setting `s.wave` by hand let the countdown start a real wave underneath the test and corrupt the result. `wavesCleared` was also missing from `snapshot()`.
5. The debug panel sat on top of the HUD.

**Fixes:**

1. Segments now carry the power of the source that produced them, and colour is driven by the fraction of that source power left, with a much steeper ramp (white above 86 percent, amber by 45 percent, red below). Additive intensity and the bright core line also scale with the fraction, while width still scales with absolute power so core upgrades thicken every beam. The step is now obvious in a screenshot.
2. Bar materials are white; only the per-instance colour tints them.
3. Enemies scale up from a quarter size as they walk in, so they grow out of the portal instead of sliding in clipped.
4. Tests park the countdown; `snapshot()` reports `wavesCleared`.
5. Debug panel moved to the bottom-left.

**Decisions locked:** No changes to Part 1.

**Balance changes:** none. The spec's stated first-wave shape (no mirror gives four leaks; a mirror at (7,6) kills all four) is confirmed exactly by measurement.

**Result:** 26 Node tests and 31 browser checks pass. Waves 1 to 3 play end to end with correct gold and HP arithmetic, and absorption ordering is visible on screen.

**Next step:** Phase 3 — title screen, win, lose, pause and a residue-free restart.


### Session 1 — 2026-09-03 — Phase 3: win, lose, restart

**Goal:** Full run structure: phases, title screen, victory and defeat overlays, pause, and a restart that leaves no residue.

**Direction:** `MASTER_SPEC.md` section 33 Phase 3.

**Tools:** Claude Code with the Claude Opus model; Playwright mobile-emulation tests.

**Work completed:**

- Phase machine in `src/11_game.js`: `titleRun` (opens on the title card), `startRun` (PLAY), `restartRun` (straight back to the board, no title card), `endRun` (score, best score, phase), the loss check inside the fixed step, and victory when wave 12 clears while not in endless.
- Overlay system in `src/09_ui.js`, rebuilt only when the phase changes: title (wordmark, tagline, three control lines, best score, PLAY, and the "Portrait / single player / works offline" note), pause ("PAUSED — tap anywhere to resume"), defeat and victory. All overlay buttons are real DOM buttons.
- Defeat tips chosen by cause. The spec says "most leaks by X"; the implementation attributes by **core HP lost** per type rather than leak count, because a single Brute leak costs 3 HP and a swarmling leak costs 1, and the player needs to solve whatever actually killed them. Recorded here as a deliberate refinement.
- Score `goldEarned + 50 x wavesCleared + 10 x coreHp`, with best score written through the guarded `localStorage` helpers.
- HUD buttons: pause (toggles, icon flips to a play triangle) and the 1x/2x speed toggle. NEXT WAVE starts the wave immediately; its gold bonus and label arrive in Phase 6. The CORE button is hidden until Phase 4 rather than sitting on screen doing nothing. Help and mute are wired in Phases 6 and 9.
- A page opened in a hidden tab now pauses at boot instead of sitting in a running phase that never ticks.
- Debug additions: `forceWin`, `forceLose`, `killAll`, `spawn`; `R.render.info()` also reports the scene object count so restart residue can be measured.

**Browser testing:** `node tools/qa.js runstates` at 390x844. 44 checks, all passing:

- Opens on the title card; PLAY starts the run with a 10 s countdown and the overlay closes.
- Placing nothing loses for real at **wave 3**, which matches the spec's tuning target. Defeat overlay shows "Reached wave 3 of 12", score 133, best 133 and the coverage tip. The board ignores taps once the result is up.
- TRY AGAIN returns to a pristine board: gold 40, HP 20, wave 0, LIT 1/25, no pieces, no enemies, leak tally zero, unlocks reset.
- Forced victory shows "THE LIGHT HELD" with PLAY AGAIN and **no** CONTINUE button (endless arrives in Phase 5); best score is stored.
- Five consecutive restarts after building pieces and running part of a wave produce byte-identical snapshots, and `renderer.info` is unchanged: 20 geometries, 5 textures, 24 scene objects, 25 draw calls, both before and after.
- Pause during a wave freezes the clock and the enemies exactly (time 4.0333 and enemy progress 3.0333 before and after a 600 ms wait); the overlay reads PAUSED and tapping it resumes.
- Overriding `document.hidden` and firing `visibilitychange` pauses the game.
- All twelve waves build from the data with the right counts: wave 1 four motes, wave 6 sixteen swarmlings plus four runners, wave 10 the Brute King plus eight runners, wave 11 thirty enemies, wave 12 six motes, four brutes and Umbra.

Screenshots `shots/runstates-390x844-a-title.png`, `-b-defeat.png`, `-c-victory.png`, `-d-paused.png` reviewed. Console: no messages from our code. Network: two requests.

**Problems found:** One tooling failure rather than a game bug: a long shell heredoc silently failed to run, so a patch that added `forceWin` to the debug tools was never applied and the scenario threw. Fixed by writing large patches to a file and splicing them in, which is now the standard way this session edits big blocks.

**Fixes:** As above. No gameplay defects were found in this phase.

**Decisions locked:** No changes to Part 1. Added: defeat tips are chosen by core HP lost per enemy type, not by leak count.

**Balance changes:** none. Confirmed by measurement that a player who places nothing loses at wave 3, as the spec's difficulty target requires.

**Result:** 26 Node tests and 44 browser checks pass. A complete run can be started, lost, restarted, won and restarted again, with no state or mesh residue across restarts.

**Next step:** Phase 4 — the palette, the other three pieces, the action bar, drag-to-move, sell and undo, and core upgrades.


### Session 1 — 2026-09-03 — Phase 4: the full toolset and economy

**Goal:** Palette with unlocks, all four pieces, the action bar, drag to move, sell, undo, and core upgrades.

**Direction:** `MASTER_SPEC.md` section 33 Phase 4.

**Tools:** Claude Code with the Claude Opus model; Playwright mobile-emulation tests with real touch and CDP touch drags.

**Work completed:**

- `src/07_pieces.js`: selection, the undo record and its window, sell with the 70 percent rate (full price inside the undo window), move with the 0.75 s re-form during which the piece is transparent to light, and core upgrades with the five costs and the level-6 cap.
- `src/09_ui.js`: the palette (four buttons built from `R.PIECE_TYPES`, CSS-drawn icons, live cost including the lamp step, selected / unaffordable / locked states with the unlock wave printed on the lock), the action row (CORE with level and cost or MAX, NEXT WAVE with the early-call bonus), the action bar over a selected piece (FLIP hidden for reflectors, MOVE arming the next tap, SELL showing the actual refund), the undo chip, and the drag ghost.
- `src/10_input.js` rewritten as a one-pointer state machine: press becomes tap or drag past 10 px; drags start from a palette button or a placed piece; release on a valid tile places or moves, anywhere else cancels; `pointercancel` and window blur cancel; extra fingers are ignored. Keyboard shortcuts 1-4, F, Space and P are kept as development conveniences.
- Render: a green/red frame on the tile under a drag, a pulsing ring under the selected piece, and dimming of a piece while it is being dragged or is re-forming.
- The early-call bonus is now paid (`ceil(remaining x 1.5)`); it was pulled forward from Phase 6 because the button was already on screen and a button that does nothing is worse than one that works.
- `lampsBought` renamed `lampsPlaced` and decremented on sell, so the lamp price tracks the lamps on the board rather than the lamps ever purchased. Without this, selling a lamp silently raised the price of the next one forever.

**Browser testing:** `node tools/qa.js toolset` at 390x844, 360x800 and 430x932. 55 checks each, all passing:

- Palette: four buttons, mirror pre-selected, every button at least 48 px, lock labels "WAVE 2 / WAVE 4 / WAVE 7", a locked piece cannot be placed.
- Splitter gives two branches measured at 5.5 each from a 10 power beam; the reflector gives exactly one return pass measured at 6; a lamp emits 5 on the road and the second lamp costs 110.
- Action bar: appears on selection, has FLIP / MOVE / SELL with the live refund, hides FLIP on a reflector, stays fully on screen next to a column-0 piece (measured box 4 to 178 px), buttons 40 px tall.
- FLIP turns a lamp a quarter turn. MOVE then tap relocates it, the moved piece re-forms for a measured 0.75 s during which its light is off, and it lights again afterwards.
- Sell refunds 31 on a 45 splitter (70 percent, rounded down). Undo returns the full 20 on a mirror and removes it; after 3 s the chip is gone and selling the same mirror returns 14.
- Drags: palette to tile places; piece to tile moves; onto the road, off the board and `pointercancel` all leave the piece where it was; a second finger buys nothing.
- Core levels 1 to 6 measured on the board: beam 10, 13, 17, 22, 28, 35 and lamp 5, 6.5, 8.5, 11, 14, 17.5; costs 60, 100, 150, 220, 300 then MAX; total 830; the button refuses a seventh level.
- Unaffordable palette buttons are marked and buy nothing. 25 draw calls, segment cap holds.

Screenshots `shots/toolset-390x844-a-palette-locked.png`, `-b-all-pieces.png`, `-b-pieces-zoom.png`, `-c-actionbar.png`, `-d-core-max.png` reviewed: all four piece types are distinguishable at a glance (silver mirror slab, violet splitter cube with a bright diagonal, golden reflector cup, amber lamp with a facing notch).

**Problems found:**

1. **Taps on the action bar and the undo chip did nothing.** Those widgets live inside the board overlay, so their `pointerdown` bubbled to the board handler, which called `preventDefault()` and suppressed the click the browser would otherwise synthesise. It also armed a board press underneath them.
2. **Every drag silently failed.** `dragTargetValid` read the module-level press object, but `onPointerUp` nulls that object before the final position update, so the drop was always marked invalid.
3. The action bar was clipped off the left edge next to a column-0 piece.
4. Test-only: freezing the clock left newly placed pieces stuck at 20 percent of their size, because the placement pop animation is driven by simulated time.

**Fixes:**

1. The board handler ignores any `pointerdown` whose target is not the canvas.
2. `dragTargetValid` takes the drag record as an argument.
3. The bar is clamped using its measured width rather than a guessed constant.
4. Tests advance the clock briefly before taking screenshots. The behaviour is correct in play, where the clock always runs while pieces can be placed.

**Decisions locked:** No changes to Part 1. Added: the lamp price is based on lamps currently placed; the early-call bonus is implemented in Phase 4 rather than Phase 6.

**Balance changes:** none.

**Result:** 26 Node tests and 55 browser checks at three viewports pass. Every control listed in specification section 19 now works by touch, and the gold arithmetic is exact at every step.

**Next step:** Phase 5 — the remaining enemy types, bosses, HP scaling and Endless.


### Session 1 — 2026-09-03 — Phase 5: escalation, bosses and endless

**Goal:** The full twelve-wave script with every enemy type, HP scaling, bosses, a reachable victory, and Endless afterwards.

**Direction:** `MASTER_SPEC.md` section 33 Phase 5.

**Tools:** Claude Code with the Claude Opus model; Playwright mobile-emulation tests.

**Work completed:**

- Meshes for the four remaining enemy types: swarmling tetrahedron, brute box with an additive shell (the thing that soaks up the light), Brute King on the brute shape with a gold ring, Umbra octahedron with a violet ring. Bosses always show an HP bar; the others show one once damaged. Each type has its own spin rate.
- `R.continueEndless()` and the CONTINUE button on the victory screen; the HUD label switches from "WAVE n/12" to "ENDLESS n".
- A new `builds` test scenario that plays canned strategies from start to finish and reports how far each gets. This is the harness Phase 10 will use for balancing.

**Browser testing:** `node tools/qa.js escalation` at 390x844, 31 checks passing, plus the whole suite re-run (layout 8, beam 23, waves 31, runstates 44, toolset 55, escalation 31).

Measurements recorded:

- HP scaling: mote 30 / 48 / 61 / 80 at waves 1 / 5 / 8 / 12; a wave-12 brute is 318; Brute King stays 400 and Umbra stays 900 regardless of wave.
- **Direction matters, measured.** One brute in front of three motes on row 3, one second of beam at power 10: beam running *against* the flow puts 10 damage into the brute and only 6.9 into the three motes behind it; the same power running *with* the flow puts 4.2 into the brute and 23.1 into the motes. This is the signature mechanic and it is now proven numerically.
- Swarms drain: a clean beam reaches the far end of row 3 at 10 power; twelve swarmlings on the row cut it to 1.42; twenty-four put it out before the far end.
- Endless generator: waves 13 to 18 produce 28 to 37 enemies with rotating compositions, a Brute King at wave 15, speed multiplier 1.02 rising and capped at 1.5.
- **Victory is reachable by real play:** three mirrors at (7,3), (0,3) and (0,10) with the core at level 6 clears all twelve waves with 4 core HP left, score 1737, in 422 s of simulated time. Continuing into Endless ran waves 13, 14 and 15 with the score rising from 1737 to 2432.
- Strategy spread from the `builds` harness (unlimited gold, so this measures beam layout alone): concentrated-12 **wins** with 4 HP; two-segment-17 and wide-21 both die on wave 12; a lamp build dies on wave 9; mirrors-only at core 1 dies on wave 5; core-only dies on wave 4. Different strategies reach different waves, and spreading the beam thin is punished, which is the intended trade-off.
- Simulation cost at peak: 0.001 ms per fixed step. Draw calls 30.

Screenshots `shots/escalation-390x844-a-all-enemies.png` and `-a-enemies-zoom.png` reviewed: all six types are distinguishable at a glance.

**Problems found:**

1. **A regression from Phase 3 that the test suite caught only when the whole suite was re-run:** `__REFRACT.restart()` called `R.newRun()`, which after the title screen landed leaves the phase on `title`. Every test that restarted through the debug API was then poking a board that ignored input, and two older scenarios had silently started failing.
2. The `beam` scenario still expected Phase 1's temporary tap-to-flip; tapping a piece now selects it.
3. A "Need N" check failed because a piece was still selected, and the first tap on an empty tile deselects rather than buying.
4. Brute King and Umbra were barely larger than a plain brute.
5. The brute shell was bright enough to read as a light blue cube rather than a dark one.
6. The frame-time assertion at wave 11 (20 ms) fails in headless Chromium, which rasterises in software at deviceScaleFactor 3.

**Fixes:**

1. `__REFRACT.restart()` now calls `R.restartRun()`; a separate `__REFRACT.title()` returns to the title card. **From now on the full scenario suite is run at the end of every phase**, not just the new scenario.
2. and 3. Scenarios updated to the real interaction (tap to select, then FLIP; deselect before testing an unaffordable purchase).
4. Boss radii raised: Brute King 0.42 to 0.50, Umbra 0.46 to 0.56. These values are used only for drawing and HP-bar width, so there is no gameplay effect.
5. Brute shell intensity 0.16 to 0.09 and its body emissive darkened.
6. The performance check now measures simulation cost directly (0.001 ms per step) and treats the headless frame time as informational with a loose bound. The real frame-rate target is verified on a GPU in Phase 11.

**Decisions locked:** No changes to Part 1. Added: the whole browser scenario suite runs at the end of every phase.

**Balance changes:** Brute King radius 0.42 to 0.50 and Umbra radius 0.46 to 0.56, both cosmetic only, so bosses read as bosses. No numbers that affect play were changed. Noted for Phase 10: the only winning line found so far ends on 4 core HP, below the 6-14 target band, and three of the seven canned builds die on wave 12 — the late waves look slightly too sharp.

**Result:** All six enemy types, both bosses, HP scaling, a real victory and Endless all work. Whole suite: 192 browser checks plus 26 Node tests passing.

**Next step:** Phase 6 — hints, the Help overlay, defeat tips by cause, the early-call display, the beam sweep and the drag preview.


### Session 1 — 2026-09-03 — Phase 6: teaching and strategic depth

**Goal:** The player can see the decisions and learn the rules without reading anything long.

**Direction:** `MASTER_SPEC.md` section 33 Phase 6.

**Tools:** Claude Code with the Claude Opus model; Playwright mobile-emulation tests.

**Work completed:**

- Hint toasts, each shown at most once per run and never while a piece is selected or a drag is in progress (so a hint can never sit under the action bar): the opening "tap a tile on the beam", the flip/move/sell hint after the first placement, the along-the-road rule after wave 1, the core-power nudge after wave 3, a brute hint the first time a brute spawns, a swarm hint the first time swarmlings spawn, and a one-line explanation with each unlock.
- Help overlay behind the `?` button: nine rows covering all four pieces, the core, burning, shielding, direction and the no-retracing rule. It pauses the game and resumes on BACK.
- LIT counter pulses whenever road coverage increases.
- **Beam sweep.** The solver now records each segment's distance from its source, and the renderer trims segments to a sweep length that grows at 60 cells per second whenever the route changes. Route changes are detected with a `routeVersion` counter bumped only by `R.beam.recompute`, which runs on place, flip, move, sell, undo and core upgrade — so the sweep fires on real re-routes and not on the 60-per-second solves during a wave.
- **Ghost beam preview.** While dragging, the exact route the piece would produce is solved with the piece hypothetically in place (and, for a move, hypothetically removed from its old tile) and drawn as a dim cyan beam. The result is cached by target cell and orientation so the solver runs only when the target changes. Palette drags preview the smart orientation; piece drags preview the piece's own orientation.
- Defeat tips and the early-call bonus display were already in place from Phases 3 and 4; both are covered by tests here.

**Browser testing:** `node tools/qa.js teaching` at 390x844, 32 checks passing, plus the whole suite (layout 8, beam 23, waves 31, runstates 44, toolset 55, escalation 31, teaching 32 = 224 browser checks).

Measurements:

- Hint order confirmed by reading the live DOM: "Tap a tile on the beam..." on PLAY, then "Tap a placed piece to flip, move or sell it." after the first placement. The hint disappears while a piece is selected and a hint already shown does not return.
- Early call: with 7.3 s left the button offered +11 and paid exactly `ceil(remaining x 1.5)`; the wave started immediately.
- Help pauses (`phase` becomes `paused`) and BACK resumes to `wave`.
- Defeat tips: a brute-heavy loss gets the shielding tip, a swarm-heavy loss the split-the-light tip, a runner-heavy loss the lengthwise tip, a plain loss the coverage tip.
- Sweep length sampled per frame after placing a mirror: 2, 4, 6, 8, 10, 11, 13, 15, 17, 19, 21, 22 cells — the beam travels rather than appearing.
- Drag preview: two ghost segments while hovering (7,6), cleared on release, and the real beam that results matches the preview at LIT 6.
- Incoming strip lists wave 12 in spawn order: motes x6, brutes x2, Umbra x1, brutes x2.

Screenshots `shots/teaching-390x844-a-first-hint.png`, `-b-help.png`, `-c-drag-preview.png` reviewed. The help screen fits 390x844 without scrolling and scrolls on shorter screens. Console: no messages from our code.

**Problems found:** No game defects. Two test-authoring errors: a hint assertion that did not account for an earlier hint still being on screen, and a button label read before the next animation frame had refreshed it.

**Fixes:** Both assertions corrected.

**Autonomous playtest questions (after Phase 6):**

- *Is the goal obvious within 10 s?* Yes. The board opens with the beam already firing into the corner road cell, the countdown is visible, and the first hint names the exact action. The title card states the premise in one line before that.
- *Is the first interaction clear?* Yes: one tap on a tile in the beam's column bends it.
- *Is placing a mirror satisfying?* The sweep helps a lot; the beam visibly travels out and the lit road cells light up behind it. It still needs sound and a placement pop, which are Phases 8 and 9.
- *Does the loop work without explanation?* Read the wave, place, watch, spend. The incoming strip and LIT counter carry it. The one thing that is not obvious without the help screen is that direction matters; the hint on the first brute is currently the only in-play teaching for it.
- *Meaningful decision each wave?* Yes, and the `builds` harness shows spreading the beam thin loses while concentrating it wins.
- *Does progression visibly affect play?* Yes: core level thickens and brightens the beam, unlocks land at waves 2, 4 and 7 with a palette flash, and LIT climbs.
- *Any exploits so far?* Sell/undo cannot make money (undo returns exactly the purchase price, sell returns 70 percent). Early call is pure upside for a confident player and is a candidate for review in Phase 10.

**Decisions locked:** No changes to Part 1.

**Balance changes:** none.

**Result:** 26 Node tests and 224 browser checks pass. The rules are teachable in play and the two things a screenshot cannot show — the sweep and the drag preview — are verified by measurement.

**Next step:** Phase 7 — mobile UX across every target viewport.


### Session 1 — 2026-09-03 — Phase 7: mobile UX

**Goal:** A flawless portrait touch experience at every target viewport, plus a sane landscape fallback.

**Direction:** `MASTER_SPEC.md` section 33 Phase 7.

**Tools:** Claude Code with the Claude Opus model; Playwright mobile emulation at five phone sizes, a simulated notch, landscape, and a desktop window.

**Work completed:**

- Two new test scenarios: `mobile`, which measures every interactive control at a given viewport across five screens (title, mid-wave with the action bar open, victory, defeat, help) and asserts nothing overflows or is too small; and `landscape`, which rotates the viewport and back.
- A third, `handplay`, plays an entire twelve-wave run using nothing but taps on real controls — PLAY, palette buttons, board tiles and CORE. Only the clock is advanced between actions.
- Layout: `LAYOUT.COLUMN_ASPECT` 0.5 to 0.56 so the portrait column is not needlessly narrow on shorter phones; a short-screen block at 680 px height and a landscape block at 470 px height that shrink the chrome rows and overlay type so the whole board still fits.
- Touch targets: HUD icon buttons 44 to 46 px (42 on phones narrower than 375 px), action-bar buttons 40 to 44 px, undo chip 40 to 44 px, and the action row given enough height on short screens that its buttons stay 42 px.

**Deviation from the spec, recorded deliberately:** section 20 asks for 48 x 48 px tap targets. The HUD icon buttons are 46 x 46 (42 on a 360 px phone). Four 48 px buttons plus a legible four-stat HUD does not fit 360 px, and truncating the HUD numbers would cost more than two pixels of target are worth. Every other control — palette buttons, action-row buttons, action-bar buttons, the undo chip and every overlay button — is at least 44 px in both dimensions, and the measured minimum across all five viewports is 42 px.

**Browser testing:** `node tools/qa.js mobile` at 390x844, 360x800, 393x852, 430x932 and 360x640 — 32 checks each, all passing; `landscape` — 9 checks; `handplay` at 360x800 — 3 checks; plus the whole suite.

Measured cell sizes: 46.7 / 43.1 / 47.0 / 51.4 / 33.7 px, and 41.9 px with a simulated 47 px notch and 34 px home indicator. Desktop 1280x800 gives a 448 px centred column with a 44.9 px cell.

Verified in the browser:

- No horizontal or vertical page overflow on any screen at any size; every control is inside the viewport on title, mid-wave, victory, defeat and help.
- The action bar sits above a piece below row 1 and drops below a piece in row 0, measured against the piece's projected position.
- A double tap on the board does not zoom (`visualViewport.scale` stays 1) and does not scroll; a long swipe across the board does not scroll the page.
- With a simulated notch the HUD clears 47 px at the top and the palette clears 34 px at the bottom.
- The help screen fits 390x844 exactly and scrolls on shorter screens.
- Landscape 844x390: the portrait column stays, centred, 218 px wide, with the "Best played in portrait" caption on the side bars, no horizontal overflow, and the whole board still visible at a 16.7 px cell. Rotating back restores the portrait layout with the run, the pieces and the beam intact.
- **A whole run played only by tapping, at 360x800, clears all twelve waves.**

Screenshots reviewed: `shots/mobile-<size>-01-title.png` through `-06-safearea.png` for each of the five sizes, plus `shots/mobile-390x844-07-landscape.png`, `-08-back-to-portrait.png` and `shots/handplay-360x800-handplay-result.png`.

**Problems found:**

1. At 360x640 the CORE button was 37 px tall, below the target minimum.
2. At 360x640 the HUD clipped "WAVE 1/12" because the portrait column was clamped to 320 px on a 360 px screen while the four utility buttons kept their full width.

**Fixes:**

1. The short-screen action row is 52 px with 5 px padding, giving 42 px buttons.
2. `COLUMN_ASPECT` raised to 0.56, so a 360x640 screen gets a 358 px column instead of 320. The board is height-bound at that size, so this costs nothing and gives the HUD the room it needed. Stat type also shrinks to 14 px on short screens.

**Decisions locked:** No changes to Part 1. Added: HUD utility buttons are 46 px (42 on narrow phones) rather than 48; every other control is at least 44 px.

**Balance changes:** none. **Two findings recorded for Phase 10:**

- A hand-played, informed run — three mirrors at (7,3), (0,3), (0,10), then core upgrades interleaved with three lamps at (2,11), (1,6) and (1,4) — **wins with 17 core HP left**, LIT 23/25, score 1983, core level 5, six pieces, without ever touching debug gold. The spec's target band for an informed player is 6 to 14 HP, so the informed line is currently a little too comfortable.
- The same run with mirrors and core upgrades alone (no lamps) reaches wave 12 and dies with 0 HP, ending with 167 unspent gold. Lamps are far more gold-efficient than the last core levels: at core 6, one lamp lighting a five-cell segment adds about 87 power-cells for 90 gold, while the 5-to-6 core upgrade adds about 84 power-cells for 300. That is a genuine and interesting trade-off, but the size of the gap is worth reviewing.

**Result:** 26 Node tests and 270 browser checks across eleven scenarios pass. The game is fully playable by touch at every target size.

**Next step:** Phase 8 — game feel: particles, floaters, shakes, banners and transitions.


### Session 1 — 2026-09-04 — Phase 8: game feel

**Goal:** Every row of the feedback table in specification section 23 has its effect.

**Direction:** `MASTER_SPEC.md` section 33 Phase 8.

**Tools:** Claude Code with the Claude Opus model; Playwright mobile-emulation tests.

**Work completed:**

- Particle system: 400 pooled records drawn through one additive instanced mesh with a procedurally drawn shard texture. Particles have velocity, drag, gravity, spin and a fade, live entirely in the renderer on real time, and never touch the simulation.
- Shard bursts on every death, sized and coloured by enemy type: 4 for a swarmling, 7 for a mote or runner, 10 plus a 4 px shake for a brute, 18 plus a white overlay burst, a 9 px shake and 60 ms of hit-stop for a boss.
- Sparks where the light is biting, about ten a second per burning enemy.
- Screen shake applied as a transform on the board element, so the canvas and everything drawn over it move together and cell picking stays correct. Amplitude decays quadratically. **Shake is suppressed entirely while a piece is being dragged.**
- Leak feedback: a red vignette over the whole column that flashes by leak size and fades, plus the existing HP shake and floater, plus a small burst at the core.
- Wave banners that slide in, hold and rise away, inside the board area so they never cover the HUD.
- Gold from a kill now arcs from the enemy to the gold counter instead of drifting upward.
- Core upgrade sends a bright pulse travelling along the beam at 26 cells per second.
- The spawn portal flares when a wave starts.
- Flip animates as a 120 ms snap rotation; a sold or undone piece shrinks out over 240 ms; a moved piece stays translucent while it re-forms.
- Victory flares every beam white and throws about 190 confetti shards; defeat gutters the beam out over roughly a second and shakes once.
- Restart clears particles, ghosts, banners, vignette, shake and the flare/gutter state.

**Browser testing:** `node tools/qa.js feel` at 390x844, 26 checks passing, plus the whole twelve-scenario suite.

Measurements: a mote death produces 7 particles; a brute death shakes at 4 px; a boss death shakes at 9 px, stops time for 60 ms and produces 28 particles, and the board element carries a real `translate(...)`; a 3 HP leak drives the vignette to 0.62 opacity; the wave banner reads "WAVE 1", sits inside the board and clears the HUD; a core upgrade starts a beam pulse; a sold piece leaves exactly one shrinking ghost; a kill floats "+4" towards the counter; victory reaches flare 1.27 with 192 particles; defeat drops the beam multiplier from 0.96 to 0.47 over twelve frames; after a restart every effect counter is zero. **Peak particle count over the whole of wave 11 was 212, inside the 400 budget**, with 33 draw calls.

Screenshots `shots/feel-390x844-a-death-burst.png` through `-g-defeat-gutter.png` reviewed.

**Problems found:**

1. **A real bug with wide reach: `R.emit` overwrote the payload's `type` field with the event name.** Every event that carried an enemy type or a piece type — kill, leak, spawn, unlock, place, flip, move, sell, denied — was reporting `type: "kill"` and so on. The visible symptoms were that brute and boss deaths never shook the screen, unlock notices would have read "UNLOCK UNLOCKED", and the brute and swarm hints could never fire. It went unnoticed because until this phase nothing had read those fields.
2. The red vignette never appeared: the UI stepped its fade before handling events, so an effect started in a frame was not drawn until the next one.
3. Two flaky assertions that read a decaying effect after a screenshot had already consumed the time.
4. A dead `occDirty` variable left in the enemy module.

**Fixes:**

1. Event payloads now use `enemy` for an enemy type and `piece` for a piece type, and never a `type` key; the comment on `R.emit` says so. All readers updated.
2. `ui.frame` handles events first, then steps floaters, banners and the vignette, so an effect started this frame is drawn this frame.
3. Assertions moved to immediately after the trigger.
4. Removed.

**Decisions locked:** No changes to Part 1. Added: feedback event payloads never carry a `type` key.

**Balance changes:** none.

**Result:** 26 Node tests and 296 browser checks across twelve scenarios pass. Every row of section 23 has its feedback except sound, which is Phase 9.

**Next step:** Phase 9 — synthesized audio.


### Session 1 — 2026-09-04 — Phase 9: audio

**Goal:** Synthesized sound that makes the beam feel physical, safely under browser autoplay rules.

**Direction:** `MASTER_SPEC.md` section 33 Phase 9 and section 24.

**Tools:** Claude Code with the Claude Opus model; Playwright mobile-emulation tests.

**Work completed:**

- `src/02_audio.js`. No audio files: one shared master gain at 0.5, a half-second white-noise buffer generated at start-up, and every sound built from oscillators and filtered noise.
- The context is created on the first `pointerdown`, `keydown` or `touchstart` and resumed on every later gesture if it is suspended. Everything is wrapped so that a missing or blocked `AudioContext` sets a flag and the rest of the module becomes a no-op.
- Sixteen sounds: place, flip, sweep, sizzle, gold, three death pops (small, normal, big with a noise thud), leak thud, wave horn, wave-clear arpeggio, unlock sparkle, upgrade sweep, deny buzz, victory fanfare and defeat fall.
- Beam hum: three detuned sawtooth oscillators at 55, 55.6 and 110 Hz through a 320 Hz low-pass, smoothed with `setTargetAtTime`, ducked to zero whenever the game is not running.
- Voice cap of eight. When the cap is reached the quietest live voice is faded out and replaced, and a new sound quieter than everything playing is simply dropped.
- Throttles: sizzle at most once every 150 ms, gold chime once every 100 ms. Pitch varies by up to 6 percent on hit and death sounds so repeats do not sound mechanical.
- Mute toggle on the HUD button, persisted through the guarded storage helpers, with the strike-through icon state.
- Debug additions `playAll()` and `audio()`.

**Browser testing:** `node tools/qa.js audio` at 390x844, 23 checks passing, plus the full thirteen-scenario suite.

Measurements:

- Before any gesture: no context exists, and calling a sound returns false rather than throwing.
- After the first tap the context is `running`; all sixteen sounds play without throwing.
- Sixty rapid death sounds leave exactly 8 live voices.
- Hum: LIT 1 gives 10 lit road power and a gain of 0.0030 (inaudible); LIT 12 at core level 6 gives 420 power and a gain of 0.0796, just under the 0.08 ceiling.
- Mute mutes, stops sounds playing, shows on the button, writes `refract.muted`, and survives a reload.
- With `AudioContext` deleted the game still runs: mirror placed, LIT 7, waves running.
- With `localStorage` throwing on access the game still runs: mute still toggles in memory and the best score still tracks in memory.

**Problems found:**

1. The hum was audible at LIT 1 (gain 0.039). It was driven by `beam.totalPower`, which counts every cell the beam crosses — the untouched core beam crosses eleven cells of column 7 for 110 power even though only one road cell is lit.
2. The wave-11 frame time in headless Chromium had crept from 33 to 50 ms after Phase 8.

**Fixes:**

1. The solver now also reports `litRoadPower`, the power falling on road cells only, and the hum is driven by that against a 260 ceiling. Measured 0.0030 at LIT 1 and 0.0796 at LIT 12 core 6.
2. Investigated properly rather than guessed. A direct probe of `renderer.render` shows **0.18 ms per frame**, so rendering was never the cost; the 33 ms figure is headless Chromium clamping `requestAnimationFrame` to 30 Hz. While measuring, a real optimisation was found and applied: pooled instanced meshes were hiding unused instances with a zero-scale matrix, which still runs them through the vertex shader. `Filler.finish` now lowers `InstancedMesh.count` to the number actually written. **Draw calls at wave 11 fell from 33 to 22.**

**Decisions locked:** No changes to Part 1.

**Balance changes:** none.

**Result:** 26 Node tests and 319 browser checks across thirteen scenarios pass. Audio works after a gesture, fails silently without one, and never throws. Rendering costs 0.18 ms a frame and the simulation 0.001 ms a step.

**Next step:** Phase 10 — balancing against the targets in specification section 15.


### Session 1 — 2026-09-04 — Phase 10: balancing

**Goal:** Meet the tuning targets in specification section 15 through measured play.

**Direction:** `MASTER_SPEC.md` section 33 Phase 10. Only balance values and wave data may change.

**Tools:** Claude Code with the Claude Opus model; a new `bots` scenario that plays whole runs through the real economy inside the page, so each candidate balance can be measured in seconds.

**Work completed:**

- `tools/qa-scenarios.js` gained `bots`: ten strategies, each a shopping list bought in order as gold allows, with no free gold and the real unlock schedule. Each run reports waves reached, HP curve, gold earned, LIT, core level, score, run length and a leak breakdown by enemy type. This is the harness section 33 asks for.
- Iterated on `HP_MULT_PER_WAVE` (0.15 → 0.19 → 0.22 → 0.21 → 0.20), boss HP and the wave-12 composition, measuring the whole strategy table after each change.

**Balance changes (before → after, with the reason):**

| Value | Before | After | Reason |
|---|---|---|---|
| `HP_MULT_PER_WAVE` | 0.15 | **0.20** | An informed run finished with 17 core HP, above the 6–14 target band. 0.19 gave 14 (the very top of the band), 0.21 and 0.22 gave 5 and pushed a first-time player down to wave 5. 0.20 lands the informed win on **11 HP** and keeps a first-timer at wave 7. |
| `ENEMY.bruteking.hp` | 400 | **460** | Wave 10 cost an informed player nothing. |
| `ENEMY.bruteking.radius` | 0.42 | 0.50 | Cosmetic (logged in Phase 5): the mini-boss did not read as bigger than a plain brute. |
| `ENEMY.umbra.radius` | 0.46 | 0.56 | Cosmetic, same reason. |
| Wave 12 | `mote 6, brute 2, umbra 1, brute 2` | `mote 6, brute 2, umbra 1, brute 2, runner 6` | The finale had no tail; six fast runners arrive while the player is still burning down Umbra. |
| `EARLY_CALL_RATE` | 1.5 | **1.0** | Measured: calling every wave early is pure upside for a player with a plan. At 1.5 it was worth 147 gold, about 14 percent of a run's income. At 1.0 it is 98 gold, about 8 percent — still a real reward for tempo, no longer close to dominant. |

Umbra was tried at 950, 1050 and 1200 and reverted to its specified 900. Above 900 it survives the informed build outright and takes 10 HP in one hit, which turns the finale into a coin flip rather than a fight. At 900 the informed build kills it with roughly a five percent margin — its HP bar drains for the whole length of the road, and a player one lamp short loses it.

**Measured strategy table at the final values** (each a full run, real economy):

```
strategy               result   wave hp  lit core pcs earned  score  hp by wave
nothing                lost        3   0    1    1   0     33    133  [16,9,0]
core only              lost        3   0    1    2   0     33    133  [16,9,0]
mirrors only           lost        7   0   12    1   9    342    642
first timer            lost        7   0    6    3   4    303    603
one mirror then lamps  lost        5   0    7    1   1    182    382
splitter spread        lost        7   0   21    3   6    343    643
reflector              lost        7   0    7    3   4    325    625
informed               won        12  11   23    5   6   1211   1921
informed, early calls  won        12  11   23    5   6   1309   2019
sell and rebuy loop    lost       12   0   12    6   3    967   1517
```

**Targets from section 15, all met:**

- A player who places nothing loses on wave 3. Measured: wave 3, HP 20 → 16 → 9 → 0.
- A first-time player following the hints reaches wave 6 to 9. Measured: wave 7.
- A player who understands absorption and direction wins with 6 to 14 core HP. Measured: **won with 11**, in 413 s of simulated play — inside the 6 to 9 minute session target.
- No single purchase wins alone: mirrors only reaches wave 7, core only wave 3, one mirror plus lamps wave 5, splitters spread thin wave 7.
- Strategies spread across waves 3 to 12.

**Exploit checks:**

- *Sell and rebuy loop:* buying and selling a mirror thirty times inside the undo window leaves gold at exactly 1000, and ten cycles that let the window expire cost 60 gold. There is no money loop. The one thing a determined player can do is place a piece, let it fire for under three seconds, and undo for the full price — three seconds of one extra mirror per cycle of constant tapping. That is the forgiveness the undo window exists for, the payoff is tiny, and it is left as specified.
- *Early-call snowball:* worth 98 gold, 8 percent of income, and the run ends on the same 11 HP. Accepted as a tempo reward. Recorded honestly: for a player who already knows their plan there is no real downside to pressing it, which is true of the genre generally; the cost is that the wave arrives before you have read its composition.
- *Reflector:* a reflector mid-chain blocks everything downstream (LIT falls to 1), so it is a real decision rather than a free extra pass. The reflector bot reaches wave 7.
- *Lamp spam:* lamps are the most gold-efficient damage in the game — at core 6 a lamp lighting a five-cell segment adds about 87 power-cells for 90 gold against 84 for the 300-gold core upgrade — but they unlock at wave 7 and cannot carry a run alone (wave 5 with one mirror plus lamps). The efficiency is what makes the late-game purchase decision interesting, and the unlock schedule keeps it from being the only answer.

**Problems found:** Six scenarios asserted on pre-tuning numbers (mote HP by wave, Brute King HP, the wave-12 composition, the early-call rate, and the build used for the escalation victory run). Two of them referenced `R` from the Node side of the test file, where it does not exist.

**Fixes:** Assertions updated to the tuned values and, where the value is a balance number, read from `R.BALANCE` inside the page so a future tuning pass does not break them again. The escalation victory run now uses the three-mirror, three-lamp build.

**Decisions locked:** No changes to Part 1.

**Result:** 26 Node tests and 330 browser checks across fourteen scenarios pass. Every tuning target in section 15 is met by measurement, and no exploit survives.

**Next step:** Phase 11 — performance verification on a real GPU.


### Session 1 — 2026-09-04 — Phase 11: performance

**Goal:** Meet the budgets in specification section 30 and prove the simulation is refresh-rate independent.

**Direction:** `MASTER_SPEC.md` section 33 Phase 11.

**Tools:** Claude Code with the Claude Opus model; a new `perf` scenario using CDP CPU throttling, `performance.memory` and `requestAnimationFrame` sampling, run both in headless (software rasteriser) and against the real GPU with `node tools/qa.js perf --gpu`.

**Work completed:**

- `R.advance(state, dtReal)` extracted from the frame callback. The accumulator and fixed-step loop now live in one testable function, so the pacing can be driven at any refresh rate in a test and behave exactly as it does in the browser.
- `tools/qa.js` gained a `--gpu` flag that launches a headed browser with GPU rasterisation, and `--enable-precise-memory-info` so heap size can be read.
- HP bars for the smallest enemies were widening to a 0.5-unit floor and merging into a solid band when a swarm bunched up; the floor is now 0.34.
- The instance-count optimisation from Phase 9 (only submitting instances actually written) is the main draw-call win and was already in place.

**Measurements at the peak board** (wave 11, nine pieces including a splitter and a reflector, core level 6, 30 enemies, three lamps):

| Budget | Target | Measured |
|---|---|---|
| Draw calls | ≤ 150 | **28** |
| Geometries / textures | small | 26 / 6 |
| Beam segments | ≤ 128 | within the pool |
| Particles | ≤ 400 | within the pool |
| Device pixel ratio | capped at 2 | capped |
| Simulation, one fixed step | — | **0.005 ms** |
| Render, one frame | — | **0.29 ms** |
| HUD, one frame | — | **0.43 ms** |
| Our work per frame | < 16.6 ms | **0.73 ms** |
| Our work per frame, 4x CPU throttling | no frame > 50 ms | median 3.8, p95 6.5, **worst 11.9 ms** |
| Observed frame gap, real GPU | 60 fps | **6.1 ms median (about 164 fps)** |
| Observed frame gap, headless | — | 33.3 ms (rAF clamped to 30 Hz by headless Chromium, not a cost) |

**Refresh-rate parity:** the same enemy, driven through `R.advance` at 30, 60, 120 and 144 Hz for thirty seconds of real time, reaches the core at **5.9 s of simulated time in every case**, and simulated time tracks real time to within 0.02 s. A single five-second stall advances the simulation by 0.083 s rather than replaying five seconds, so a long frame cannot fast-forward a wave.

**Memory:** six consecutive restarts, each building five pieces and playing a full wave 9, leave the heap at 7087, 7023, 6967, 6877, 8774 and 8684 kB — 1.7 MB of drift between runs 2 and 6, which is ordinary garbage-collector timing rather than growth. Scene objects (34), geometries (26) and textures (6) are identical before and after.

**Work considered and deliberately not done:** section 33 lists merging the static board geometry and an antialias fallback. Both were measured rather than assumed: at 28 draw calls against a budget of 150, and 0.73 ms of our own work per frame, neither would buy anything. They are recorded here as skipped with the numbers that justify it, rather than left half-built.

**Problems found:** none in this phase. The only change was the HP-bar floor.

**Fixes:** HP-bar minimum width 0.5 to 0.34 units so a bunched swarm does not read as one solid bar.

**Decisions locked:** No changes to Part 1.

**Balance changes:** none.

**Result:** 26 Node tests and 347 browser checks across fifteen scenarios pass. Every budget in section 30 is met with a wide margin, and the simulation is provably identical at 30, 60, 120 and 144 Hz.

**Next step:** Phase 12 — offline packaging and compliance on the release build.
