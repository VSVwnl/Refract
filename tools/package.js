'use strict';
/*
 * package.js - produce the submission artifacts in dist/.
 *
 *   1. release build of index.html (no debug code)
 *   2. compliance check
 *   3. dist/refract.zip  (index.html at the root, vendor/ alongside)
 *   4. dist/buildlog.md  (a copy of BUILD_LOG.md)
 *   5. dist/design-intent.docx if python-docx is available
 *
 * Usage: node tools/package.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function run(cmd, args, label) {
  process.stdout.write('\n== ' + label + ' ==\n');
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('FAILED: ' + label);
    process.exit(1);
  }
}

function python() {
  for (const candidate of ['python', 'python3', 'py']) {
    const r = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return candidate;
  }
  return null;
}

const py = python();
if (!py) {
  console.error('FAILED: python is required to build the zip with forward-slash entry names');
  process.exit(1);
}

run(process.execPath, ['tools/build.js'], 'release build');
run(process.execPath, ['tools/check.js'], 'compliance check');
run(process.execPath, ['tools/test-beam.js'], 'unit tests');
run(py, ['tools/make_zip.py'], 'zip');

fs.mkdirSync(DIST, { recursive: true });

/* The build log ships as buildlog.md. */
const log = fs.readFileSync(path.join(ROOT, 'BUILD_LOG.md'), 'utf8');
fs.writeFileSync(path.join(DIST, 'buildlog.md'), log, 'utf8');
console.log('\ndist/buildlog.md  ' + Buffer.byteLength(log, 'utf8') + ' bytes');

/* Design intent: markdown is the source, .docx is produced when possible. */
const intentPath = path.join(ROOT, 'docs', 'design-intent.md');
if (fs.existsSync(intentPath)) {
  const r = spawnSync(py, ['tools/make_docx.py'], { cwd: ROOT, encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  if (r.status !== 0) {
    console.log('design-intent.docx not produced: ' + (r.stderr || '').trim());
    console.log('Paste docs/design-intent.md into the official template by hand instead.');
  }
} else {
  console.log('\ndocs/design-intent.md does not exist yet.');
}

run(process.execPath, ['tools/scan-artifacts.js'], 'artifact scan');

console.log('\nDone. Artifacts in dist/.');
