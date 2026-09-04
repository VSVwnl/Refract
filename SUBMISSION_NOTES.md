# Submission notes — REFRACT

Everything below is ready in `dist/`. No code needs touching.

## What to upload

| Artifact | File | Notes |
|---|---|---|
| Build | `dist/refract.zip` | 0.19 MB. Contains `index.html` at the top level plus `vendor/three.min.js` and `vendor/LICENSE-three.txt`. Well under the 35 MB limit. |
| Design intent | `dist/design-intent.docx` | 454 words of body text, 496 including the section headings. Seven sections in the required order. No names or identifying information. |
| Build log | `dist/buildlog.md` | Markdown, two parts: "Decisions locked so far" then one entry per phase. No names or identifying information. |

## What to select on the submission form

- **Genre: Tower Defense & Strategy.**
- Single player.
- Deadline: **September 8, 2026, 1:00 PM PDT**. Resubmission before the deadline is allowed, so upload as soon as the form opens and replace it later if anything improves.

## One thing to check by hand

If the organisers require their own `.docx` template file rather than a plain document, open `docs/design-intent.md` and paste each of the seven sections into the matching section of their template, then export that as the `.docx` to upload. The wording is already within the word limit and contains no identifying information. `dist/design-intent.docx` is the same text in a plain document with the seven headings in order, and can be uploaded directly if a plain document is acceptable.

## Rebuilding from source

```
node tools/build.js      # release index.html (no debug code)
node tools/check.js      # compliance checks
node tools/test-beam.js  # unit tests for the beam solver
node tools/package.js    # everything above, then dist/refract.zip, buildlog.md and the .docx
```

Development server: `node tools/serve.js` then open `http://localhost:8080/`. Browser tests: `node tools/qa.js <scenario>`; `node tools/qa.js list` prints the scenario names.

## What the judges will see

Opening the zip's `index.html` from any static server shows a title card, and one tap starts a run. The beam is already firing when the board appears. A full run is twelve waves, roughly seven minutes at normal speed and half that at the 2x setting, ending in a victory or defeat screen with a score and a button to play again. Endless mode continues after a win.

The build makes exactly two requests — the page itself and `vendor/three.min.js` — and works with the network disabled and from a `file://` URL.
