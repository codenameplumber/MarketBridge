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
      '<path d="M18,39 L40,72 L50,72 L18,47Z" fill="var(--mb-green,#00C853)"/>' +
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

    var inner =
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
            '<div class="topbar-title" style="font-size:var(--mb-t-h2)">' + MB.esc(title || '') + '</div>' +
            (sub ? '<div class="topbar-sub">' + MB.esc(sub) + '</div>' : '') +
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
  var ACCT_NAV = [
    { group: null },
    { label: 'My Dashboard',              icon: 'grid',      href: 'users/index.html' },
    { label: 'Deriv Accounts & Balances', icon: 'wallet',    href: 'users/wallet/accounts.html' },
    { label: 'Transfer Money',            icon: 'refresh',   href: 'users/wallet/transfer.html' },
    { label: 'Transaction History',       icon: 'clock',     href: 'users/wallet/history.html' },
    { label: 'Account Statement',         icon: 'file',      href: 'users/wallet/statement.html' },
    { group: null },
    { label: 'IB / Partner Status',       icon: 'briefcase', href: 'users/profile/partner.html' },
    { label: 'My Signals',                icon: 'signals',   href: 'users/signals/index.html' },
    { label: 'Saved',                     icon: 'bookmark',  href: 'users/profile/saved.html' },
    { label: 'Leaderboard',               icon: 'results',   href: 'users/results/leaderboard.html' },
    { label: 'Rewards',                   icon: 'star',      href: 'users/profile/rewards.html' },
    { label: 'Achievements',              icon: 'flame',     href: 'users/profile/achievements.html' },
    { label: 'My Community Activity',     icon: 'community', href: 'users/community/index.html' },
    { group: null },
    { label: 'Institutional Trading',     icon: 'briefcase', href: 'users/institutional/index.html' },
    { group: 'More' },
    { label: 'Notifications',             icon: 'bell',      href: 'users/notifications.html', count: 3 },
    { label: 'Help & Support',            icon: 'info',      href: 'faq.html' },
    { label: 'Settings',                  icon: 'settings',  href: 'users/profile/settings.html' }
  ];

  function renderAcctDrawer() {
    if (document.getElementById('acctDrawer')) { return; }
    var r = MB.root();

    var items = ACCT_NAV.map(function (n) {
      if (n.group === null) { return '</div><div class="acct-drawer-group">'; }
      if (n.group) { return '<div class="acct-drawer-label">' + n.group + '</div>'; }
      return '<a class="acct-drawer-item" href="' + r + n.href + '">' +
        MB.icon(n.icon, 18) + '<span>' + n.label + '</span>' +
        (n.count ? '<span class="count">' + n.count + '</span>'
                 : '<span class="chev">' + MB.icon('chevright', 16) + '</span>') +
      '</a>';
    }).join('');

    var html =
      '<div class="acct-drawer-scrim" id="acctScrim"></div>' +
      '<aside class="acct-drawer" id="acctDrawer" role="dialog" aria-modal="true" aria-label="Account menu">' +
        '<div class="acct-drawer-grip"></div>' +
        '<div class="acct-drawer-head">' +
          '<span class="avatar avatar-lg avatar-ring" style="background:' +
            MB.avatarColor('johntrader') + '">JT</span>' +
          '<div class="grow">' +
            '<div class="t-h3 w-bold" id="acctName">John Trader</div>' +
            '<div class="t-xs c-up w-semi">' + MB.icon('check', 11) + ' Verified Trader</div>' +
          '</div>' +
          '<button class="acct-drawer-close" id="acctClose" aria-label="Close">' +
            MB.icon('close', 19) + '</button>' +
        '</div>' +
        '<a class="acct-drawer-bal" href="' + r + 'users/wallet/accounts.html">' +
          '<div class="grow"><div class="k">Total Deriv Balance</div>' +
            '<div class="v" id="acctBal">—</div></div>' +
          '<span style="width:110px"><span data-spark="up" data-seed="acctbal" data-h="34" data-sw="2"></span></span>' +
        '</a>' +
        '<div class="acct-drawer-group">' + items + '</div>' +
        '<div class="acct-drawer-group">' +
          '<a class="acct-drawer-item is-danger" href="' + r + 'auth/login.html">' +
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
    scrim.addEventListener('click', hide);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) { hide(); }
    });

    MB.mountIcons(drawer);
    if (MB.mountCharts) { MB.mountCharts(drawer); }

    /* The headline figure is a cached read, same as everywhere else. */
    if (MB.api) {
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

  function renderTabbar(body) {
    var host = MB.$('[data-render="tabbar"]');
    if (!host) { return; }
    var active = body.getAttribute('data-nav');
    var r = MB.root();

    host.outerHTML = '<nav class="tabbar" aria-label="Main">' + TABS.map(function (t) {
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
          MB.brand({ href: r + 'index.html', small: true }) +
          '<span class="role-tag role-' + roleId + '">' +
            (role ? MB.esc(role.label) : 'Staff') + '</span>' +
        '</div>' +
        '<nav class="admin-nav" aria-label="' + (role ? MB.esc(role.label) : 'Staff') + '">' +
          items + '</nav>' +
        '<div class="admin-rail-foot">' +
          '<a class="admin-nav" href="' + r + 'users/index.html" style="display:block">' +
            '<span style="display:flex;align-items:center;gap:12px;padding:10px 12px;' +
            'font-size:13px;font-weight:600;color:var(--mb-text-2)">' +
            MB.icon('external', 18) + 'Customer app</span></a>' +
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
      MB.roles.setUser(u.role);
      if (MB.applyPermissions) { MB.applyPermissions(); }
      document.dispatchEvent(new CustomEvent('mb:session', { detail: { user: u } }));
    }).catch(function () { /* a signed-out visitor simply has no role */ });
  }

  MB.mountShell = function () {
    var body = document.body;
    var shell = body.getAttribute('data-shell');

    if (shell === 'app')   { renderTopbar(body); renderTabbar(body); renderAcctDrawer(); body.classList.add('has-app'); bootSession(); }
    if (shell === 'auth')  { body.classList.add('has-auth'); }
    if (shell === 'admin') { renderAdminRail(body); applyPermissions(); }
    if (shell === 'site')  { renderSiteHeader(body); renderSiteFooter(); }

    MB.mountIcons();
    if (MB.mountCharts) { MB.mountCharts(); }
    if (MB.mountTicks)  { MB.mountTicks(); }

    wireDrawer();

    /* Admin burger */
    var ab = document.getElementById('adminBurger');
    if (ab) {
      var rail = document.getElementById('adminRail');
      var scrim = document.getElementById('adminScrim');
      var close = function () { rail.classList.remove('is-open'); scrim.classList.remove('is-open'); };
      ab.addEventListener('click', function () {
        rail.classList.toggle('is-open'); scrim.classList.toggle('is-open');
      });
      if (scrim) { scrim.addEventListener('click', close); }
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
