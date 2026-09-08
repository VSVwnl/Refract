# Build Log: REFRACT

Genre: Tower Defense & Strategy
Competition: Meta Horizon Creator Competition: Game Prototype
Format note: this file is exported as `buildlog.md` at packaging time. It must never contain personal names, handles or contact details.

This is a running record kept during the build. Part 1 lists the decisions currently locked and is edited in place when a decision changes (the change is also noted in that session's entry). Part 2 has one entry per work session, written during the session. Entries are never rewritten after the fact.

---

## Part 1 — Decisions locked so far

Design (locked in the design session before any code existed; see `MASTER_SPEC.md` for detail):

- Concept: a tower defense with no towers. One beam of light from the defended Lumen Core; the player bends, splits and bounces it with placed pieces so it runs along the enemy road.
- Genre floor: placeable defenses (Mirror, Splitter, Reflector, Lamp, upgradeable Core), eight escalating encounters plus endless, meaningful spend/upgrade decisions. All three present.
- Board: 8 × 12 grid, one fixed map ("Switchback") with two entrances, core bottom-right, core beam fires north up column 7 and only touches one road cell by default. The north gate walks the whole road; the west side gate at (0,3) joins at (1,3) and skips the first sweep. (Replaced "Stairway" in session 2; second gate added in session 6.)
- Central rule: enemies in a lit cell take beam power × dt; each enemy absorbs a fraction of the beam, so beam direction relative to enemy order matters.
- Pieces: Mirror (90°), Splitter (pass + reflect at 50% each), Reflector (return at 60%), Lamp (second source at 50% of core power). Core levels 1–6.
- Controls: tap palette → tap tile to place; tap piece → flip/move/sell; drag to move; undo within 3 s; portrait, touch-first, one active pointer.
- Session: eight encounters, about 5 to 6 minutes at normal speed; win/lose/reset; endless after victory; score with best score.
- First run only: a three step walkthrough before wave 1, remembered in localStorage. Place the marked mirror, tap it to learn the verb, start the wave. A SKIP TUTORIAL button places the same opening mirror so a returning player starts from the same viable board.
- Endless is the original four rotating wave shapes with their original counts, spacing and scaling. The single change from the campaign's rules is that every endless group is halved between the two gates, so a network covering one road does not hold. Session 7's larger endless rebuild was reverted at the owner's request; see session 8.
- Planning is untimed. Combat is paused between encounters until the player taps START WAVE; there is no countdown and no reward for starting early. Moving, turning and selling pieces during planning is free and refunds the price paid; mid-combat a moved piece goes dark for 0.3 s and a sale returns the sell rate.
- Enemies: Mote, Runner, Swarmling, Bulwark, Brute King, Umbra. Absorption (how much light a body removes from what continues past it) and shielding (how much damage is deflected when light meets the face it walks towards) are separate constants.
- Umbra advances shielded, then drops the shield at 45 percent of the road for the rest of the walk. About 56 s on the road.
- Run upgrades: after encounters 2 and 5 the run stops and offers three of six (Crossfire, Afterglow, Piercing Light, Focused Core, Twin Flames, Long Reach). Focused Core and Twin Flames exclude each other. They last the run and are cleared on restart. Core levels stay a plain supporting spend.
- Terminal rules: the run is won only by destroying Umbra. A boss that reaches the core loses the run outright, whatever core HP is left.
- Scope: one map, four pieces, six enemy types incl. two bosses, no meta-progression, no menus beyond title/help/results.
- Art: Three.js primitives only, procedural canvas textures, DOM HUD, no image/audio/font files. Legibility first.
- Audio: synthesized with Web Audio; gesture-gated; mute persisted.

Technical:

- Stack: HTML + CSS + vanilla JS classic scripts + Three.js r149 UMD in `vendor/three.min.js`. No modules, frameworks, bundlers, minification or network calls.
- Source in `src/` under one global `R`; `tools/build.js` inlines everything into a readable `index.html` at the repo root; `tools/serve.js` rebuilds on request; release build excludes `src/99_debug.js`.
- Fixed-timestep simulation (1/60 s), render reads state only, pooled entities, Pointer Events input.
- Packaging: zip with `index.html` at root + `vendor/`, created with Python `zipfile` (forward-slash entries), tested from a clean unzip, offline, in a private window.

Decisions added during the build:

- Camera: orthographic, tilted 25 degrees. The frustum is fitted to the board in the tilted view (its height scaled by cos 25) while the canvas keeps the same cell count, so board cells project as exact squares and only piece height is foreshortened. Margins are expressed in cells so a piece at the top edge is never clipped.
- The beam solver splits a run into an extra render segment wherever an enemy drops its power, so the dimming past each shadow is visible; segments carry world-space endpoints, their source's power, their distance from the source (for the sweep) and a flag for real bends.
- Beam colour is driven by the fraction of its own source's power that is left, not by absolute power, so a lamp beam reads as full strength at its own level while an absorbed beam reads as amber and then red. Width follows absolute power, so core upgrades thicken everything.
- Only road cells glow when lit. That is the number the player is pushing (LIT n/25) and it stops light spilling over buildable tiles from washing the board out.
- Defeat tips are chosen by core HP lost per enemy type, not by leak count, because a Brute leak costs 3 and a swarmling leak costs 1.
- The lamp price is based on lamps currently placed, so selling one does not permanently raise the price of the next.
- Feedback event payloads never carry a `type` key; `enemy` and `piece` name the kind of thing involved. `type` is reserved for the event name.
- The development tools attach themselves to the game rather than being called from it, so the release build contains no reference to them at all — not even the word "debug".
- Layout: the portrait column is `min(innerWidth, round(innerHeight × 0.56))`. HUD utility buttons are 46 × 46 px (42 on phones narrower than 375 px) rather than the 48 px originally specified, because four 48 px buttons plus a legible four-stat HUD does not fit a 360 px screen; every other control is at least 44 px.
- Testing: `tools/qa.js` drives Playwright with mobile emulation and real touch; the whole suite is run at the end of every phase, not just the new scenario. `tools/map-lab.js` measures a candidate road layout headlessly before any map change.

Balance, tuned by measurement in Phase 10 (see that entry for the before and after values and the reasoning):

- `HP_MULT_PER_WAVE` 0.14, `WAVE_CLEAR_PER_WAVE` 7, `EARLY_CALL_RATE` 1.0, Brute King 460 HP, Umbra 900 HP, wave 12 gains a six-runner tail. Everything else is as originally specified. (The first two were retuned in session 2 for the larger map.)
- Verified targets: placing nothing loses on wave 3; a first-time player following the hints reaches wave 10; an informed player wins with 11 core HP; no single purchase type wins alone; the ten measured strategies finish across waves 3 to 12.

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


### Session 1 — 2026-09-04 — Phase 12: offline build and compliance

**Goal:** Prove the release build is self-contained, compliant, and playable offline from a clean unzip.

**Direction:** `MASTER_SPEC.md` section 33 Phase 12 and section 41.

**Tools:** Claude Code with the Claude Opus model; `tools/package.js`, `tools/make_zip.py`, `tools/check.js`, `tools/scan-artifacts.js`; Playwright with all non-local requests aborted at the route level.

**Work completed:**

- `tools/package.js`: release build, compliance check, unit tests, zip, `dist/buildlog.md`, `dist/design-intent.docx`, then an artifact scan — one command produces everything that gets uploaded.
- `tools/make_zip.py` builds the zip with Python's `zipfile` (not PowerShell's `Compress-Archive`) with fixed timestamps and forward-slash entry names, then reopens it and verifies the entry list, the absence of backslashes and the size limit.
- `tools/scan-artifacts.js`: scans `index.html`, `dist/buildlog.md`, `docs/design-intent.md` and `SUBMISSION_NOTES.md` for email addresses, Windows or home directory paths, code-host profile links, placeholder markers, text addressed to evaluators, and the author's own git name and email. The build log is the one file allowed to name the AI tools used, because the official build-log guidance asks for that; nothing else may.
- `tools/check.js` extended: `eval(`, `new Function(` and `console.` are now banned in release builds (allowed in the development build, where the debug tools use them); `document.write` and inline event handlers are banned outright; the release must not contain the word "debug" at all; and `localStorage`/`AudioContext` use is cross-checked against the number of `try` blocks.
- `tools/qa.js --offline` aborts every request that is not the page under test, at the route level, so an accidental external fetch fails the run rather than silently succeeding.
- New `release` scenario: drives the **release build only through its real controls and its real HUD**, with no debug API at all. It reads gold, HP, wave, LIT, palette lock states and the core button's price straight from the DOM, and buys the next item on a shopping list whenever the HUD says it can afford it.
- `docs/design-intent.md` written (454 words of body text, 496 including headings, seven sections in order) and `tools/make_docx.py` added to turn it into `dist/design-intent.docx`; `python-docx` was installed so the .docx is generated rather than left to the human.
- `SUBMISSION_NOTES.md` written.

**Problems found:**

1. The release build still contained two `if (R.debug)` branches — dead code for a module that never ships, and exactly the kind of leftover scaffolding a code reviewer would notice.

**Fixes:**

1. The debug module now attaches itself: it installs `window.__REFRACT` on `DOMContentLoaded` and, at level 2, wraps `R.render.draw` to add its panel update. The game module has no reference to it at all. Verified: the shipped `index.html` contains zero occurrences of the string "debug", and `tools/check.js` now fails the release if any appear.

**Browser testing — the packaged artifact, played offline:**

`dist/refract.zip` was extracted into a clean empty folder, served from that folder alone, and opened with every non-local request aborted.

- **Won all twelve waves using nothing but taps**, in 249 s of real time at 2x speed: "THE LIGHT HELD", 5 core HP left, LIT 23/25, score 1837, all eleven planned purchases made through the palette and the CORE button.
- PLAY AGAIN returned a clean board (40 gold, 20 HP, LIT 1, no overlay), and a second run with nothing placed lost on wave 3 with the coverage tip and a TRY AGAIN button.
- **Exactly two requests** for the whole session: the page and `vendor/three.min.js`.
- No automation API, no debug panel, no debug module; the page title is REFRACT.
- Console: no messages from our code.
- The same build was checked at 390x844, 360x800, 393x852, 430x932, 360x640 and a 1280x800 desktop window, all offline, all passing.
- The build also loads and runs from a `file://` URL, again with exactly two file reads.

**Zip contents, verified by reopening the archive:**

```
index.html                160,979 bytes
vendor/three.min.js       608,081 bytes
vendor/LICENSE-three.txt    1,081 bytes
dist/refract.zip          196,404 bytes (0.19 MB) against a 35 MB limit
```

`index.html` is 5,402 lines, longest line 170 characters, with a banner comment naming each of the twelve source files, and opens with a generated header listing them in load order. Greps of the shipped file: zero occurrences of `console.`, `eval(`, `new Function`, `__REFRACT`, `debug`, `http`, `fetch`, `XMLHttpRequest`, `WebSocket`, `import(`, `serviceWorker`. Two occurrences of `localStorage`, both inside the guarded helpers.

**Decisions locked:** No changes to Part 1. Added: the development tools attach themselves to the game rather than being called from it, so the release build carries no reference to them.

**Balance changes:** none.

**Result:** The exact file that will be uploaded has been played to a win and to a loss, offline, from a clean unzip, using only the controls a player has.

**Next step:** Phase 13 — the full acceptance checklist.


### Session 1 — 2026-09-04 — Phase 13: browser QA and acceptance

**Goal:** Execute the acceptance tests in specification section 35 and the browser checklist in section 34, answer the autonomous playtest questions honestly, and fix whatever turns up.

**Direction:** `MASTER_SPEC.md` section 33 Phase 13.

**Tools:** Claude Code with the Claude Opus model; the sixteen-scenario Playwright suite; the packaged zip served from a clean folder with all non-local requests aborted; a live Chrome tab driven with real mouse input.

**Work completed:**

- New `acceptance` scenario covering the section 35 items that had no measurement yet: escalation between two waves with an identical build, the opening-fifteen-seconds rule, a click-every-control audit, a placeholder-text sweep across five screens, three consecutive full runs, endless continuation, two hundred rapid button presses, and placing, flipping and selling on all ninety-six tiles.
- The whole suite run at 390x844, 360x800 and 430x932.
- The packaged release build played offline to a win and a loss at 390x844 and again at 360x800.
- The release build's layout checked offline at all five phone sizes and a desktop window.
- A real Chrome pass on the packaged build with real mouse clicks.

**Test-only fix:** the wave-11 frame-gap assertion failed at 430x932 because headless Chromium rasterises in software at deviceScaleFactor 3 and clamps `requestAnimationFrame`; a direct probe showed the renderer itself costing 0.3 ms. The assertion now measures the renderer cost we own and logs the observed gap as an environment note, with the real frame rate coming from the GPU run.

**Acceptance tests (section 35), each with the evidence:**

- **Loads from a static server.** Every scenario; load times 0.58–0.99 s.
- **Works with internet disabled.** `dist/refract.zip` extracted into an empty folder, served from that folder, every non-local request aborted at the route level: won twelve waves at 390x844 and again at 360x800.
- **No remote dependency.** Greps of the shipped file: zero `http`, `fetch`, `XMLHttpRequest`, `WebSocket`, `import(`, `serviceWorker`.
- **No unexpected requests.** Exactly two per session, `GET /` and `GET /vendor/three.min.js`, in every run including the offline ones and the `file://` load.
- **Portrait layout at every size.** 390x844, 360x800, 393x852, 430x932 pass the full `mobile` audit; 360x640 also passes with a 33.7 px cell. Cells 46.7 / 43.1 / 47.0 / 51.4 / 33.7 px.
- **Touch only, no hover.** A whole twelve-wave run completed with nothing but taps at 360x800 (`handplay`), and again on the release build through its real HUD.
- **Core loop starts within 15 s of PLAY.** The beam is already lighting a road cell behind the title card (LIT 1); PLAY sets a 10 s countdown.
- **First action understandable from the hint.** "Tap a tile on the beam to bend it along the road." appears on PLAY and is replaced by the flip/move/sell hint after the first placement.
- **Core loop playable.** place → wave → gold → spend → next wave, measured end to end in `waves`, `handplay` and `release`.
- **Progression within one sitting.** Unlocks at waves 2, 4 and 7; core levels 1–6 measured at 10/13/17/22/28/35 beam power; LIT climbing from 1 to 23; six enemy types.
- **Escalation noticeable.** Identical build (one mirror at (7,3)): **wave 3 kills all 9 enemies for 0 HP; wave 8 kills 0 of 20 and costs the full 20 HP.**
- **Strategic decisions matter.** Ten bot strategies finish on waves 3, 3, 5, 7, 7, 7, 7, 12, 12, 12. Direction measured: against the flow puts 10 damage into the leading brute and 6.9 into the three motes behind it; with the flow, 4.2 and 23.1.
- **Loss, victory, endless.** All three reached in the release build; the defeat tip matches the dominant leak type in four forced scenarios.
- **Restart fully resets.** Five consecutive restarts produce byte-identical snapshots, with geometries, textures and scene objects unchanged.
- **Multiple consecutive runs.** Three full twelve-wave runs without reloading, all reaching victory with identical results and no draw-call creep.
- **No console errors or warnings from our code**, in every scenario. The only console output in headless is the GPU driver's own "ReadPixels" note during screenshots.
- **No unfinished UI.** Every control was clicked and observed to change state: speed, mute, help (open and close), pause (and resume), core upgrade, two palette buttons, next wave. No "TODO", "TBD", "FIXME", "Lorem", "placeholder", "coming soon", "undefined", "NaN" or "null" appears on the board, help, victory, defeat or title screens.
- **No placeholder mechanics.** Every piece and enemy type is measured against its specified behaviour in the unit tests and the browser suite.
- **Performance.** 0.73 ms of our own work per frame at the peak board; worst frame 11.9 ms under 4x CPU throttling; 6.1 ms median frame gap on a GPU; 28 draw calls.
- **Genre obvious from one screenshot.** `shots/legibility-390x844-dsf1.png` is a 1:1 pixel capture of mid-wave play: a winding road with direction chevrons, a defended core in the bottom corner, enemies with HP bars, WAVE and gold counters, and a four-button defense palette across the base.
- **Packaging.** 0.19 MB zip, `index.html` at the root, `vendor/` alongside, readable unminified code with a banner comment per source file, Three.js only in `vendor/` by relative path with its licence.
- **Release build has no debug code.** Zero occurrences of `__REFRACT`, `debugPanel`, `?debug` handling, or even the word "debug"; the compliance checker fails the build if any appear.
- **Nothing addressed to evaluators, no personal information.** `tools/scan-artifacts.js` checks the shipped `index.html`, the build log, the design intent and the submission notes for email addresses, machine paths, profile links, the author's own git name and email, placeholder markers and evaluator-directed text.
- **Simulation identical at 30/60/120 Hz** (and 144): the same enemy arrives at 5.9 s of simulated time at every rate.
- **Works with `localStorage` blocked and audio unavailable**: both verified by deleting the API and by making the property throw.

**Real-browser pass (Chrome, real mouse input, packaged build served from the clean unzip):** clicked PLAY, then tiles (7,3), (0,3) and (0,10); the mirrors placed, the beam bent through the chain, LIT read 12/25 and the run reached wave 5 with 20 HP and 201 gold. The beam was visibly red and thin along the stretch of road behind a brute and white in front of it. Gold floaters arced to the counter. Hiding the tab paused the game and showed the PAUSED overlay; the help button opened HOW TO PLAY and paused the wave, and closing it resumed; mute toggled both ways; speed toggled 1x to 2x and back.

**Autonomous playtest answers (section 34), answered honestly:**

- *Is the goal obvious within 10 seconds?* Yes. The title card gives the premise in one line, and the board opens with the beam already burning the one road cell it touches, a countdown running, and a hint naming the exact first action.
- *Is the first interaction clear?* Yes. One tap on the beam's column bends it, and the smart orientation picks the direction that lights the most road, so a first tap almost always looks like a good move.
- *Is placing a mirror satisfying?* Yes, more so since the sweep, the pop and the placement chime. The strongest moment is the first tap at (7,3): the beam travels out and six road cells light up at once.
- *Does the loop work without explanation?* Mostly. Place, watch, spend, repeat is carried by the incoming strip and the LIT counter. The one rule that is not obvious from play alone is that direction matters; the brute hint is the only in-play teaching for it, and the help screen carries the full explanation. A tester who never opens help will probably discover shielding by accident around wave 5 rather than reason about it.
- *Meaningful decision each wave?* Yes, and it is measurable: spreading the beam thin loses (wave 7 with LIT 21) while concentrating it wins (wave 12 with LIT 12), and lamps are three times more gold-efficient than the last core level.
- *Does progression visibly affect play?* Yes: the beam thickens and brightens with each core level, unlocks flash into the palette at waves 2, 4 and 7, and LIT climbs from 1 to 23.
- *Does difficulty escalate legibly?* Yes, sharply: the same build clears wave 3 without a scratch and loses the whole core on wave 8.
- *Can the tester say why they lost?* The defeat screen names the cause: brutes shielding, swarms draining, runners crossing too fast, or simply not enough road lit.
- *Any exploits?* None that pay. Buying and selling in a loop is exactly break-even inside the undo window and loses 30 percent outside it. Early-calling every wave is worth 8 percent of a run's income and is recorded as an accepted tempo reward rather than a trade-off it is not.
- *Does restart work perfectly?* Yes: five restarts produce byte-identical state with no mesh, geometry or listener growth.
- *Does it encourage another run?* The result screen shows the score and the best score and puts PLAY AGAIN under the thumb; after a win, CONTINUE keeps the same board going into endless. A tester who lost on wave 8 has an obvious next move, which is the honest test of whether the tip worked.

**Problems found:** one test-environment assertion (above). No game defects.

**Decisions locked:** No changes to Part 1.

**Balance changes:** none.

**Result:** 26 Node tests and 379 browser checks across sixteen scenarios pass at 390x844, and the whole suite also passes at 360x800 and 430x932. Every box in section 35 is ticked with the evidence recorded above.

**Next step:** Phase 14 — final packaging.


### Session 1 — 2026-09-04 — Phase 14: final packaging

**Goal:** Produce the three submission artifacts and prove the exact zip that will be uploaded plays offline from a clean unzip.

**Direction:** `MASTER_SPEC.md` section 33 Phase 14 and section 41.

**Tools:** Claude Code with the Claude Opus model; `tools/package.js`; Playwright with all non-local requests aborted.

**Work completed:**

- Part 1 of this log rewritten to match what is actually locked, including every decision added during the build and the tuned balance values, as the build-log procedure requires.
- `node tools/package.js` run to produce all three artifacts in one pass: release build, compliance check, unit tests, zip, `dist/buildlog.md`, `dist/design-intent.docx`, artifact scan.
- `docs/design-intent.md` reduced to pure ASCII (the two em dashes became hyphens) so nothing can go wrong when the text is pasted into the official template.
- `SUBMISSION_NOTES.md` written: what to upload, which genre to select, the one manual step, and how to rebuild.

**Edge case closed:** the "device with no WebGL" case from specification section 31 had never been exercised in a browser. A first attempt to test it by overriding `HTMLCanvasElement.prototype.getContext` did not actually block Three.js, which resolves the context in a way that bypassed the patched prototype — the test reported a failure that was not real. Re-run with the browser itself started with `--disable-webgl --disable-webgl2 --disable-3d-apis`, the game behaves correctly: `R.render.ready` stays false, `R.running` stays false, and the page shows the full-screen message "This device cannot run WebGL." Tapping around afterwards throws nothing. Three.js logs its own console errors before throwing on such a device; the test runner now classifies those as library messages rather than ours, which is what they are.

**Problem found:** the artifact scanner failed the build log for containing the words "placeholder", "reviewer", "evaluator" and "AI tool". Every occurrence is the log describing the compliance work — for example, listing the placeholder markers the tests sweep for.

**Fix:** the scanner now applies the placeholder-text and evaluator-directed-text rules to what a judge reads as the entry itself (the game and the design intent) and keeps the personal-information rules on all four files. The reasoning is written into the file so the narrowing is visible rather than silent. The build log remains the one file allowed to name the AI tools used, because the official build-log guidance asks for that.

**Final artifacts:**

```
dist/refract.zip          196,404 bytes (0.19 MB)  sha256 0ada0b55…
  index.html              160,979 bytes   5,401 lines, longest line 170 characters
  vendor/three.min.js     608,081 bytes   Three.js r149 UMD, unmodified
  vendor/LICENSE-three.txt  1,081 bytes
dist/buildlog.md           90,118 bytes   byte-identical to BUILD_LOG.md
dist/design-intent.docx    38,103 bytes   7 sections in order, 454 body words, 496 with headings
```

The shipped `index.html` has exactly one external reference, `src="vendor/three.min.js"`, and twelve inline script blocks, each opening with a banner comment naming its source file.

**Final browser test — the exact uploadable zip:** extracted into an empty folder, served from that folder alone, every non-local request aborted at the route level, played through the real HUD with no debug tools of any kind:

- **THE LIGHT HELD — twelve waves cleared, 11 of 20 core HP left, 23 of 25 road cells lit, score 1921**, in 256 s of real time at double speed.
- PLAY AGAIN returned a clean board, and a second run with nothing placed lost on wave 3 with the coverage tip.
- Exactly two requests for the whole session.

**Final compliance checklist (specification section 44):**

- [x] **Single-player; no networking code.** No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon` or dynamic `import` anywhere in the shipped file; the compliance checker fails the build on any of them.
- [x] **Fixed portrait layout; never reflows to landscape.** The portrait column is kept and centred at every window size; landscape shows the same column on side bars with a "Best played in portrait" caption. Verified at 844x390 and back.
- [x] **`index.html` at zip root; all own code inside it; unminified and readable.** 5,401 lines, longest line 170 characters, a banner comment per source file, and a generated header listing the twelve sources in load order.
- [x] **Three.js only in `vendor/three.min.js`, referenced relatively, licence included.** sha256 pinned in the checker; the file is byte-identical to the published r149 UMD build.
- [x] **No external requests at runtime.** Two requests per session, verified with the network fully blocked and also from a `file://` URL.
- [x] **Core loop: repeatable action, real-time feedback, clear goal, win/lose/reset, progression in one session.** Place → wave → gold → spend → next wave, twelve waves to a win, endless afterwards, all reached in the packaged build.
- [x] **Genre elements obvious.** Placeable defenses on a palette, a defended core, a winding road with direction chevrons, escalating waves, and spend decisions between pieces and core power.
- [x] **Nothing half-finished; no stubs; no placeholder text.** Every control was clicked and observed to change state; five screens swept for placeholder words.
- [x] **Legible pieces and state at a glance.** Checked on a 1:1 pixel capture at 390 px wide.
- [x] **Zip ≤ 35 MB.** 0.19 MB.
- [x] **Build log in Markdown as `buildlog.md`, two parts, honest, no names.**
- [x] **Design intent, ≤ 500 words, seven fixed sections, no identifying information.** 454 body words, 496 including headings, pure ASCII.
- [x] **No embedded instructions or text aimed at evaluators or AI tools anywhere in the build.** Enforced by `tools/check.js` on every build.
- [x] **All text in English.** The only non-ASCII character in the shipped file is the multiplication sign in the speed button.
- [x] **Genre to select: Tower Defense & Strategy.** Recorded in `SUBMISSION_NOTES.md`.
- [ ] **Uploaded before September 8, 2026, 1:00 PM PDT.** The only item a person has to do; the artifacts are ready in `dist/`.

**Decisions locked:** No changes beyond the Part 1 rewrite described above.

**Balance changes:** none.

**Result:** All three submission artifacts are built, verified and sitting in `dist/`.

Final test totals: **26 Node unit tests and 402 browser checks across eighteen scenarios** — 380 in the sixteen-scenario suite (run at 390x844, 360x800 and 430x932), plus 16 in the offline release scenario and 6 in the no-WebGL scenario. The Phase 13 entry quoted 379 for the suite; the exact figure is 380, and that entry is left as written rather than edited after the fact.

**Next step:** upload. `SUBMISSION_NOTES.md` says exactly what to attach and what to select.


### Session 2 — 2026-09-04 — Map design pass: "Stairway" replaced by "Switchback"

**Goal:** The board had plenty of empty cells but too few *optically meaningful* ones. Redesign the fixed road so all four piece types earn a place and several genuinely different light networks exist.

**Direction:** Keep the portrait 8x12 board, the core near the bottom and the spawn near the top. Longer routing corridors, open extension space at both ends of the major segments, meaningful splitter branches and reflector endpoints, an independent lamp network, three or four viable layouts, and no single mirror chain that solves the map. Evaluate specifically with all four tools unlocked.

**Tools:** Claude Code with the Claude Opus model; a new headless map evaluator (`tools/map-lab.js` and `tools/map-candidates.js`); the sixteen-scenario Playwright suite plus a new `lattice` scenario.

**Work completed:**

- **Built an evaluator before changing anything.** `tools/map-lab.js` loads the real solver headlessly, swaps in a candidate road, and reports: every straight run with whether each end has a buildable cell in line; how many single mirrors light four or more cells; what a greedy engineer builds at a fixed budget under five different toolsets, so it is visible whether each piece type ever earns a slot; and how many distinct openings lead to builds within 15% of the best. `tools/map-candidates.js` writes each candidate as a start cell plus legs and validates that the path is a single orthogonal walk that never leaves the board or crosses itself, which caught two malformed candidates immediately.
- Six candidates were measured against the shipped map, then two refinements of the best one.
- **"Switchback" adopted.** Four long sweeps at rows 2, 4, 6 and 8, joined by three-cell connectors in columns 1 and 6, with columns 0 and 7 clear top to bottom. 31 road cells, spawn (5,0), core (7,11).
- Specification section 12.2 rewritten with the new path, ASCII map and the design rationale; every `LIT n/25` reference updated to `/31`.

**The measured problem with the old map:**

```
                     road  runs open   single mirrors   distinct   splitter  reflector  lamp
                    cells  both ends   lighting 4+       openings    used      used     used
Stairway (shipped)     25          4                2           2      yes        no     yes
Switchback (new)       31          8                4           4      yes       yes     yes
```

Only two tiles on the whole old board were worth a first mirror, and the greedy engineer never bought a reflector at any budget. That is the sandbox problem, stated numerically.

**A measurement bug found and fixed while doing this.** The first version of the evaluator scored a layout by the brightest beam crossing each road cell. That reading cannot see a Reflector at all: a 60% return pass over a cell already lit at 100% adds nothing to the maximum. It reported "reflector NOT USED" on every candidate including ones where the reflector is obviously good. The evaluator now parks a zero-absorption probe on every road cell and runs the real solver for one second, so the number is damage per second actually delivered and every pass counts separately. Reflectors immediately showed a 60% gain on maps that suit them.

**Why Switchback is better, in the game's own terms:**

- **Column 7 became a trunk instead of a wall.** The core beam runs up past all four sweeps. Light meets the lowest piece first, so a mirror at (7,8) claims the row 8 sweep and starves everything above it. Reaching a second sweep costs either a splitter on the trunk or a chain out to column 0 and back. Splitters are now structural rather than a nice-to-have.
- **Eight of ten straight runs are open at both ends** (four of six before). Every sweep can be entered from either side, so beam direction is a real choice on each of them rather than a property of the map.
- **Columns 0 and 7 are clear top to bottom**, which is what gives a Reflector a meaningful endpoint and a Lamp on column 0 a network that never touches the core's chain.
- Four different opening mirrors — (7,2), (7,4), (7,6), (7,8) — are within 15% of each other, so there is no single obvious first move.

**Late-game evaluation with all four tools unlocked** (new `lattice` scenario, core level 6, wave 11 running, damage per second measured with probes):

```
layout                        LIT     dps  segments  pieces  types used
trunk split three ways      19/31     278         7       3  mirror splitter
chain around the left trunk 13/31     455         6       5  mirror
reflector double pass       13/31     411        13       4  mirror reflector splitter
independent lamp network    22/31     578         8       5  lamp mirror
full lattice                23/31     423        18       8  all four
```

Four of the five are within 40% of the best, and they differ in shape (LIT 13 to 23) rather than being the same build at different power. The full lattice draws **18 beam segments** across the board and uses all four piece types — that is the "lattice of light" the design is aiming at, and `shots/lattice-390x844-full-lattice.png` shows it: four horizontal beams crossing the board, two lamps running independent lines up the left edge, splitters feeding the trunk on the right, and a reflector sending a second pass back along row 6.

**Balance changes (before → after, with the reason):**

| Value | Before | After | Reason |
|---|---|---|---|
| `HP_MULT_PER_WAVE` | 0.20 | **0.14** | Switchback is 24% more road, so the same beam covers a smaller fraction of it and brutes survive to the core. At 0.20 the informed line reached wave 12 and died with seven brute leaks. Measured at 0.16 and 0.12 as well; 0.14 is where the informed line wins with 11 HP. |
| `WAVE_CLEAR_PER_WAVE` | 3 | **7** | The bigger board gives the player more worth buying, so income scales with it. At the old rate the informed player could afford coverage or core power but not both, and the run ended one wave short regardless of `HP_MULT`. |

Smart orientation also gained a tiebreak: when two orientations put the same power on the road, it now prefers the one whose light travels further. On Switchback a chain's middle mirror is a setup move that pays nothing immediately, and without the tiebreak it oriented itself off the board and the player had to flip it. The primary term is unchanged.

**Measured strategy table at the final values** (full runs, real economy, no free gold):

```
strategy               result   wave hp  lit core pcs earned  score
nothing                lost        3   0    1    1   0     45    145
core only              lost        3   0    1    2   0     45    145
mirrors only           lost        7   0    7    1   9    398    698
first timer            lost       10   0    7    4   3    832   1282
one mirror then lamps  lost        7   0   24    1   4    407    707
splitter spread        lost       12   0   19    6   3   1231   1781
reflector              lost       11   0    7    6   2   1056   1556
informed               won        12  11   25    6   6   1523   2233
informed, early calls  won        12  20   25    6   6   1669   2469
sell and rebuy loop    won        12   4   13    6   3   1439   2079
```

All the section 15 targets hold: placing nothing loses on wave 3, the informed line wins with 11 core HP inside the 6 to 14 band, no single purchase type wins alone, and the strategies spread from wave 3 to 12.

**One target band widened, recorded rather than fitted.** The specification says a first-time player following the hints reaches wave 6 to 9; the naive bot now reaches wave 10 because Switchback is a longer road and enemies are exposed for longer. The band was widened to 6-10 rather than tuning the bot's shopping list until it landed inside the old one, which would have been fitting the test to the answer.

**Problems found:**

1. The evaluator's own scoring could not see reflectors (above).
2. Two candidate maps in the first draft left the board; the path validator caught both before they were ever measured.
3. Roughly forty assertions across the browser suite hard-coded old-map coordinates, HP figures and gold arithmetic.
4. A patch script asserted on exact text and aborted partway, leaving some scenarios updated and others not, which produced a confusing mixture of real and stale failures.

**Fixes:**

1. Probe-based damage measurement.
2. Path validation kept as a permanent part of the candidate file.
3. All assertions updated to the new geometry and the tuned balance.
4. The remaining patches were applied tolerantly, reporting which replacements did not match instead of stopping, and the suite was re-run after each batch.

**Decisions locked:** The map is now "Switchback" (Part 1 updated). Added: smart orientation breaks ties by how far the light travels.

**Result:** 26 Node tests and all sixteen browser scenarios pass on the new map, plus a new `lattice` scenario with 5 checks. `node tools/build.js && node tools/check.js` passes.

**Next step:** repackage the submission artifacts, then the visual polish pass that was deferred until the map supported the late-game fantasy.

---

## Session 4 - First redesign pass (acting on GPT_Advice revision 1)

**Goal:** Act on the owner's redesign brief. Its findings: a static three-mirror layout cleared all twelve waves, the boss could reach the core without preventing victory, the LIT statistic rewarded broad weak light over a high-damage route, and a run took about nine minutes with a long passive tail.

**Implemented.**

- *Terminal rules.* A boss reaching the core sets `state.bossBreached`; the run is lost on the next simulation step regardless of core HP (`06_enemies.js`, `11_game.js`). Previously Umbra's 10-point leak against 20 core HP left the player alive and the wave then completed as a win.
- *Session shape.* Twelve waves replaced by five encounter beats, each testing a different distribution of light. Unlocks moved to waves 2 / 3 / 4 so every tool exists before the boss.
- *Two readings.* The solver accumulates `pressure`, the beam power reaching enemies, summed in the same traversal as damage so preview and combat cannot disagree. The HUD stat that read `LIT n/31` became `PWR n  COV n`.

**Balance changes, before to after, with the playtest reason.**

| Tunable | Before | After | Reason |
| --- | --- | --- | --- |
| `WAVES` | 12 waves | 5 beats | Nine-minute session with a passive tail; measured 222-232s after the change. |
| `UNLOCK_WAVE` | 2 / 4 / 7 | 2 / 3 / 4 | Reflector and Lamp unlocked after the session now ends. |
| `START_GOLD` | 40 | 60 | Fewer clear bonuses; without this the first two beats had no purchase decision. |
| `WAVE_CLEAR_BASE` / `PER_WAVE` | 12 / 7 | 30 / 22 | Keep total income in the range that makes the four-piece palette reachable. |
| `HP_MULT_PER_WAVE` | 0.14 | 0.34 | Five beats must escalate as hard as twelve gentle ones did. |
| `COUNTDOWN` | 8 | 10 | Session measured 222s, under the four-minute floor; this put it at 230s. |
| `umbra.hp` | 900 | 520 | Measured: against a maxed six-piece lattice Umbra took 708 of 900 over an 80s walk, so it was unkillable and the breach rule turned every run into a loss. At 620 it died on the final step, too tight to be anything but flaky. At 520 it dies at about 70s of 80. |
| `SPLIT_FACTOR` | 0.55 | 0.5 | The brief proposed 0.425 (85% total). At that value splitter builds fell to 200 dps against a 578 best and `lattice` dropped to 2 viable layouts of 5. At 0.5 it is back to 4 of 5, and "half each way" reads better than 42.5%. |

**What did not work.** 85% splitter output as specified (undone, evidence above). Umbra at 620 HP (no margin; undone).

**Test changes.** About thirty assertions hard-coded the old balance. They were rewritten to derive expectations from `R.BALANCE` at runtime. Two checks were reframed rather than renumbered: with a fixed-length session, "which wave did you reach" no longer separates strategies, so `builds` and `bots` compare final core HP and win rate.

**Evidence.** `test-beam.js` 26 tests pass. `build.js && check.js` pass. Browser suite at 390x844 all passing: layout 8, beam 23, waves 29, runstates 50, toolset 56, escalation 33, builds 4, teaching 33, mobile 32, landscape 9, handplay 3, feel 26, audio 23, bots 14, perf 17, acceptance 33, lattice 5, bossgate 7. `release` against a real release build served by `tools/static.js`: 16 checks, and the tap-only playthrough wins with 14 of 20 core HP in 141s at 2x speed. Zero console messages from our code. Network limited to `index.html` and `vendor/three.min.js`.

**Known pre-existing failure:** `nowebgl` fails 5 of 6 checks because this Chromium ignores the harness's attempt to disable WebGL, so the fallback path is never exercised. Verified identical by stashing this session's changes and re-running against the previous commit. The fallback code is unchanged.

**Superseded during the session.** Revision 2 of the brief arrived while this pass was being tested. It supersedes revision 1 and reverses one item built here: revision 1 required the static three-mirror layout to lose, revision 2 says explicitly not to punish a stable defense merely because it is stable. The `bossgate` assertion encoding that rule is recorded as needing revision in session 5.

**Result:** All browser scenarios that can run in this environment pass. A full session measures 222-232s simulated, about 4.7 minutes of real play. This is a working checkpoint, committed before starting the revision 2 work.

---

## Session 5 - Revision 2 of the brief

**Input:** `GPT_Advice.docx` revision 2, dated 8 September 2026, which supersedes revision 1. It is a substantially larger brief: eight encounters, two previewed entry routes, a directional-shield enemy, two upgrade choices, a two-phase boss, an untimed planning phase and an integrated tutorial. It also reverses one thing session 4 built: revision 1 required the static three-mirror layout to lose, revision 2 says explicitly not to punish a stable defence for being stable, and asks that the improvement from adapting be demonstrated before the boss rather than by the boss-escape rule alone.

**Implemented in this pass.**

*Planning is untimed.* The countdown is gone. `simStep` no longer advances anything during `building`; `R.startWave` is the only way into an encounter and the action button reads START WAVE n. The early-call gold bonus is removed entirely, so reading the board slowly costs nothing and starting quickly earns nothing. `R.pieces.isPlanning` gates the two forgiving rules: a piece moved during planning is never inactive, and selling during planning returns the price that piece was actually paid for. Mid-combat, a moved piece goes dark for `MOVE_REFORM` and a sale returns `SELL_RATE`. The refund is always the price paid, so the rising lamp price cannot be arbitraged.

*Eight encounters* replacing five, in the learning order the brief sets out: one lesson at a time, shields introduced at encounter 4 and never shown before it, everything combined at 7, Umbra at 8.

*Bulwark, with directional shielding.* Brute is renamed and reworked. Two constants now govern a body: `absorb`, how much of the beam it removes from what continues behind it, and `shield`, how much damage is deflected when light meets the face it is walking towards. Light reaching a flank or a back is not reduced at all. Facing is derived from the walk direction in `positionOf`, so it is never hand-set and always matches what is drawn. A shield reduces damage and never confers immunity.

*Umbra has two phases.* It advances behind its shield and drops it at 45 percent of the road, announced with a `bossphase` event. 56 s on the road, inside the brief's 45 to 60 s window.

*Both endings say which one happened.* A boss breach gets its own heading, its own one-line reason naming the core HP still standing, and its own advice. An ordinary loss is unchanged.

*Coverage demoted.* Revision 1 had put a damage figure (PWR) in the HUD. Revision 2 says to keep coverage secondary and expose damage telemetry only in development, so the HUD stat is now COVER n / 31 and the pressure figure the solver computes stays in the debug panel. The planning strip names the next formation in words rather than counting down.

*Shield made visible.* The shell that used to sit on every brute now renders only on shielded bodies, offset onto the face they walk towards, and flares pale blue when light is turned away by it. A landed hit keeps the white burn.

**Balance changes, before to after, with the reason.**

| Tunable | Before | After | Reason |
| --- | --- | --- | --- |
| `WAVES` | 5 beats | 8 encounters | Revision 2 sets eight as the initial complete arc. |
| `UNLOCK_WAVE` | 2 / 3 / 4 | 3 / 4 / 5 | Each tool now arrives just before the encounter that wants it. |
| `HP_MULT_PER_WAVE` | 0.34 | 0.2 | Eight encounters rather than five, same total escalation. |
| `WAVE_CLEAR_BASE` / `PER_WAVE` | 30 / 22 | 24 / 12 | Eight clear bonuses instead of five; total income held roughly level. |
| `MOVE_REFORM` | 0.75 | 0.3 | The brief asks for about 0.3 s, and editing during planning is free anyway. |
| `EARLY_CALL_RATE`, `COUNTDOWN`, `FIRST_COUNTDOWN` | 1.0 / 10 / 10 | removed | Planning waits for the player. |
| `bulwark.shield` | n/a | 0.75, then 0.60 | At 0.75 no strategy in the `bots` suite won. The mirror builds this map naturally produces light the sweeps head on, which is exactly the shielded angle, so Bulwarks leaked in every run. 0.60 keeps the lesson and leaves the encounter winnable. |
| `bulwark` hp / leak | 120 / 3 | 95 / 2 | Same measurement: seven Bulwark leaks per run was killing every build. |
| `umbra` | 520 hp, speed 0.40, shield 0.70 flat | 430 hp, speed 0.55, shield 0.70 then 0 | The flat shield made the boss survive its whole walk again. Phases fixed it properly, and the faster walk brings the encounter to 56 s. |

**What did not work.**

- Bulwark shield at 0.75. Zero of ten scripted strategies won. Recorded and reduced rather than left in.
- The first attempt at a shield-facing test compared two different builds delivering different beam power, so it measured beam order rather than facing. Replaced with a test that lights two sweeps walked in opposite directions, giving identical power from the core: 2.5 damage into the face against 10 into the back, exactly the shield constant.
- Hand-setting an enemy facing inside a test does not hold, because `positionOf` recomputes it from the path every step. That is the right behaviour; the test was wrong.

**Test changes.** The whole suite assumed waves start themselves; every scripted run now asks for each encounter, through a new `__REFRACT.startWave()` and `playWave()`. `brute` renamed throughout. Two new scenarios: `shield` (12 checks: the exposure rule from all four sides at identical power, and that an unshielded body is exposed from every side) and `endings` (11 checks: both loss screens and the boss phase change). `bossgate` was rewritten to match revision 2 and no longer requires the static layout to lose. It runs the static three-mirror baseline and an adapted network side by side and requires the adapted one to end in better shape, with the gap already open before the last encounter.

**Honest reading of the static baseline.** The static three-mirror layout with no core upgrades reaches encounter 6 and loses with 0 HP. The same three mirrors plus a splitter, two lamps and four core upgrades reaches encounter 8 and loses to an Umbra breach with 8 HP. A full informed build wins with 10 to 16 HP. Adapting is worth doing and the gap opens well before the boss, but the static layout is not artificially punished: it runs out of answers when shields arrive.

**Evidence.** `test-beam.js` 26 tests pass. `build.js && check.js` pass on the release build. All 21 browser scenarios pass at 390x844: layout 8, beam 23, waves 29, runstates 54, toolset 57, escalation 34, builds 4, teaching 34, mobile 32, landscape 9, handplay 3, feel 26, audio 23, bots 15, perf 17, acceptance 33, lattice 5, bossgate 9, shield 12, endings 11, plus `release` 16 against a real release build served from `tools/static.js`. The release tap-only playthrough clears all eight encounters with 12 of 20 core HP in 182 s at 2x speed, driving START WAVE by tapping like a player. `bots`: nothing and core-only lose at encounter 3; a first-timer reaches Umbra and loses at 4 HP; informed wins at 10 HP; three of ten strategies win. Zero console messages from our code. Network limited to `index.html` and `vendor/three.min.js`.

**Still not implemented from revision 2.** Listed so they are not mistaken for done:

1. *Two previewed entry routes.* The map is still single-entry Switchback. This is the largest remaining item and needs a map redesign plus preview UI.
2. *The two upgrade choices* after encounters 2 and 5 (Crossfire, Afterglow, Piercing Light, Return Current, Focused Core, Twin Flames). Not started.
3. *The integrated playable tutorial* in encounter 1. The existing hint system covers part of it; the guided first placement does not exist.
4. *Reflector as an amplifier.* Still a 60 percent return pass.
5. *Core power dominance.* A single mirror plus a maxed core still clears the arc in the ceiling test, which is the failure mode the brief names. The curve was left alone because changing it invalidates every measurement above.
6. *Unfamiliar-player testing.* None has happened. No claim is made about how the game reads to someone new.

**Result:** A complete, winnable eight-encounter run with an untimed planning phase, a directional-shield enemy, a two-phase boss and two distinguishable endings. Every automated check that can run in this environment passes.

---

## Session 5b - Run upgrades

**Goal:** The progression layer from revision 2, which was the largest remaining engagement item and the one that does not need the map redesign.

**Implemented.** After encounters 2 and 5 the run stops on a choice of three from six. The offer is drawn from the run's own seeded RNG, so a seed always offers the same choices; it never contains something already taken or excluded by something taken. Nothing simulates behind the choice screen, so three descriptions can be read without a clock running. Taken upgrades show as small tags under the incoming strip and are cleared on restart.

| Upgrade | Effect | Decision it creates |
| --- | --- | --- |
| Crossfire | +25% when a body is reached from two different directions in the same step, counted once | build intersections, or add a return pass |
| Afterglow | a hit leaves a refreshable 0.75 s tail at about a third of that power | separated crossings become worth something against fast movers |
| Piercing Light | bodies absorb a quarter less, shields untouched | push power through a dense line instead of going round it |
| Focused Core | core x1.34, lamps x0.66 | commit to one efficient central network |
| Twin Flames | lamps x1.65, core x0.8 | commit to several independent sources |
| Long Reach | splitter branches 0.6 each instead of 0.5 | spreading light costs less |

**Two things the brief warned about, and how each is handled.**

- *Derived lamp power cancelling the trade-off.* Lamp power was `corePower(level) * LAMP_FACTOR`, so anything raising the core raised lamps with it and Focused Core would have been a straight buff. `R.beam.coreOutput` and `R.beam.lampOutput` now scale independently from the same base, and the `upgrades` scenario asserts that Focused Core lowers lamp output while raising core output.
- *Crossfire and Afterglow compounding.* Crossfire is applied once to the step total in `resolveStep`, after the solver has recorded which directions reached each body, so however many beams arrive there is exactly one bonus. The test measures the ratio at 1.25 exactly. Afterglow refreshes rather than stacks and is only added on steps where nothing hit, so the tail can never feed itself; the test walks a body out of the beam to see it and asserts the total stays under twice the in-beam damage.

**Where the upgrade lookups live.** `hasUpgrade`, `upgradeValue` and `eligibleUpgrades` were written into `11_game.js` first, which broke all 26 headless solver tests: that file is not loaded by `tools/test-beam.js`, and the solver reads upgrades on every step. They were moved to `03_state.js`, which is loaded, and the tests went green again.

**A real UI bug the new content exposed.** Adding two help topics pushed the BACK button below the fold, and it could not be tapped. The cause was general: a flex column with `justify-content: center` and `overflow-y: auto` puts content out of reach once it overflows. The long overlays now stack from the top and scroll the list inside its own pane, so the button beneath stays on screen. The same treatment is applied to the choice screen. Verified by eye at 360x640.

**Help screen** rewritten for the current rules: ABSORPTION and SHIELDS are now separate entries, and PLANNING and UPGRADES were added.

**Evidence.** 26 Node tests pass. `build.js && check.js` pass. All 21 browser scenarios pass, plus a new `upgrades` scenario (29 checks: the offer shape at both points, that the run really is stopped while it is up, a with-and-without measurement for every one of the six, the Crossfire ratio, the Afterglow tail, mutual exclusion, and a clean reset). The release build served from `tools/static.js` plays to a win by tapping only, now including tapping the upgrade cards: eight encounters, 10 of 20 core HP, 187 s at 2x speed. `bots` still has three winners of ten, informed at 12 HP, first-timer reaching Umbra and losing at 4 HP, so the upgrades did not flatten the difficulty. Note the scripted bots take whichever upgrade is offered first, which is not good play; a person choosing deliberately should do better.

**Still not implemented from revision 2:** the two previewed entry routes, the guided first-placement tutorial, reflector-as-amplifier, and the core-power dominance question. Unfamiliar-player testing has still not happened and nothing here is a claim about it.

---

## Session 6 - Two entrances, and the guided opening

**Goal:** The two remaining implementable items from revision 2: a second previewed entry route, and a playable opening that teaches the first placement.

### The second entrance, and a design decision taken on measurement

Revision 2 asks for "two clearly marked entry routes" that "meet near the core", with a shared final segment too short to make parking at the core the universal answer. I built that literally first, as a new map called Crossroads: two fully separate roads down each side of the board, 19 and 16 cells, sharing only the last two cells, core at (4,11).

It measured badly, and the numbers are the reason it was not shipped:

- Two separate roads plus their entrances took the routing corridors with them. A greedy build search over five pieces chose **no splitter and no reflector at any budget**, on any toolset. Mirror-only and mirror+splitter produced byte-identical builds. Revision 2's own rule is that a tool with no competitive use should be changed rather than kept to tick a box, and this arrangement made two of the four useless.
- The best single mirror reached 4 of 32 road cells, against 7 of 31 on Switchback, because the core trunk ran up the middle and every road run was vertical while every beam it could make was horizontal.
- Shorter roads roughly halved exposure time. With speeds rescaled to compensate, four of ten strategies won, but two of the four tools were dead weight.

So the second entrance was built onto the proven Switchback body instead: a side gate at (0,3) on the left edge, joining the road at (1,3). Bodies entering there skip the first sweep entirely - seven cells of road. Measured with one mirror lighting that first sweep: the north stream walks past **6 lit road cells, the west stream past 1**. A network built across the top catches one stream and misses the other, which is the decision the second entrance exists to create.

Two placements were tried and rejected before that one:

- Gate at (0,0) running down to join at (1,2). The lead sat on row 2, so the same beam that lit the first sweep also lit the gate, and the skip was worth nothing: both streams took identical damage in a controlled test.
- Gate at (0,3) joining at (1,4). That put road on (0,4), which removed the buildable cell at the west end of the row 4 sweep and cost the map one of its "open at both ends" runs. Moving the join to (1,3) keeps every sweep open at both ends.

The map data is now a shared `trunk` plus a list of `mouths`, each with the cells it adds and the index in the trunk it joins at. That shape made the third attempt a two-line change rather than another rewrite.

**Honest limitation:** this is a weaker reading of the brief than two roads meeting near the core. The distribution decision it creates is real but modest - it is about the first sweep, not about two independent halves of the board. On an 8x12 footprint with four optical tools that need corridors, the measurements said that was the better trade. Recorded here rather than presented as the brief's design.

### The guided opening

`R.refreshSuggestion` asks the solver which single mirror lights the most road and marks that tile on the board with a pulsing outline. It is computed, not written down, so it stays correct if the map or tuning changes; it only appears before the first piece of a run; and it clears the moment anything is placed. Planning is already untimed, so nothing runs while a new player works it out. Measured: taking the suggestion moves coverage from 1 road cell to 7, and the first body down the road takes damage inside the first minute.

### Balance, before to after, with the reason

| Tunable | Before | After | Reason |
| --- | --- | --- | --- |
| map | one entrance | two | The second entrance adds a stream that skips the first sweep, so average exposure per body fell and nothing won until the curve was retuned. |
| `HP_MULT_PER_WAVE` | 0.2 | 0.34 | With the second stream, 0.2 left the strongest build finishing untouched at 20 HP. 0.34 puts an informed win at 12 and keeps weak builds losing. |
| `bulwark` hp | 95 | 80 | At 95 every Bulwark in the run leaked for every build tested; nothing won. |
| `umbra` hp | 430 | 330 | Same measurement: the boss breached in nine of ten runs. |
| `WAVE_CLEAR_BASE` / `PER_WAVE` | 24 / 12 | 26 / 16 | Income had to cover the extra pieces the second stream demands. |

**What did not work, kept here rather than tidied away.**

- The Crossroads map. Two days of the brief's literal design, measured and rejected; reasoning above.
- Flattening `CORE_POWER` from [10,13,17,22,28,35] to [10,12,14,17,20,23] and [10,13,16,19,22,25], to address revision 2's warning about global power. Both curves made **every** strategy lose, including the strongest. The curve is load-bearing. The actual dominance test - a run that buys only core levels and places nothing - already loses at encounter 3, and a single mirror plus a maxed core also loses, so the failure mode the brief names is not present. Restored.
- Reflector-as-amplifier, carried over from my own session 4 notes. Re-reading revision 2, its tool table specifies "a weaker return pass that attacks from the opposite direction" and its tuning seeds say "a 60% reflected return", which is exactly what is implemented. That item was mine, not the brief's, and is withdrawn.

### Evidence

- `node tools/test-beam.js` - 26 tests pass. `node tools/build.js && node tools/check.js` - pass.
- All 23 browser scenarios pass at 390x844: layout 8, beam 23, waves 29, runstates 54, toolset 57, escalation 34, builds 4, teaching 37, mobile 32, landscape 9, handplay 3, feel 26, audio 23, bots 15, perf 17, acceptance 33, lattice 5, bossgate 9, shield 12, endings 11, upgrades 29, plus two new ones: `mouths` (17 checks) and `opening` (13 checks).
- `lattice` still passes, so all four tools remain viable on the shipped map - the check that failed on Crossroads.
- `bots`: nothing and core-only lose at encounter 3; a first-timer reaches Umbra and loses; informed wins at 12 HP; two of ten strategies win.
- Screenshots checked by eye at 360x640: the suggestion marker sits on the trunk where the beam bends, the west gate is drawn dim until the encounter that opens it, and both gates are live and spawning afterwards.

### Still not done

- **No human playtesting.** Nothing in this log is a claim about how the game reads to someone new.
- The second entrance is a side gate on a shared road, not two roads meeting near the core. Reasoning and measurements above.
- Encounter 2's "demonstrate an improved route" and the 45-second shielded-formation lesson are carried by the existing hint and the encounter order, not by a scripted sequence.

---

## Session 7 - Endless

**Goal:** Make endless stop going passive once the board is full, without touching the eight-wave campaign.

### Why it went passive, measured first

A strong static layout at core 6 was run from wave 9 with the old rules:

- **Every endless wave used one gate.** `endlessGroups` never set a route, so the west gate did not exist in endless and a network covering the north road won for ever. This was the single biggest cause.
- **Waves 9, 10, 11, 13 and 14 cost zero HP.** The only damage in twelve waves came from Brute King breaches, which under the campaign rule ended the run outright. So endless was a flat line followed by a cliff, not a curve.
- **Gold piled up unspent** - 2111 by wave 15 - because the board was already as full as it needed to be.
- Scaling was linear unbounded health plus a small speed ramp, which is the "takes longer to kill" failure the brief rules out.

### What was built

*Named encounters, both gates.* Five endless encounters cycle in a fixed order so they can be learned: SPLIT MARCH (both gates at once), SHIELD WALL (a column of shields all facing the way they walk), SWARM TIDE (packed tightly enough to drink the beam), RUNNER BREAK (barely in the light), VANGUARD (a Brute King, escorted). Each has a name and one line saying what it wants, both shown in the strip during planning. Every endless encounter now uses both gates - verified for ten consecutive waves.

*Health stops climbing.* `hpMult` is capped in endless at x2.2 and only there; the campaign curve is untouched. What grows instead is shape: shields per wall, bodies per tide, and spacing down to a floor.

*A boss breach no longer ends endless.* The campaign is won by destroying Umbra, so a boss reaching the core ends that run. Endless has no victory to protect, so a Brute King that gets through lands its heavy hit and the run continues. That alone turned the ending from a cliff into a curve.

*Temporary cuts.* Three authored cuts run from one point on the road to another through cells the sweeps do not use. One opens every third wave from wave 11, lasts two waves, and is then removed and the road restored. They are chosen and drawn during planning and never change while bodies are walking. A cut is only ever offered when every cell it needs is empty, so nothing bought is displaced or destroyed. While one is open, 60% of the encounter walks it. The strip names it and says how many waves it has left.

*A limit on powered pieces.* Endless powers five pieces at once. Pieces past the limit are not sold or removed - they go idle, keep their place and their price, are drawn faint, and can be swapped in and out during planning for nothing. Placing a sixth is refused with a reason.

### Why the piece limit was added

The brief made it conditional on playtesting showing that filling the board still removes meaningful choices. It did:

- A seven-piece board at core 6 lit **30 of 32 road cells**, with every route at 78% exposure or better.
- Ten consecutive endless waves cost zero HP against 40 to 70 bodies each.
- With coverage that complete, a cut removed only 18% of a route's exposure, so there was nothing for a reroute to fix.

At five powered pieces the board lights meaningfully less and the choice of which five is a real one.

### What did not work, and is not claimed

**The cuts do not yet demonstrably reward rerouting, and I could not make them.** The test is honest and it failed:

- A static layout and an adapting player were run from wave 9 with the same build, the same core level and the same upgrades. The adapting player was not a hand-written script but a search: at every planning phase it weighted each road by the traffic the next encounter sends down it, then tried every single swap available - idle a powered piece, wake an idle one, or buy one more - and kept anything that improved weighted light on the roads that mattered.
- It found **no improvement at all**. Both reached wave 20 with identical per-wave HP. Spending 380 gold on rerouting bought nothing.
- Three cut geometries were tried, including one that bypasses a whole sweep. Measured exposure on the cut route was 82%, 82% and 53% of the normal route.
- Routing 60% of every encounter down the cut instead of half of one group did not change the result either.

The likely cause is that lamps are independent sources covering the west side broadly, so any road down that side is already lit whatever route it takes. Fixing it properly needs cut geometry on the side of the board lamps do not reach, or a change to how lamps spread, and neither is something to attempt against a deadline.

So the cuts ship as what they are and what is verified: announced, previewed, temporary, safe for purchased pieces, and a source of variety and pressure. They are not claimed to create a rerouting decision, because the measurement says they do not.

**Also tried and reverted:** raising the endless speed ramp to 0.09/wave with a 2.2 cap and pushing counts to +3/wave. That produced a wave that took 20 HP in one go while the six before it took none - a worse curve, not a better one. Shield counts were capped at 6 and a Brute King is no longer added on top of a SHIELD WALL, so one hard idea arrives at a time.

### The campaign is untouched, and it is checked

A fingerprint of the campaign was taken before any of this work and compared after: the map and its kind array, road cell count, both roads cell by cell, every tuning constant, all eight wave queues with types, timings and gates, threat notes, health and speed multipliers, and a full scripted eight-wave run recording HP and elapsed time per wave. **The two are byte-identical.** The `endless` scenario also asserts in the browser that every campaign wave runs at normal speed and that the campaign has no piece limit.

### Evidence

- 26 Node tests pass. `build.js && check.js` pass on the release build.
- All 24 browser scenarios pass at 390x844, including a new `endless` scenario with 63 checks: campaign untouched, encounter names and notes, both gates used every wave, the health cap reached and not exceeded, each encounter shape distinct, cuts opening on schedule and closing again, a cut refused when its cells are built on, the piece limit idling rather than selling, swapping being free and refused past the limit, and a boss breach hurting without ending the run.
- Endless with a strong static layout now degrades 20 to 14 to 10 to 4 to 0 across waves 9 to 20, instead of flat-then-cliff.
- Screenshots at 360x640 checked by eye: the cut is named with its remaining waves, idle pieces are visibly faint, and the strip carries POWERED n/5.
- One mobile defect found and fixed on the way: the hint and the undo chip sat on the same spot at 360x640 and overlapped. The hint now steps up while the chip is showing.

### Still not done

- The cuts' rerouting payoff, above.
- No unfamiliar player has tried any of this.

---

## Session 8 - Endless reverted to its earlier behaviour, keeping both gates

**Owner's call:** the previous endless felt better than the session 7 rebuild, but both entrances should carry traffic.

**What was reverted.** `src/` and `tools/qa-scenarios.js` were checked out from the commit before session 7, taking out the named endless encounters, the health cap, the shape scaling for shields, swarms and spacing, the faster speed ramp, the temporary road cuts, the five-piece powered limit, and the change that stopped a boss breach ending an endless run. Endless is again the four rotating shapes with `BASE_COUNT + wave` bodies, a Brute King every fifth wave, unbounded health scaling and the original 0.02/wave speed ramp capped at 1.5.

Two things from that work were kept deliberately, because neither is about endless:

- the hint stepping up out of the way of the undo chip, which was a real overlap at 360x640;
- the campaign fingerprint tool, which is what proves the campaign is untouched.

**What was kept from the goal.** `en.endlessGroups` still builds exactly the same groups it always did; a new `splitAcrossGates` then halves each one between the two entrances. A group of one - the Brute King - cannot be halved, so it changes gate from one appearance to the next instead. Types, counts and spacing are unchanged in aggregate: wave 9 is still 23 bodies of 17 motes and 6 runners, as it was before any of this.

**Measured effect.** With the same strong static layout at core 6:

| | reached |
| --- | --- |
| before, one gate | wave 15 |
| after, both gates | wave 13 |

And the answer to it is coverage, not luck. Same core level, three arrangements:

| build | lit road | reached |
| --- | --- | --- |
| four mirrors stacked on the column 7 trunk | 7 | wave 10 |
| a chain covering both middle sweeps | 13 | wave 12 |
| a wide network of mirrors and lamps | 30 | wave 16 |

So endless is a little harder than it was, and the extra difficulty is answerable by covering more of the board rather than by knowing a trick.

**Campaign unchanged, checked again.** The same fingerprint as session 7 - map and kind array, road cells, both roads cell by cell, every tuning constant, all eight wave queues with types, timings and gates, threat notes, multipliers, and a full scripted eight-wave run - is byte-identical to the one taken before any endless work began.

**Evidence.** 26 Node tests, 24 browser scenarios and the compliance check all pass. The session 7 `endless` scenario was removed with the rest of that work and replaced by `endlessgates` (34 checks): the campaign wave table and speeds unchanged, every endless wave arriving through both gates with neither carrying more than two bodies' worth of the difference, the four shapes still rotating with their swarm, shield and Brute King waves intact, and the three-way build comparison above asserted rather than merely logged.

**A note found on the way.** Comparing the tree against the pre-session-7 commit showed `src/05_beam.js` as 892 changed lines; the real change was two lines, and the rest was line endings. The scripted edits used through these sessions rewrote some files from LF to CRLF. It makes no difference to the build, which concatenates whatever it reads, and `check.js` passes either way, but it makes diffs noisier than they should be.

---

## Session 9 - A first-run walkthrough

**Goal:** teach the opening through required actions rather than text, once, before wave 1, without touching the campaign.

**Three steps, each asking for one thing.** Leaving the title card starts it. Step one marks the tile the solver rates highest, selects Mirror so there is nothing to pick, and says "Your core fires a beam. Place a Mirror to redirect it." Placing it moves to step two, which highlights the piece and says "Tap a piece to rotate it. Aim light along the road." Step three highlights START WAVE and explains absorption. Starting the wave ends the walkthrough for good.

**Nobody is asked to rotate away from a working route.** On placement the game measures whether the other orientation would light more road and stores that as `needsFlip`. The opening placement uses the better orientation already, so `needsFlip` is false and simply tapping the piece satisfies the step; a rotation is only required when turning it would genuinely help. The test asserts both that `needsFlip` is false for the opening tile and that coverage is unchanged across the step.

**Blocking is narrow.** `tutorialBlocks` makes the board inert only for the tap the current step is waiting for. Help, pause, sound, speed and the palette all work throughout, and the test opens and closes Help mid-step to prove it. A blocked tap says "Not yet" rather than doing nothing silently.

**Nothing advances.** Planning has had no clock since session 5, so no wave, countdown or enemy moves while the walkthrough is being read.

**Skip.** A small SKIP TUTORIAL button on the bar places the same opening mirror, marks the player taught and clears the walkthrough, so a returning player starts wave 1 from exactly the board the walkthrough would have left. Verified: one mirror, on the same tile, 7 road cells lit, wave startable.

**Remembered once.** `refract.taught` in localStorage, read at boot alongside best score and mute, and guarded by the existing try/catch storage helpers so the game still runs where storage is blocked.

**Two things found while building it.**

- The walkthrough began on `restartRun` as well as `startRun`, which meant every scenario that restarts the game landed in it: eleven scenarios threw or failed at once. Playing again is not a first run, so it now belongs only to leaving the title card. That is also the correct behaviour for a player pressing TRY AGAIN.
- With the walkthrough on screen the ordinary opening hint printed over it, and the action button read "WAVE 0 RUNNING" because it was deriving its label from `canStartWave`, which the walkthrough holds shut. The hints are now suppressed while the walkthrough is speaking, and the button takes its label from the phase and only its dimming from `canStartWave`.

Test scenarios themselves now run as a player who has already been taught, set once in `tools/qa.js`; `tutorial` clears it for itself.

**Evidence.** 26 Node tests, 25 browser scenarios and the compliance check all pass, including a new `tutorial` scenario with 44 checks covering both paths: each step's text and state, that other tiles are inert and the step does not move on, that Help opens and closes without disturbing it, that placing redirects the beam, that no rotation is demanded when the route already works, that starting the wave clears the bar and the button glow and writes the flag, that it does not return later in the run or on the next one, and that skipping leaves the same mirror and still starts wave 1. Campaign fingerprint byte-identical to the one taken before any of this work.

