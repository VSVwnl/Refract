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
