/* ==========================================================================
   KonfluenX — SHELL
   Renders the chrome so every page file stays thin and no nav markup is
   ever duplicated. Each renderer here maps to one Blade layout later:

     brand mark   -> <x-brand />
     app topbar   -> layouts/partials/topbar.blade.php
     tab bar      -> layouts/partials/tabbar.blade.php
     admin rail   -> layouts/partials/admin-nav.blade.php

   Driven entirely by body attributes:
     data-shell="app|admin"  data-nav="home"  data-root="../"
     data-title="Signals"    data-sub="Follow top traders"
     data-back="../users/"
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  /* ======================================================================
     BRAND
     ====================================================================== */
  /* The KonfluenX K mark. Two shapes — red left, green right — forming
     a stylised K. Flat vector so it stays crisp and re-themes. */
  MB.brandMark = function (size) {
    var s = size || 30;
    var h = Math.round(s * 1.2);
    return '<svg class="brand-mark" width="' + s + '" height="' + h +
      '" viewBox="0 0 60 72" aria-hidden="true">' +
      '<path d="M6,0 L18,0 L18,72 L6,72Z" fill="var(--vy-brand,#E4222F)"/>' +
      '<path d="M18,33 L50,0 L40,0 L18,25Z" fill="var(--mb-green,#00C853)"/>' +
      '<path d="M18,39 L50,72 L40,72 L18,47Z" fill="var(--mb-green,#00C853)"/>' +
      '</svg>';
  };

  /* KonfluenX wordmark. Built from type rather than an image so it
     re-themes, stays crisp, and remains selectable text for accessibility.
     KONFLUEN white · X carries the red→green gradient. */
  MB.brand = function (opts) {
    var o = opts || {};
    var href = o.href !== undefined ? o.href : MB.url('index.html');
    var cls = 'brand' + (o.large ? ' brand-lg' : o.small ? ' brand-sm' : '');
    var sub = o.tagline === false ? '' :
      '<span class="kx-sub">CONNECT &middot; DISCOVER &middot; CONVERGE</span>';

    var markSize = o.large ? 32 : o.small ? 18 : 24;
    var mark = o.noMark ? '' : MB.brandMark(markSize);

    var inner = mark +
      '<span class="kx-lockup">' +
        '<span class="kx-word" aria-label="KonfluenX">' +
          '<span class="kx-main">KONFLUEN</span><span class="kx-x">X</span>' +
        '</span>' + sub +
      '</span>';

    return href
      ? '<a class="' + cls + '" href="' + href + '" aria-label="KonfluenX home">' + inner + '</a>'
      : '<span class="' + cls + '">' + inner + '</span>';
  };

  /* ======================================================================
     APP TOP BAR
     Two forms: the Home bar (brand + bell + avatar) and the inner-page bar
     (back + title + actions). Chosen by whether data-back is present.
     ====================================================================== */
  function renderTopbar(body) {
    var host = MB.$('[data-render="topbar"]');
    if (!host) { return; }

    var back = body.getAttribute('data-back');
    var title = body.getAttribute('data-title');
    var sub = body.getAttribute('data-sub');
    var unread = body.getAttribute('data-unread') || '3';
    var r = MB.root();

    /* The avatar opens the account drawer rather than navigating — every
       account destination lives in one place. */
    var right =
      '<button class="icon-btn" data-theme-toggle aria-label="Switch between light and dark"></button>' +
      '<a class="icon-btn bell" href="' + r + 'users/notifications.html" aria-label="Notifications">' +
        MB.icon('bell', 21) +
        (unread !== '0' ? '<span class="count">' + unread + '</span>' : '') +
      '</a>' +
      '<button id="acctOpen" aria-label="Account menu" aria-expanded="false" aria-controls="acctDrawer">' +
        '<span class="avatar avatar-sm avatar-ring" style="background:' + MB.avatarColor('johntrader') + '">JT</span>' +
      '</button>';

    if (back !== null && back !== undefined) {
      host.outerHTML =
        '<header class="topbar">' +
          '<a class="topbar-back" href="' + back + '" aria-label="Go back">' + MB.icon('back', 22) + '</a>' +
          '<div class="grow">' +
            /* One line, always: a long title steps down a size, then ellipsises
               rather than wrapping into the fixed-height bar. */
            '<div class="topbar-title is-inner' + ((title || '').length > 18 ? ' is-long' : '') +
              '" title="' + MB.esc(title || '') + '">' + MB.esc(title || '') + '</div>' +
            (sub ? '<div class="topbar-sub is-inner">' + MB.esc(sub) + '</div>' : '') +
          '</div>' +
          '<div class="row g1 none">' + (body.hasAttribute('data-bare') ? '' : right) + '</div>' +
        '</header>';
    } else if (title) {
      host.outerHTML =
        '<header class="topbar">' +
          '<div class="grow">' +
            '<h1 class="topbar-title">' + MB.esc(title) + '</h1>' +
            (sub ? '<div class="topbar-sub">' + MB.esc(sub) + '</div>' : '') +
          '</div>' +
          '<div class="row g1 none">' + right + '</div>' +
        '</header>';
    } else {
      host.outerHTML =
        '<header class="topbar">' +
          '<div class="grow">' + MB.brand({ href: r + 'users/index.html' }) + '</div>' +
          '<div class="row g1 none">' + right + '</div>' +
        '</header>';
    }
  }

  /* ======================================================================
     ACCOUNT DRAWER
     One home for every account destination, opened from the avatar. Slides
     down from the top so it reads as part of the header it came from.
     ====================================================================== */
  /* Deriv balances, transfers and transaction history are not listed here:
     they stay one tap away from the Home balance card and the wallet pages,
     so the drawer can hold account destinations rather than money plumbing. */
  var ACCT_NAV = [
    { group: null },
    { label: 'My Profile',                icon: 'users',     href: 'users/profile/index.html' },
    { label: 'Partnership Program',       icon: 'handshake', href: 'users/profile/partner.html' },
    { label: 'My Signals',                icon: 'signals',   href: 'users/signals/index.html' },
    { label: 'Saved',                     icon: 'bookmark',  href: 'users/profile/saved.html' },
    { label: 'Leaderboard',               icon: 'results',   href: 'users/results/leaderboard.html' },
    { label: 'KX Points & Rewards',       icon: 'star',      href: 'users/profile/rewards.html' },
    { label: 'Achievements',              icon: 'flame',     href: 'users/profile/achievements.html' },
    { label: 'My Community Activity',     icon: 'community', href: 'users/community/index.html' },
    { label: 'Institutional Trading',     icon: 'bank',      href: 'users/institutional/index.html' },
    { group: 'Wallet' },
    { label: 'Wallet & Credits',          icon: 'wallet',    href: 'users/wallet/credits.html', pill: 'New' },
    { label: 'Creator Earnings',          icon: 'coin',      href: 'users/creator/earnings.html' },
    { label: 'Account Statement',         icon: 'file',      href: 'users/wallet/statement.html' },
    { group: 'More' },
    { label: 'Notifications',             icon: 'bell',      href: 'users/notifications.html', count: 3 },
    { label: 'Help & Support',            icon: 'info',      href: 'faq.html' },
    { label: 'Settings',                  icon: 'settings',  href: 'users/profile/settings.html' }
  ];

  function renderAcctDrawer() {
    if (document.getElementById('acctDrawer')) { return; }
    var r = MB.root();

    var STAFF_NAV = [
      { group: null },
      { label: 'Users',               icon: 'users',     href: 'users/people.html' },
      { label: 'Institutions',        icon: 'bank',      href: 'users/people.html?type=institution' },
      { label: 'Leaderboard',         icon: 'results',   href: 'users/results/leaderboard.html' },
      { label: 'All rooms',           icon: 'community', href: 'users/community/index.html' },
      { group: 'More' },
      { label: 'Notifications',       icon: 'bell',      href: 'users/notifications.html', count: 3 },
      { label: 'Help & Support',      icon: 'info',      href: 'faq.html' },
      { label: 'Settings',            icon: 'settings',  href: 'users/profile/settings.html' }
    ];
    var items = (staffView() ? STAFF_NAV : ACCT_NAV).map(function (n) {
      if (n.group === null) { return '</div><div class="acct-drawer-group">'; }
      if (n.group) {
        return '</div><div class="acct-drawer-group"><div class="acct-drawer-label">' + n.group + '</div>';
      }
      return '<a class="acct-drawer-item" href="' + r + n.href + '">' +
        MB.icon(n.icon, 18) + '<span>' + n.label + '</span>' +
        (n.pill ? '<span class="tag-new">' + n.pill + '</span>' : '') +
        (n.count ? '<span class="count">' + n.count + '</span>'
                 : '<span class="chev">' + MB.icon('chevright', 16) + '</span>') +
      '</a>';
    }).join('');

    /* A staff member in the app gets the way back to their console first. */
    var staff = MB.roles ? MB.roles.staffSession() : null;
    var staffRole = staff ? MB.roles.get(staff) : null;
    var switchItem = staffRole
      ? '<div class="acct-drawer-group">' +
          '<a class="acct-drawer-item" href="' + r + staffRole.home + 'index.html">' +
            MB.icon('shield', 18) + '<span>Switch to ' + MB.esc(staffRole.label) + ' console</span>' +
            '<span class="chev">' + MB.icon('chevright', 16) + '</span></a>' +
        '</div>'
      : '';

    var html =
      '<div class="acct-drawer-scrim" id="acctScrim"></div>' +
      '<aside class="acct-drawer" id="acctDrawer" role="dialog" aria-modal="true" aria-label="Account menu">' +
        '<div class="acct-drawer-grip"></div>' +
        '<div class="acct-drawer-head">' +
          '<span class="avatar avatar-lg avatar-ring" style="background:' +
            MB.avatarColor('johntrader') + '">JT</span>' +
          '<div class="grow">' +
            '<div class="t-h3 w-bold" id="acctName">John Trader</div>' +
            (staffRole
              ? '<div class="t-xs w-semi"><span class="role-tag role-' + staff + '">' + MB.esc(staffRole.label) + '</span></div>'
              : '<div class="t-xs c-up w-semi">' + MB.icon('check', 11) + ' Verified Trader</div>') +
          '</div>' +
          '<button class="acct-drawer-close" id="acctClose" aria-label="Close">' +
            MB.icon('close', 19) + '</button>' +
        '</div>' +
        (staffRole ? '' :
        '<a class="acct-drawer-bal" href="' + r + 'users/wallet/accounts.html">' +
          '<div class="grow"><div class="k">Total Deriv Balance</div>' +
            '<div class="v" id="acctBal">—</div></div>' +
          '<span style="width:110px"><span data-spark="up" data-seed="acctbal" data-h="34" data-sw="2"></span></span>' +
        '</a>') +
        switchItem +
        '<div class="acct-drawer-group">' + items + '</div>' +
        '<div class="acct-drawer-group">' +
          '<a class="acct-drawer-item is-danger" href="' + r + 'auth/login.html" id="acctLogout">' +
            MB.icon('logout', 18) + '<span>Log out</span></a>' +
        '</div>' +
        '<div class="acct-drawer-foot">' + MB.brand({ href: null, small: true }) + '</div>' +
      '</aside>';

    document.body.insertAdjacentHTML('beforeend', html);

    var drawer = document.getElementById('acctDrawer');
    var scrim = document.getElementById('acctScrim');
    var open = document.getElementById('acctOpen');

    function show() {
      drawer.classList.add('is-open'); scrim.classList.add('is-open');
      if (open) { open.setAttribute('aria-expanded', 'true'); }
      document.body.style.overflow = 'hidden';
    }
    function hide() {
      drawer.classList.remove('is-open'); scrim.classList.remove('is-open');
      if (open) { open.setAttribute('aria-expanded', 'false'); }
      document.body.style.overflow = '';
    }
    if (open) { open.addEventListener('click', show); }
    document.getElementById('acctClose').addEventListener('click', hide);
    /* Logging out ends a staff "view as member" session too. */
    document.getElementById('acctLogout').addEventListener('click', function () {
      if (MB.roles) { MB.roles.endStaffSession(); }
    });
    scrim.addEventListener('click', hide);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) { hide(); }
    });

    MB.mountIcons(drawer);
    if (MB.mountCharts) { MB.mountCharts(drawer); }

    /* The headline figure is a cached read, same as everywhere else. */
    if (MB.api && document.getElementById('acctBal')) {
      MB.api.get('accounts').then(function (r2) {
        document.getElementById('acctBal').textContent =
          MB.fmt.money(r2.meta.total_balance, r2.meta.currency);
      }).catch(function () {});
    }
  }

  /* ======================================================================
     BOTTOM TAB BAR — five items, fixed, identical on every customer screen
     ====================================================================== */
  var TABS = [
    { id: 'home',      label: 'Home',      icon: 'home',      href: 'users/index.html' },
    { id: 'markets',   label: 'Markets',   icon: 'markets',   href: 'users/markets/index.html' },
    { id: 'trade',     label: 'Trade',     icon: 'trade',     href: 'users/trade/index.html' },
    { id: 'signals',   label: 'Signals',   icon: 'signals',   href: 'users/signals/index.html' },
    { id: 'community', label: 'Community', icon: 'community', href: 'users/community/index.html' }
  ];

  /* Staff browse the app: markets, signals, rooms and people — nothing of their own. */
  var STAFF_TABS = [
    { id: 'home',      label: 'Home',      icon: 'home',      href: 'users/index.html' },
    { id: 'markets',   label: 'Markets',   icon: 'markets',   href: 'users/markets/index.html' },
    { id: 'signals',   label: 'Signals',   icon: 'signals',   href: 'users/signals/index.html' },
    { id: 'community', label: 'Community', icon: 'community', href: 'users/community/index.html' },
    { id: 'people',    label: 'Users',     icon: 'users',     href: 'users/people.html' }
  ];

  function staffView() { return !!(MB.roles && MB.roles.staffSession()); }

  function renderTabbar(body) {
    var host = MB.$('[data-render="tabbar"]');
    if (!host) { return; }
    var active = body.getAttribute('data-nav');
    var r = MB.root();
    var tabs = staffView() ? STAFF_TABS : TABS;

    host.outerHTML = '<nav class="tabbar" aria-label="Main">' + tabs.map(function (t) {
      return '<a href="' + r + t.href + '"' +
             (t.id === active ? ' class="is-active" aria-current="page"' : '') + '>' +
             MB.icon(t.icon, 22) + '<span>' + t.label + '</span></a>';
    }).join('') + '</nav>';
  }

  /* ======================================================================
     ADMIN SIDEBAR
     ====================================================================== */
  /* The nav is no longer declared here — MB.roles owns it, so moderator,
     admin and superadmin cannot drift apart. See assets/js/core/roles.js. */
  function renderAdminRail(body) {
    var host = MB.$('[data-render="admin-rail"]');
    if (!host) { return; }
    var active = body.getAttribute('data-nav');
    var roleId = MB.roles ? MB.roles.current() : 'admin';
    var role = MB.roles ? MB.roles.get(roleId) : null;
    var r = MB.root();

    var pages = MB.roles ? MB.roles.pages(roleId) : [];
    var items = pages.map(function (n) {
      if (n.group) { return '<div class="admin-nav-group">' + n.group + '</div>'; }
      return '<a href="' + r + n.href + '"' +
        (n.id === active ? ' class="is-active" aria-current="page"' : '') + '>' +
        MB.icon(n.icon, 18) + '<span>' + n.label + '</span>' +
        (n.count ? '<span class="count">' + n.count + '</span>' : '') + '</a>';
    }).join('');

    host.outerHTML =
      '<aside class="admin-rail" id="adminRail">' +
        '<div class="admin-brand">' +
          '<div class="admin-brand-row">' +
            MB.brand({ href: r + 'index.html', small: true, tagline: false }) +
            '<button class="icon-btn admin-rail-close" id="adminRailClose" type="button" aria-label="Close menu">' +
              MB.icon('close', 18) + '</button>' +
          '</div>' +
          '<span class="role-tag role-' + roleId + '">' +
            (role ? MB.esc(role.label) : 'Staff') + '</span>' +
        '</div>' +
        '<nav class="admin-nav" aria-label="' + (role ? MB.esc(role.label) : 'Staff') + '">' +
          items + '</nav>' +
        '<div class="admin-rail-foot">' +
          '<a class="admin-nav" href="' + r + 'users/index.html" id="railSwitchUser" style="display:block">' +
            '<span style="display:flex;align-items:center;gap:12px;padding:10px 12px;' +
            'font-size:13px;font-weight:600;color:var(--mb-text-2)">' +
            MB.icon('refresh', 18) + 'Switch to user view</span></a>' +
          '<a class="admin-nav" href="' + r + 'auth/login.html" style="display:block">' +
            '<span style="display:flex;align-items:center;gap:12px;padding:10px 12px;' +
            'font-size:13px;font-weight:600;color:var(--mb-sell)">' +
            MB.icon('logout', 18) + 'Log out</span></a>' +
        '</div>' +
      '</aside>' +
      '<div class="admin-scrim" id="adminScrim"></div>';
  }

  /* ======================================================================
     PUBLIC SITE HEADER + FOOTER
     ====================================================================== */
  var SITE_NAV = [
    { id: 'home',     label: 'Home',       href: 'index.html',          icon: 'home' },
    { id: 'features', label: 'Features',   href: 'index.html#features', icon: 'grid' },
    { id: 'markets',  label: 'Markets',    href: 'users/markets/index.html', icon: 'markets' },
    { id: 'signals',  label: 'Signals',    href: 'users/signals/index.html', icon: 'signals' },
    { id: 'community',label: 'Community',  href: 'users/community/index.html', icon: 'community' },
    { id: 'resources',label: 'Resources',  href: 'users/resources/index.html', icon: 'resources' },
    { id: 'about',    label: 'About',      href: 'about.html',          icon: 'info' },
    { id: 'contact',  label: 'Contact',    href: 'contact.html',        icon: 'mail' },
    { id: 'faq',      label: 'Help & FAQ', href: 'faq.html',            icon: 'chat' }
  ];

  /* Header carries the brand and one menu control. Everything else lives in
     the drawer, which slides in from the right. */
  function renderSiteHeader(body) {
    var host = MB.$('[data-render="site-header"]');
    if (!host) { return; }
    var active = body.getAttribute('data-nav');
    var r = MB.root();

    var links = SITE_NAV.map(function (n) {
      return '<a href="' + r + n.href + '"' + (n.id === active ? ' class="is-active"' : '') + '>' +
        MB.icon(n.icon, 19) + '<span>' + n.label + '</span></a>';
    }).join('');

    host.outerHTML =
      '<header class="site-header">' +
        '<div class="container inner">' +
          MB.brand({ href: r + 'index.html' }) +
          '<button class="menu-btn" id="drawerOpen" aria-label="Open menu" ' +
            'aria-expanded="false" aria-controls="siteDrawer">' +
            MB.icon('menu', 18) + '<span class="lbl">Menu</span></button>' +
        '</div>' +
      '</header>' +

      '<div class="drawer-scrim" id="drawerScrim"></div>' +
      '<aside class="drawer" id="siteDrawer" role="dialog" aria-modal="true" aria-label="Site menu">' +
        '<div class="drawer-head">' +
          MB.brand({ href: r + 'index.html', small: true }) +
          '<button class="drawer-close" id="drawerClose" aria-label="Close menu">' +
            MB.icon('close', 19) + '</button>' +
        '</div>' +

        '<nav class="drawer-nav" aria-label="Site">' + links + '</nav>' +

        '<div class="drawer-label">Account</div>' +
        '<div class="drawer-actions">' +
          '<a class="btn btn-primary btn-block" href="' + r + 'auth/register.html">' +
            MB.icon('userplus', 18) + ' Create free account</a>' +
          '<a class="btn btn-ghost btn-block" href="' + r + 'auth/login.html">' +
            MB.icon('logout', 18) + ' Log in</a>' +
          '<button class="btn btn-outline btn-block" data-install>' +
            MB.icon('download', 18) + ' Install the app</button>' +
        '</div>' +

        '<div class="drawer-legal">' +
          '<a href="' + r + 'terms.html">Terms</a>' +
          '<a href="' + r + 'privacy.html">Privacy</a>' +
          '<a href="' + r + 'risk-disclosure.html">Risk Disclosure</a>' +
          '<a href="' + r + 'signal-disclaimer.html">Signal Disclaimer</a>' +
        '</div>' +

        '<div class="drawer-foot">' +
          '<span class="t">Appearance</span>' +
          '<button class="theme-toggle" data-theme-toggle aria-label="Switch theme"></button>' +
        '</div>' +
      '</aside>';
  }

  /* ======================================================================
     DRAWER
     ====================================================================== */
  function wireDrawer() {
    var open = document.getElementById('drawerOpen');
    var close = document.getElementById('drawerClose');
    var scrim = document.getElementById('drawerScrim');
    var drawer = document.getElementById('siteDrawer');
    if (!open || !drawer) { return; }

    var lastFocus = null;

    function show() {
      lastFocus = document.activeElement;
      drawer.classList.add('is-open');
      scrim.classList.add('is-open');
      open.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      var first = drawer.querySelector('a, button');
      if (first) { first.focus(); }
    }
    function hide() {
      drawer.classList.remove('is-open');
      scrim.classList.remove('is-open');
      open.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (lastFocus) { lastFocus.focus(); }
    }

    open.addEventListener('click', show);
    close.addEventListener('click', hide);
    scrim.addEventListener('click', hide);
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) { hide(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) { hide(); }
    });
  }

  /* ======================================================================
     PERMISSIONS IN MARKUP

     Any element carrying data-can="<action>" is removed when the portal's
     role does not hold that action. This is what lets moderator/, admin/
     and superadmin/ share the same page markup: the role on <body> decides
     which controls survive, so there is no per-portal copy of the logic.

     Multiple actions may be listed space-separated; the element survives if
     the role holds ANY of them.

     Removing, not hiding: a control that is merely hidden still exists in
     the DOM and still reads as an offer. Stage 2 enforces the same manifest
     server side — this pass is presentation, never protection.
     ====================================================================== */
  function applyPermissions(scope) {
    if (!MB.roles) { return; }
    var role = MB.roles.current();
    MB.$$('[data-can]', scope || document).forEach(function (el) {
      var ok = el.getAttribute('data-can').split(/\s+/).some(function (a) {
        return a && MB.roles.can(a, role);
      });
      if (!ok) { el.remove(); }
    });
    /* Staff browse the app without an account of their own: member-only
       blocks (balance, wallet, trades, own profile) carry data-not-staff and
       go; staff-only blocks carry data-staff-only and go for everyone else. */
    var staff = MB.roles.isStaff(role);
    MB.$$(staff ? '[data-not-staff]' : '[data-staff-only]', scope || document).forEach(function (el) { el.remove(); });
  }
  MB.applyPermissions = applyPermissions;

  function renderSiteFooter() {
    var host = MB.$('[data-render="site-footer"]');
    if (!host) { return; }
    var r = MB.root();
    var y = new Date().getFullYear();

    host.outerHTML =
      '<footer class="site-footer">' +
        '<div class="container">' +
          '<div class="footer-grid">' +
            '<div class="footer-col footer-about">' +
              MB.brand({ href: r + 'index.html' }) +
              '<p>A Deriv-connected social trading platform. Trade supported synthetic ' +
              'index contracts, follow traders who specialise in your markets, and learn ' +
              'in one place.</p>' +
              '<div class="footer-social">' +
                '<a href="#" aria-label="Community chat">' + MB.icon('chat', 17) + '</a>' +
                '<a href="#" aria-label="Email us">' + MB.icon('mail', 17) + '</a>' +
                '<a href="#" aria-label="Website">' + MB.icon('globe', 17) + '</a>' +
              '</div>' +
            '</div>' +
            '<div class="footer-col"><h4>Platform</h4>' +
              '<a href="' + r + 'users/markets/index.html">Markets</a>' +
              '<a href="' + r + 'users/trade/index.html">Trade</a>' +
              '<a href="' + r + 'users/signals/index.html">Signals</a>' +
              '<a href="' + r + 'users/community/index.html">Community</a>' +
              '<a href="' + r + 'users/results/index.html">Leaderboards</a>' +
              '<a href="' + r + 'users/resources/index.html">Resources</a>' +
            '</div>' +
            '<div class="footer-col"><h4>Company</h4>' +
              '<a href="' + r + 'about.html">About</a>' +
              '<a href="' + r + 'contact.html">Contact</a>' +
              '<a href="' + r + 'faq.html">Help &amp; FAQ</a>' +
              '<a href="' + r + 'auth/register.html">Create account</a>' +
            '</div>' +
            '<div class="footer-col"><h4>Legal</h4>' +
              '<a href="' + r + 'terms.html">Terms of Service</a>' +
              '<a href="' + r + 'privacy.html">Privacy Policy</a>' +
              '<a href="' + r + 'risk-disclosure.html">Risk Disclosure</a>' +
              '<a href="' + r + 'signal-disclaimer.html">Signal Disclaimer</a>' +
            '</div>' +
          '</div>' +

          '<div class="risk-strip">' +
            '<div class="rt">' + MB.icon('warning', 17) + 'Trading involves substantial risk</div>' +
            '<p>Trading synthetic indices and other leveraged products carries a high level of risk ' +
            'and may not be suitable for all investors. You could lose more than your initial ' +
            'investment. KonfluenX does not hold client funds and does not provide investment ' +
            'advice. Signals and analysis are user-generated and are not recommendations by ' +
            'KonfluenX. Past performance does not guarantee future results. Please read our ' +
            '<a href="' + r + 'risk-disclosure.html">Risk Disclosure</a> before trading.</p>' +
          '</div>' +

          '<div class="footer-bottom">' +
            '<span>&copy; ' + y + ' KonfluenX. All rights reserved.</span>' +
            '<span class="links">' +
              '<a href="' + r + 'terms.html">Terms</a>' +
              '<a href="' + r + 'privacy.html">Privacy</a>' +
              '<a href="' + r + 'risk-disclosure.html">Risk</a>' +
              '<a href="' + r + 'contact.html">Contact</a>' +
            '</span>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  /* ======================================================================
     DISCLAIMERS (directive §16)

     Four notices, each versioned. Acceptance is stored per key as
     { key, version, accepted_at } in localStorage 'mb.disclaimers', and a
     notice shows again only when its version string changes.

       MB.disclaimer.require('paid_room').then(join, stayPut);

     require() resolves once the notice is accepted (immediately if it
     already was) and rejects with Error('declined') otherwise. The customer
     app gates three areas on first visit by path — trade, signals and
     community — and declining one of those returns the user to Home.

     Defined at load, not on ready, so any page script can call it
     synchronously after shell.js.

     Stage 2: acceptance is a legal record. The backend stores
     (user_id, key, version, accepted_at, ip, user_agent) in an append-only
     table, /me returns the accepted versions, and server-side actions that
     need a notice (placing a trade, paying for a room) refuse until the
     current version is on file. localStorage is only the Stage 1 stand-in.
     ====================================================================== */
  var DISCLAIMER_KEY = 'mb.disclaimers';

  var DISCLAIMERS = {
    trade: {
      version: '2026-10-12',
      title: 'Risk Disclosure',
      sub: 'Please read before you trade',
      points: [
        'Trading synthetic indices, forex, crypto and other leveraged products carries a high level of risk. You can lose all of the money you put in.',
        'Trades are placed on your own Deriv account. Deriv executes and settles them; KonfluenX never holds your funds.',
        'Nothing on KonfluenX is investment advice. Past performance, including verified results, does not guarantee future results.',
        'Only trade with money you can afford to lose.'
      ],
      links: [{ label: 'Full Risk Disclosure', href: 'users/legal/risk-disclosure.html' }],
      accept: 'I understand the risks'
    },
    signals: {
      version: '2026-10-12',
      title: 'User-Generated Signal Disclaimer',
      sub: 'Signals are posted by members, not by KonfluenX',
      points: [
        'Signals and analysis are published by community members. They are not recommendations or advice from KonfluenX.',
        'Results and performance points are measured automatically against market prices. They describe what already happened and do not predict what happens next.',
        'You decide whether to act on a signal, and any trade you place is your own decision and your own risk.',
        'Report any signal that looks misleading so a moderator can review it.'
      ],
      links: [
        { label: 'Signal Disclaimer', href: 'users/legal/signal-disclaimer.html' },
        { label: 'Risk Disclosure', href: 'users/legal/risk-disclosure.html' }
      ],
      accept: 'I understand'
    },
    community: {
      version: '2026-10-12',
      title: 'Community Guidelines',
      sub: 'What we expect from every member',
      points: [
        'Be respectful. No harassment, hate speech, spam or impersonation.',
        'Never promise guaranteed profits, ask members for money outside KonfluenX, offer to manage accounts or ask for login details.',
        'Posts, comments and analysis are the opinion of their authors, not of KonfluenX, and are not financial advice.',
        'Moderators may remove content or restrict accounts that break these guidelines.'
      ],
      links: [
        { label: 'Community Guidelines', href: 'users/legal/community-guidelines.html' },
        { label: 'Report content', href: 'users/legal/report.html' }
      ],
      accept: 'I agree to the guidelines'
    },
    paid_room: {
      version: '2026-10-12',
      title: 'Subscription & Trading Risk Notice',
      sub: 'Before you pay for a room',
      points: [
        'A room subscription is paid in KX credits and buys access to the creator’s content and discussion only. It does not buy trades, results or any guarantee.',
        'Creators are independent members. Their verified past performance does not guarantee future results.',
        'Any trade you place after reading room content is your own decision, on your own Deriv account, at your own risk.',
        'Renewals, cancellations and refunds follow the Terms of Service.'
      ],
      links: [
        { label: 'Terms of Service', href: 'terms.html' },
        { label: 'Risk Disclosure', href: 'users/legal/risk-disclosure.html' }
      ],
      accept: 'I understand and agree'
    }
  };

  /* Customer-app areas that gate on first visit. */
  var DISCLAIMER_GATES = [
    { re: /\/users\/trade\//,     key: 'trade' },
    { re: /\/users\/signals\//,   key: 'signals' },
    { re: /\/users\/community\//, key: 'community' }
  ];

  function readDisclaimers() {
    try {
      var v = JSON.parse(localStorage.getItem(DISCLAIMER_KEY) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch (e) { return {}; }
  }
  function writeDisclaimer(key) {
    var all = readDisclaimers();
    all[key] = { key: key, version: DISCLAIMERS[key].version, accepted_at: new Date().toISOString() };
    try { localStorage.setItem(DISCLAIMER_KEY, JSON.stringify(all)); }
    catch (e) { /* private mode — accepted for this page view only */ }
    return all[key];
  }

  var sessionAccepted = {};   /* survives a storage failure for this page view */
  var pendingDisclaimer = {}; /* one open sheet per key, however many callers */

  function isAccepted(key) {
    var d = DISCLAIMERS[key];
    if (!d) { return false; }
    if (sessionAccepted[key] === d.version) { return true; }
    var rec = readDisclaimers()[key];
    return !!(rec && rec.version === d.version);
  }

  function openDisclaimer(key, resolve, reject) {
    var d = DISCLAIMERS[key];
    var r = MB.root();
    var lastFocus = document.activeElement;
    var settled = false;
    var cid = 'dcAgree_' + key;

    var body =
      '<div class="dc-body">' +
        '<ul class="dc-points">' + d.points.map(function (p) {
          return '<li>' + MB.icon('info', 15) + '<span>' + MB.esc(p) + '</span></li>';
        }).join('') + '</ul>' +
        '<div class="dc-links">' + d.links.map(function (l) {
          return '<a href="' + r + l.href + '" target="_blank" rel="noopener">' +
            MB.icon('file', 14) + MB.esc(l.label) + '</a>';
        }).join('') + '</div>' +
        '<label class="check dc-agree" for="' + cid + '">' +
          '<input type="checkbox" id="' + cid + '">' +
          '<span class="box">' + MB.icon('check', 13) + '</span>' +
          '<span>I have read and understood this notice.</span>' +
        '</label>' +
        '<p class="dc-ver">Version ' + MB.esc(d.version) + '</p>' +
      '</div>';

    var m = MB.modal({
      title: d.title,
      sub: d.sub,
      body: body,
      actions: [
        { label: 'Decline', kind: 'ghost', close: true },
        { label: d.accept, kind: 'brand', disabled: true, onClick: function (h) {
          settled = true;
          sessionAccepted[key] = d.version;
          var rec = writeDisclaimer(key);
          h.close();
          resolve(rec);
        } }
      ],
      /* Escape, the close button and Decline all land here undecided. */
      onClose: function () {
        document.removeEventListener('keydown', trap, true);
        if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
        if (!settled) { settled = true; reject(new Error('declined')); }
      }
    });

    var sheet = m.$('.sheet');
    sheet.classList.add('dc-sheet');
    sheet.setAttribute('aria-describedby', 'dcDesc_' + key);
    m.$('.dc-points').id = 'dcDesc_' + key;

    /* A stray tap on the backdrop must not count as an answer. Capture
       phase, so neither MB.modal nor the global sheet handler sees it. */
    m.root.addEventListener('click', function (e) {
      if (e.target === m.root) { e.stopImmediatePropagation(); }
    }, true);

    var agree = m.$('#' + cid);
    agree.addEventListener('change', function () {
      m.setAction(1, { disabled: !agree.checked });
    });

    /* Focus trap — Tab and Shift+Tab cycle inside the sheet. */
    function focusables() {
      return Array.prototype.slice.call(sheet.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    }
    function trap(e) {
      if (e.key !== 'Tab') { return; }
      var f = focusables();
      if (!f.length) { return; }
      var first = f[0], last = f[f.length - 1];
      if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', trap, true);
    setTimeout(function () { agree.focus(); }, 60);
  }

  MB.disclaimer = {
    KEYS: Object.keys(DISCLAIMERS),
    /** The copy and version for a key — for legal pages and settings. */
    get: function (key) { return DISCLAIMERS[key] || null; },
    accepted: isAccepted,
    /** The stored acceptance records, keyed by notice. */
    records: readDisclaimers,
    require: function (key) {
      if (!DISCLAIMERS[key]) { return Promise.reject(new Error('unknown disclaimer: ' + key)); }
      if (isAccepted(key)) {
        return Promise.resolve(readDisclaimers()[key] ||
          { key: key, version: DISCLAIMERS[key].version, accepted_at: null });
      }
      if (pendingDisclaimer[key]) { return pendingDisclaimer[key]; }
      var p = new Promise(function (resolve, reject) {
        MB.ready(function () { openDisclaimer(key, resolve, reject); });
      });
      pendingDisclaimer[key] = p;
      var clear = function () { delete pendingDisclaimer[key]; };
      p.then(clear, clear);
      return p;
    },
    /** QA helper: forget one acceptance (or all) so the notice shows again. */
    reset: function (key) {
      var all = key ? readDisclaimers() : {};
      if (key) { delete all[key]; delete sessionAccepted[key]; } else { sessionAccepted = {}; }
      try { localStorage.setItem(DISCLAIMER_KEY, JSON.stringify(all)); } catch (e) {}
    }
  };

  function gateByPath() {
    var path = String(location.pathname || '').replace(/\\/g, '/');
    for (var i = 0; i < DISCLAIMER_GATES.length; i++) {
      if (DISCLAIMER_GATES[i].re.test(path)) {
        MB.disclaimer.require(DISCLAIMER_GATES[i].key).catch(function () {
          location.href = MB.url('users/index.html');
        });
        return;
      }
    }
  }

  /* ======================================================================
     BOOT
     ====================================================================== */
  /* ======================================================================
     SESSION

     The customer app has no <body data-role>, so the signed-in user's role
     comes from /me. Loaded once here, handed to MB.roles, and announced as
     'mb:session' so a page can render its moderator controls the moment it
     knows who is looking.
     ====================================================================== */
  function bootSession() {
    if (!MB.roles || !MB.api) { return; }
    MB.api.get('me').then(function (r) {
      var u = r.data || {};
      MB.session = u;
      /* A staff member who switched in keeps their console role here. */
      MB.roles.setUser(MB.roles.staffSession() || u.role);
      if (MB.applyPermissions) { MB.applyPermissions(); }
      document.dispatchEvent(new CustomEvent('mb:session', { detail: { user: u } }));
    }).catch(function () { /* a signed-out visitor simply has no role */ });
  }

  /* ======================================================================
     SWITCH PROFILE — console <-> customer app for admin / superadmin.
     In the app a staff member is an ordinary member with the money actions
     removed (data-not-staff) and the funding pages closed (data-staff-blocked).
     ====================================================================== */
  function wireSwitchToUser() {
    var a = document.getElementById('railSwitchUser');
    if (!a || !MB.roles) { return; }
    a.addEventListener('click', function () { MB.roles.switchToUser(MB.roles.current()); });
  }

  function renderStaffBar(body) {
    if (!MB.roles) { return; }
    var staff = MB.roles.staffSession();
    if (!staff) { return; }
    var role = MB.roles.get(staff);
    var r = MB.root();
    var top = MB.$('.topbar');
    if (!top) { return; }
    top.insertAdjacentHTML('afterend',
      '<div class="staff-bar" role="status">' +
        '<span class="role-tag role-' + staff + '">' + MB.esc(role.label) + '</span>' +
        '<span class="grow">Staff view &middot; browse markets, signals, rooms and users</span>' +
        '<a href="' + r + role.home + 'index.html">' + MB.icon('back', 14) + ' Console</a>' +
      '</div>');

    /* Staff have no wallet, trades, signals of their own or member profile. */
    var path = location.pathname.replace(/\\/g, '/');
    var MEMBER_ONLY = /\/users\/(trade|wallet|creator)\/|\/users\/profile\/(index|rewards|achievements|partner[^/]*|saved)\.html|\/users\/signals\/compose\.html|\/users\/institutional\/(index|apply|team|audit|accounts)\.html/;
    if (body.hasAttribute('data-staff-blocked') || MEMBER_ONLY.test(path)) {
      var main = MB.$('main.page');
      if (main) {
        main.innerHTML = '<div class="empty" style="padding:64px 20px">' + MB.icon('shield', 44) +
          '<h3>Staff accounts don’t have this</h3>' +
          '<p>There is no wallet, trading, own signals or member profile on a staff account. ' +
          'Browse markets, signals, rooms and users, or open someone’s profile from Users.</p>' +
          '<div class="row g2 center mt4" style="justify-content:center">' +
            '<a class="btn btn-primary btn-sm" href="' + r + 'users/people.html">' + MB.icon('users', 16) + ' Users</a>' +
            '<a class="btn btn-ghost btn-sm" href="' + r + role.home + 'index.html">Console</a>' +
          '</div></div>';
        MB.mountIcons(main);
      }
      return;
    }
    /* "Institutional" entry points lead staff to the institutions directory. */
    MB.$$('a[href$="institutional/index.html"]').forEach(function (a) {
      a.setAttribute('href', r + 'users/people.html?type=institution');
    });
    /* Top traders on the staff home, each opening a public profile. */
    var top5 = document.getElementById('staffTop');
    if (top5 && MB.render && MB.card && MB.card.provider) {
      MB.render({ into: '#staffTop', from: 'providers', limit: 5, template: MB.card.provider });
    }
  }

  MB.mountShell = function () {
    var body = document.body;
    var shell = body.getAttribute('data-shell');

    if (shell === 'app')   { renderTopbar(body); renderTabbar(body); renderAcctDrawer(); body.classList.add('has-app'); renderStaffBar(body); applyPermissions(); bootSession(); gateByPath(); }
    /* Auth pages do not load roles.js — end a staff session directly. */
    if (shell === 'auth')  { body.classList.add('has-auth'); try { localStorage.removeItem('mb.session.role'); } catch (e) {} }
    if (shell === 'admin') { renderAdminRail(body); applyPermissions(); wireSwitchToUser(); }
    if (shell === 'site')  { renderSiteHeader(body); renderSiteFooter(); }

    MB.mountIcons();
    if (MB.mountCharts) { MB.mountCharts(); }
    if (MB.mountTicks)  { MB.mountTicks(); }

    wireDrawer();

    /* Admin burger */
    var ab = document.getElementById('adminBurger');
    var rail = document.getElementById('adminRail');
    if (ab && rail) {
      var scrim = document.getElementById('adminScrim');
      var setOpen = function (open) {
        rail.classList.toggle('is-open', open);
        if (scrim) { scrim.classList.toggle('is-open', open); }
        document.documentElement.classList.toggle('admin-nav-open', open);
        ab.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) { var cur = rail.querySelector('[aria-current="page"]') || rail.querySelector('a'); if (cur) { cur.focus({ preventScroll: true }); } }
      };
      ab.setAttribute('aria-controls', 'adminRail');
      ab.setAttribute('aria-expanded', 'false');
      ab.addEventListener('click', function () { setOpen(!rail.classList.contains('is-open')); });
      if (scrim) { scrim.addEventListener('click', function () { setOpen(false); }); }
      var rc = document.getElementById('adminRailClose');
      if (rc) { rc.addEventListener('click', function () { setOpen(false); ab.focus(); }); }
      rail.addEventListener('click', function (e) { if (e.target.closest('a[href]')) { setOpen(false); } });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && rail.classList.contains('is-open')) { setOpen(false); ab.focus(); }
      });
      /* Rotating a tablet past the breakpoint must not leave the page locked. */
      window.matchMedia('(min-width: 1021px)').addEventListener('change', function (m) { if (m.matches) { setOpen(false); } });
    }

    /* Theme toggles, anywhere on the page */
    MB.$$('[data-theme-toggle]').forEach(function (btn) {
      var paint = function () {
        btn.innerHTML = MB.icon(MB.theme.resolved() === 'dark' ? 'sun' : 'moon', 18);
      };
      paint();
      btn.addEventListener('click', function () { MB.theme.toggle(); paint(); });
      document.addEventListener('mb:theme', paint);
    });
  };

  MB.ready(MB.mountShell);
})(window);
