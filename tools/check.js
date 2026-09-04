'use strict';
/*
 * check.js - compliance checks for the built index.html.
 *
 * Verifies the packaging and offline rules the competition requires:
 * one self-contained readable index.html, Three.js referenced from vendor/
 * by a relative path, no external requests, no debug code in a release build.
 *
 * Usage:
 *   node tools/check.js            check the release rules
 *   node tools/check.js --dev      allow debug code (development build)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const allowDebug = process.argv.indexOf('--dev') >= 0;

const problems = [];
const notes = [];

function fail(msg) { problems.push(msg); }
function note(msg) { notes.push(msg); }

const indexPath = path.join(ROOT, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('FAIL: index.html not found at the repository root. Run node tools/build.js first.');
  process.exit(1);
}
const html = fs.readFileSync(indexPath, 'utf8');
const lines = html.split('\n');

/* Strip HTML comments and JS line/block comments so URL checks look at code only. */
function stripComments(text) {
  let out = text.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/^[ \t]*\/\/.*$/gm, '');
  return out;
}
const code = stripComments(html);

/* 1. Three.js is referenced, not inlined. */
if (html.indexOf('<script src="vendor/three.min.js"></script>') < 0) {
  fail('index.html does not contain <script src="vendor/three.min.js"></script>');
}
if (/THREE\.REVISION\s*=/.test(html) || html.indexOf('SPDX-License-Identifier: MIT') >= 0) {
  fail('index.html appears to contain inlined library source');
}

/* 2. Every src= and href= is a relative path to a file that exists. */
const refs = [];
const refRe = /(?:src|href)\s*=\s*"([^"]*)"/g;
let m;
while ((m = refRe.exec(html)) !== null) refs.push(m[1]);
refs.forEach(function (ref) {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(ref) || ref.indexOf('//') === 0) {
    fail('non-relative reference in index.html: ' + ref);
    return;
  }
  if (ref.indexOf('#') === 0 || ref === '') return;
  const target = path.join(ROOT, ref);
  if (!fs.existsSync(target)) fail('referenced file is missing: ' + ref);
});
if (refs.length !== 1 || refs[0] !== 'vendor/three.min.js') {
  fail('expected exactly one external reference (vendor/three.min.js), found: ' + JSON.stringify(refs));
}

/* 3. No network capability of any kind in our own code. */
const banned = [
  ['http://', /http:\/\//],
  ['https://', /https:\/\//],
  ['protocol-relative URL', /["'`]\/\/[a-z0-9.-]+\.[a-z]{2,}/i],
  ['fetch(', /\bfetch\s*\(/],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['WebSocket', /WebSocket/],
  ['EventSource', /EventSource/],
  ['dynamic import()', /\bimport\s*\(/],
  ['serviceWorker', /serviceWorker/],
  ['sendBeacon', /sendBeacon/],
  ['<link rel=', /<link\s/i],
  ['ES module script', /<script[^>]*type\s*=\s*["']module["']/i],
  ['document.write', /document\s*\.\s*write/],
  ['inline event handler', /\son(?:click|load|error)\s*=/i]
];
banned.forEach(function (entry) {
  if (entry[1].test(code)) fail('banned pattern found in index.html: ' + entry[0]);
});

/* Only the development tools are allowed to build code or print to the console. */
const releaseOnlyBanned = [
  ['eval(', /eval\s*\(/],
  ['new Function(', /new\s+Function\s*\(/],
  ['console output', /console\s*\./]
];
if (!allowDebug) {
  releaseOnlyBanned.forEach(function (entry) {
    if (entry[1].test(code)) fail('banned pattern found in index.html: ' + entry[0]);
  });
}

/* 4. Release builds carry no debug code at all. */
if (!allowDebug) {
  ['__REFRACT', 'debug=1', '99_debug.js', 'debugPanel', 'R.debug'].forEach(function (needle) {
    if (html.indexOf(needle) >= 0) fail('release build contains debug string: ' + needle);
  });
  if (/debug/i.test(html)) fail('release build still mentions "debug"');
}

/* 5. Guarded access to the optional browser APIs. */
['localStorage', 'AudioContext'].forEach(function (api) {
  var re = new RegExp(api, 'g');
  var uses = (code.match(re) || []).length;
  var guards = (code.match(/try\s*\{/g) || []).length;
  if (uses > 0 && guards < 4) {
    fail(api + ' is used but there are too few try/catch guards (' + guards + ')');
  }
});

/* 6. Readability: our code must not look minified. */
let longest = 0;
let longestLine = 0;
lines.forEach(function (line, i) {
  if (line.length > longest) { longest = line.length; longestLine = i + 1; }
});
if (longest > 1000) fail('line ' + longestLine + ' is ' + longest + ' characters long (minified?)');
if (lines.length < 500) fail('index.html has only ' + lines.length + ' lines, which suggests missing source');

/* 7. One banner comment per inlined source file. */
const inlineScripts = (html.match(/<script>/g) || []).length;
const banners = (html.match(/^   [0-9]{2}_[a-z]+\.js$/gm) || []).length;
if (banners !== inlineScripts) {
  fail('expected one banner comment per inlined script, found ' + banners + ' banners for ' + inlineScripts + ' scripts');
}
note('inlined source files: ' + inlineScripts);

/* 8. No text addressed to evaluators or automated tools. */
const addressed = [
  /\bjudges?\b/i, /\breviewers?\b/i, /\bevaluat/i, /\bgrader/i,
  /\bAI (?:system|tool|model|assistant)/i, /language model/i,
  /\bprompt\b/i, /\bignore (?:the )?(?:previous|above)/i
];
addressed.forEach(function (re) {
  const hit = html.match(re);
  if (hit) fail('text addressed to evaluators or AI tools may be present: ' + hit[0]);
});

/* 9. Vendor files. */
const vendorJs = path.join(ROOT, 'vendor', 'three.min.js');
const vendorLic = path.join(ROOT, 'vendor', 'LICENSE-three.txt');
if (!fs.existsSync(vendorJs)) fail('vendor/three.min.js is missing');
if (!fs.existsSync(vendorLic)) fail('vendor/LICENSE-three.txt is missing');
if (fs.existsSync(vendorJs)) {
  const buf = fs.readFileSync(vendorJs);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  note('vendor/three.min.js  ' + buf.length + ' bytes  sha256 ' + sha.slice(0, 16));
  const EXPECT = '8a5f7249903b54d30f79f708699d2fed2d6a1d0741a4cd41377d1f01bb5a2271';
  if (sha !== EXPECT) fail('vendor/three.min.js has changed (expected sha256 ' + EXPECT.slice(0, 16) + ')');
}

/* 10. Size. */
const bytes = Buffer.byteLength(html, 'utf8');
note('index.html          ' + bytes + ' bytes, ' + lines.length + ' lines, longest line ' + longest);
if (bytes > 5 * 1024 * 1024) fail('index.html is unexpectedly large: ' + bytes + ' bytes');

/* 10. Non-ASCII inventory (all text must be English; symbols are allowed). */
const nonAscii = {};
for (let i = 0; i < html.length; i++) {
  const ch = html[i];
  if (ch.charCodeAt(0) > 126) nonAscii[ch] = (nonAscii[ch] || 0) + 1;
}
const chars = Object.keys(nonAscii);
if (chars.length) note('non-ascii characters used: ' + chars.map(function (c) {
  return c + '(' + nonAscii[c] + ')';
}).join(' '));

notes.forEach(function (n) { console.log('  ' + n); });
if (problems.length) {
  console.error('\nFAIL (' + problems.length + '):');
  problems.forEach(function (p) { console.error('  - ' + p); });
  process.exit(1);
}
console.log('\nPASS: index.html meets the compliance rules' + (allowDebug ? ' (development build)' : ''));
