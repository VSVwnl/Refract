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
