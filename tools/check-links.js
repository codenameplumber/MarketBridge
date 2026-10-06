#!/usr/bin/env node
/* ==========================================================================
   KonfluenX — LINK CHECKER

   Verifies every internal reference resolves to a real file. It checks three
   kinds of reference, because the first version only checked the first kind
   and that is how three pages linked from the account drawer stayed missing:

     1. href="…" / src="…" in markup
     2. page paths written as JS string literals — the nav manifests in
        assets/js/core/{roles,shell}.js build hrefs at runtime, so nothing in
        the markup ever mentions them
     3. mock fixture paths passed to MB.api.get()/list()

   Run:  node tools/check-links.js
   ========================================================================== */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const SKIP_DIRS = new Set(['_docs', 'node_modules', '.git', 'tools']);

function walk(dir, out, exts) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, exts);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
}

const pages = [];
walk(ROOT, pages, ['.html']);
const scripts = [];
walk(path.join(ROOT, 'assets', 'js'), scripts, ['.js']);

let broken = 0, checked = 0;
const gated = [];
const seen = new Set();

function fail(where, ref) {
  const key = where + ' -> ' + ref;
  if (seen.has(key)) return;
  seen.add(key);
  broken++;
  console.log('BROKEN  ' + key);
}

/* ---- 1. markup references ------------------------------------------- */
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  const dir = path.dirname(page);
  /* Capture a little context before each reference so role-gated links can
     be told apart from broken ones. */
  const refs = [...html.matchAll(/([\s\S]{0,120}?)(?:href|src)="([^"]+)"/g)]
    .map((m) => ({ before: m[1], ref: m[2] }));

  for (const { before, ref } of refs) {
    if (/^(https?:|mailto:|#|data:|javascript:)/.test(ref)) continue;
    const clean = ref.split('#')[0].split('?')[0];
    /* Skip fragments that are really JS concatenation inside <script>. */
    if (!clean || /['"]\s*\+|\n/.test(ref)) continue;
    checked++;
    if (fs.existsSync(path.resolve(dir, clean))) continue;

    /* A link carrying data-can is removed at runtime for roles that lack the
       permission, so a missing target in a lesser portal is by design. It is
       still listed, because a typo would look exactly the same. */
    if (/data-can="/.test(before)) {
      gated.push(path.relative(ROOT, page) + ' -> ' + ref);
      continue;
    }
    fail(path.relative(ROOT, page), ref);
  }
}

/* ---- 2. page paths built in JS --------------------------------------
   These are root-relative: the nav prefixes MB.root() at render time. */
for (const js of scripts) {
  const src = fs.readFileSync(js, 'utf8');
  const rel = path.relative(ROOT, js);
  const refs = [...src.matchAll(/href:\s*'([^']+\.html)'/g)].map((m) => m[1]);

  /* roles.js states hrefs relative to each role's own folder. */
  const homes = [...src.matchAll(/home:\s*'([^']+)'/g)].map((m) => m[1]);

  for (const ref of refs) {
    checked++;
    const direct = path.resolve(ROOT, ref);
    if (fs.existsSync(direct)) continue;
    /* Otherwise it must resolve under at least one declared portal home. */
    if (homes.some((h) => fs.existsSync(path.resolve(ROOT, h, ref)))) continue;
    fail(rel, ref);
  }
}

/* ---- 3. fixture paths passed to the API client ----------------------- */
const fixtureRefs = new Set();
for (const page of pages.concat(scripts)) {
  const src = fs.readFileSync(page, 'utf8');
  for (const m of src.matchAll(/MB\.api\.(?:get|list)\(\s*'([^']+)'/g)) {
    fixtureRefs.add(m[1] + '||' + path.relative(ROOT, page));
  }
  for (const m of src.matchAll(/\bfrom:\s*'([a-z0-9/_-]+)'/g)) {
    fixtureRefs.add(m[1] + '||' + path.relative(ROOT, page));
  }
}
for (const entry of fixtureRefs) {
  const [ref, where] = entry.split('||');
  checked++;
  if (!fs.existsSync(path.join(ROOT, 'mock', ref + '.json'))) {
    fail(where, 'mock/' + ref + '.json');
  }
}

if (gated.length) {
  console.log('\nrole-gated links (removed at runtime where the role lacks the permission):');
  gated.forEach((g) => console.log('  ' + g));
}

console.log('\npages: ' + pages.length +
            '  scripts: ' + scripts.length +
            '  refs checked: ' + checked +
            '  role-gated: ' + gated.length +
            '  broken: ' + broken);
process.exit(broken ? 1 : 0);
