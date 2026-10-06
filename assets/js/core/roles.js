/* ==========================================================================
   KonfluenX — ROLES

   Three roles, one manifest. Two of them are staff portals; the third is not
   a portal at all.

     moderator    a REGULAR USER with elevated reach inside the community.
                  Keeps the whole customer app — trades, signals, wallet — and
                  gains: entry to every room without joining, the power to flag
                  a message or a whole room, and a moderator badge. They watch
                  and escalate; they do not administer. There is no
                  moderator/ folder, and there must never be one.

     admin/       runs the platform — people, content, money, markets
     superadmin/  owns the platform — the above plus agents, staff, settings

   Admin inherits every admin-portal action of the moderator (the review side
   of a flag), and superadmin inherits every admin one, so a permission is
   stated in exactly one place.

   STAGE 1: the role comes from <body data-role="…"> and is advisory — this is
   a static prototype and nothing here is a security control.
   STAGE 2: Laravel middleware + policies enforce the same manifest server
   side, and this file drives only what the UI offers. The names below are
   deliberately the permission names those policies will use.
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  /* Set by MB.roles.setUser() from /me in the customer app, where there is no
     <body data-role>. Stays null for an ordinary user. */
  var userRole = null;

  /* ?role=user|moderator|admin|superadmin forces a role for one page load, so
     both sides of a permission can be checked without editing a fixture.
     QA and demos only — never persisted, and never a security boundary. */
  var urlRole = (function () {
    var m = /[?&]role=(user|moderator|admin|superadmin)\b/.exec(location.search);
    return m ? (m[1] === 'user' ? '' : m[1]) : null;
  })();

  /* ----------------------------------------------------------------------
     PAGES — the nav for each staff portal, in render order.
     `id` matches <body data-nav="…">; `href` is relative to the portal folder.
     A moderator has no entry here: their home is the customer app.
     ---------------------------------------------------------------------- */
  var ADMIN_PAGES = [
    { group: 'Overview' },
    { id: 'dashboard',    label: 'Dashboard',    icon: 'grid',      href: 'index.html' },
    { id: 'analytics',    label: 'Analytics',    icon: 'activity',  href: 'analytics.html' },
    { group: 'People' },
    { id: 'users',        label: 'Users',        icon: 'users',     href: 'users.html' },
    { group: 'Content' },
    { id: 'signals',      label: 'Signals',      icon: 'signals',   href: 'signals.html' },
    { id: 'boosted',      label: 'Boosted',      icon: 'megaphone', href: 'boosted.html' },
    { id: 'community',    label: 'Community',    icon: 'community', href: 'community.html' },
    { id: 'resources',    label: 'Resources',    icon: 'book',      href: 'resources.html' },
    { group: 'Operations' },
    { id: 'reports',      label: 'Reports',      icon: 'flag',      href: 'reports.html', count: 7 },
    { id: 'markets',      label: 'Markets',      icon: 'markets',   href: 'markets.html' },
    { id: 'transactions', label: 'Transactions', icon: 'wallet',    href: 'transactions.html' }
  ];

  var SUPERADMIN_PAGES = ADMIN_PAGES.concat([
    { group: 'Platform' },
    { id: 'achievements', label: 'Achievements',  icon: 'star',     href: 'achievements.html' },
    { id: 'agents',       label: 'Agents',        icon: 'users',    href: 'agents.html' },
    { id: 'staff',        label: 'Staff & Roles', icon: 'shield',   href: 'staff.html' },
    { id: 'staff-audit',  label: 'Staff Audit',   icon: 'clock',    href: 'staff-audit.html' },
    { id: 'capabilities', label: 'Capabilities',  icon: 'layers',   href: 'capabilities.html' },
    { id: 'settings',     label: 'Settings',      icon: 'settings', href: 'settings.html' }
  ]);

  /* ----------------------------------------------------------------------
     MODERATOR — powers that live in the CUSTOMER app, not a console.

     Everything here is "see" or "raise". Nothing removes, suspends or bans:
     a flag opens a report for an admin to act on, which is what keeps a
     moderator a community member rather than a second class of staff.
     ---------------------------------------------------------------------- */
  var MODERATOR_ACTIONS = [
    'room.view_all',         /* enter any room without joining it */
    'room.monitor',          /* see the moderation strip inside a room */
    'message.flag',          /* raise a message to the admins */
    'room.flag',             /* raise a whole room to the admins */
    'post.flag',
    'signal.flag',
    'user.flag'
  ];

  /* ----------------------------------------------------------------------
     STAFF ACTIONS — what a portal role may DO, independent of what it sees.
     ---------------------------------------------------------------------- */
  var ADMIN_ACTIONS = [
    /* the review side of whatever moderators raise */
    'report.review', 'report.dismiss', 'report.escalate',
    'post.remove', 'comment.remove', 'message.remove',
    'signal.retract', 'signal.unlist', 'signal.delete',
    'room.mute', 'room.remove_member', 'room.lock',
    'user.warn', 'user.view', 'user.suspend', 'user.ban',
    'user.verify', 'user.reset_2fa',
    'boost.create', 'boost.cancel',
    'community.create', 'community.block', 'community.transfer',
    'resource.create', 'resource.edit', 'resource.price', 'resource.unpublish',
    'market.create', 'market.edit', 'market.disable',
    'transaction.view', 'transaction.approve', 'transaction.reject',
    'analytics.view',
    /* an admin is also a user, so they carry the community powers too */
    'room.view_all', 'room.monitor', 'message.flag', 'room.flag',
    'post.flag', 'signal.flag', 'user.flag'
  ];

  var SUPERADMIN_ACTIONS = ADMIN_ACTIONS.concat([
    'staff.view', 'staff.invite', 'staff.edit_role', 'staff.disable', 'staff.delete',
    'staff.audit.view',
    'agent.view', 'agent.toggle_visibility', 'agent.sync',
    'achievement.manage', 'achievement.edit_criteria',
    'capability.edit',
    'settings.edit',
    'user.delete',
    'transaction.override'
  ]);

  var ROLES = {
    moderator: {
      id: 'moderator',
      label: 'Moderator',
      tone: 'info',
      /* A regular user. Their home is the customer app — there is no portal. */
      home: null,
      portal: false,
      blurb: 'A regular user who can enter every room, and flag messages or ' +
             'rooms for the admins. No console, no destructive powers.',
      pages: [],
      actions: MODERATOR_ACTIONS
    },
    admin: {
      id: 'admin',
      label: 'Admin',
      tone: 'green',
      home: 'admin/',
      portal: true,
      blurb: 'Runs the platform day to day, and acts on what moderators raise. ' +
             'No staff management, agents or settings.',
      pages: ADMIN_PAGES,
      actions: ADMIN_ACTIONS
    },
    superadmin: {
      id: 'superadmin',
      label: 'Super Admin',
      tone: 'brand',
      home: 'superadmin/',
      portal: true,
      blurb: 'Owns the platform, including who else gets access and which ' +
             'payment agents users are shown.',
      pages: SUPERADMIN_PAGES,
      actions: SUPERADMIN_ACTIONS
    }
  };

  /* ----------------------------------------------------------------------
     PUBLIC API
     ---------------------------------------------------------------------- */
  MB.roles = {
    all: ROLES,
    list: function () { return ['moderator', 'admin', 'superadmin']; },

    /** Only the roles that own a staff console. */
    portals: function () {
      return MB.roles.list().filter(function (id) { return ROLES[id].portal; });
    },

    /**
     * The role this page is rendered for.
     * Staff pages declare it on <body data-role>. In the customer app there is
     * no such attribute, so it falls back to the signed-in user's role, which
     * MB.roles.setUser() supplies once /me has loaded.
     */
    current: function () {
      if (urlRole !== null) { return ROLES[urlRole] ? urlRole : null; }
      var b = document.body;
      var r = b && b.getAttribute('data-role');
      if (ROLES[r]) { return r; }
      return userRole;
    },

    /** Called from the customer app once we know who is signed in. */
    setUser: function (role) {
      userRole = ROLES[role] ? role : null;
      return userRole;
    },

    get: function (id) { return ROLES[id] || null; },

    /** Nav entries for a role, hrefs resolved against that role's folder. */
    pages: function (id) {
      var role = ROLES[id || MB.roles.current()];
      if (!role || !role.portal) { return []; }
      return role.pages.map(function (p) {
        if (p.group) { return p; }
        return {
          id: p.id, label: p.label, icon: p.icon, count: p.count,
          href: role.home + p.href
        };
      });
    },

    /** Permission test. Use it to decide whether to RENDER an action. */
    can: function (action, id) {
      var role = ROLES[id || MB.roles.current()];
      return !!role && role.actions.indexOf(action) > -1;
    },

    /**
     * Renders `html` only when the role holds `action`. Keeps templates
     * declarative: `MB.roles.only('message.flag', flagButtonHtml)`.
     */
    only: function (action, html, id) {
      return MB.roles.can(action, id) ? html : '';
    },

    /** True when a is at least as privileged as b. */
    atLeast: function (a, b) {
      var order = MB.roles.list();
      return order.indexOf(a) >= order.indexOf(b);
    }
  };
})(window);
