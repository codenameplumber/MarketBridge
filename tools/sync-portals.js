#!/usr/bin/env node
/* ==========================================================================
   KonfluenX — PORTAL SYNC

   The two staff portals share their page markup. superadmin/ is the source of
   truth; this script projects the pages admin/ is allowed to open, changing
   only:

     - <body data-role="…">          so the rail and permission pass know
     - the portal name in the title

   Everything else — the table, the actions, the copy — stays byte-identical,
   so a fix lands in both portals at once. What each role may actually DO is
   decided at runtime by assets/js/core/roles.js: controls carrying
   data-can="<action>" are removed for roles that lack the permission.

   Pages listed for a role must also appear in that role's `pages` array in
   roles.js, or the nav will not link to them. Detail pages are the exception:
   they are reachable from a table row rather than the nav, so they are listed
   here but not there.

   Run after editing any superadmin page:
       node tools/sync-portals.js
       node tools/sync-portals.js --check     (CI: fail if out of sync)
   ========================================================================== */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'superadmin';

/* Which pages each portal gets. Detail pages travel with their list page.

   There is no moderator entry, and there must not be one: a moderator is a
   regular user with elevated reach inside the community, not a console user.
   Their powers live in the customer app and are gated by MB.roles. */
const PORTALS = {
  admin: [
    'index.html', 'analytics.html',
    'users.html', 'user-detail.html',
    'signals.html', 'signal-detail.html',
    'boosted.html',
    'community.html', 'community-detail.html',
    'resources.html', 'resource-edit.html',
    'reports.html', 'markets.html', 'transactions.html'
  ]
};

/* Pages that must never leave superadmin/, as a guard against a careless
   edit to the lists above. */
const OWNER_ONLY = ['agents.html', 'staff.html', 'staff-audit.html',
                    'capabilities.html', 'settings.html'];

function project(html, role) {
  let out = html.replace(/data-role="superadmin"/g, `data-role="${role}"`);

  /* The <title> says which console you are in. */
  const label = { admin: 'Admin', superadmin: 'Admin' }[role];
  out = out.replace(/<title>([^<]*?)— KonfluenX Admin<\/title>/,
                    `<title>$1— KonfluenX ${label}</title>`);

  /* Relative depth is identical (all portals sit one level below root), so
     ../assets/… and sibling page links need no rewriting. */
  return out;
}

function main() {
  const check = process.argv.includes('--check');
  let written = 0, stale = [];

  for (const [role, pages] of Object.entries(PORTALS)) {
    const dir = path.join(ROOT, role);
    if (!check && !fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }

    for (const page of pages) {
      if (OWNER_ONLY.includes(page)) {
        throw new Error(`${page} is owner-only and must not be synced to ${role}/`);
      }
      const srcPath = path.join(ROOT, SRC, page);
      if (!fs.existsSync(srcPath)) {
        throw new Error(`missing source page: ${SRC}/${page}`);
      }
      const want = project(fs.readFileSync(srcPath, 'utf8'), role);
      const dstPath = path.join(dir, page);
      const have = fs.existsSync(dstPath) ? fs.readFileSync(dstPath, 'utf8') : null;

      if (have === want) { continue; }
      if (check) { stale.push(`${role}/${page}`); continue; }
      fs.writeFileSync(dstPath, want);
      written++;
    }

    /* Remove pages a role is no longer allowed to have. */
    if (!check && fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.html') && !pages.includes(f)) {
          fs.unlinkSync(path.join(dir, f));
          console.log(`  removed ${role}/${f} (not permitted for this role)`);
        }
      }
    }
  }

  if (check) {
    if (stale.length) {
      console.error('Portals out of sync with ' + SRC + '/:');
      stale.forEach((f) => console.error('  ' + f));
      process.exit(1);
    }
    console.log('portals in sync');
    return;
  }
  console.log(`synced ${written} page(s) into admin/`);
}

main();
