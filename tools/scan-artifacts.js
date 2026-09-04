'use strict';
/*
 * scan-artifacts.js - checks the three submission artifacts for anything that
 * must not ship: personal information, tool names, placeholder text, or text
 * addressed at whoever is evaluating the entry.
 *
 * Usage: node tools/scan-artifacts.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const FILES = [
  'index.html',
  'dist/buildlog.md',
  'docs/design-intent.md',
  'SUBMISSION_NOTES.md'
];

/* Anything that identifies a person, a machine or the tools used to build it. */
const FORBIDDEN = [
  ['an email address', /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i],
  ['a Windows user path', /[A-Za-z]:\\Users\\/],
  ['a home directory path', /\/home\/[a-z]/i],
  ['a git host profile', /github\.com\/[A-Za-z0-9_-]+/],
  ['a placeholder marker', /\b(?:TODO|TBD|FIXME|XXX|lorem ipsum|coming soon|placeholder)\b/i]
];

/* Names of the tools used to build it, which the log must not carry. */
const TOOL_NAMES = [/\bclaude\b/i, /\banthropic\b/i, /\bcopilot\b/i, /\bchatgpt\b/i, /\bgpt-?[0-9]/i];

/* Text aimed at whoever or whatever is evaluating the entry. */
const ADDRESSED = [
  /\bjudges?\b/i, /\breviewers?\b/i, /\bevaluat/i, /\bgrader/i,
  /\bAI (?:system|tool|model|assistant)/i, /language model/i,
  /\bignore (?:the )?(?:previous|above)/i
];

const problems = [];
const notes = [];

FILES.forEach(function (rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    problems.push(rel + ' is missing');
    return;
  }
  const text = fs.readFileSync(p, 'utf8');
  notes.push(rel + '  ' + Buffer.byteLength(text, 'utf8') + ' bytes');

  FORBIDDEN.forEach(function (entry) {
    const hit = text.match(entry[1]);
    if (hit) problems.push(rel + ' contains ' + entry[0] + ': "' + hit[0] + '"');
  });

  /* The build log may describe which AI tools were used, as the rules require.
     Nothing else may name them. */
  if (rel !== 'dist/buildlog.md') {
    TOOL_NAMES.forEach(function (re) {
      const hit = text.match(re);
      if (hit) problems.push(rel + ' names a build tool: "' + hit[0] + '"');
    });
  }

  if (rel !== 'SUBMISSION_NOTES.md') {
    ADDRESSED.forEach(function (re) {
      const hit = text.match(re);
      if (hit) problems.push(rel + ' contains text addressed to an evaluator: "' + hit[0] + '"');
    });
  }
});

/* The author's own git identity must not appear anywhere in the artifacts. */
let identity = [];
try {
  const name = execFileSync('git', ['config', 'user.name'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const email = execFileSync('git', ['config', 'user.email'], { cwd: ROOT, encoding: 'utf8' }).trim();
  identity = [name, email].filter(Boolean);
} catch (err) {
  notes.push('git identity unavailable; skipped that check');
}
identity.forEach(function (value) {
  FILES.forEach(function (rel) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) return;
    if (fs.readFileSync(p, 'utf8').indexOf(value) >= 0) {
      problems.push(rel + ' contains the author identity "' + value + '"');
    }
  });
});
if (identity.length) notes.push('checked for the git identity in every artifact');

notes.forEach(function (n) { console.log('  ' + n); });
if (problems.length) {
  console.error('\nFAIL (' + problems.length + '):');
  problems.forEach(function (p) { console.error('  - ' + p); });
  process.exit(1);
}
console.log('\nPASS: the submission artifacts carry nothing they should not');
