/* ==========================================================================
   KonfluenX — INSTITUTIONAL TRADING CARDS

   Card templates for institutional trader dashboards and public portfolios.

   Stage 2:
     MB.card.instAccount(a)       -> <livewire:institutional.account-card ... />
     MB.card.instAccountPublic(a) -> <x-institutional.account-public ... />
     MB.card.instTeamMember(t)    -> <x-institutional.team-row ... />
     MB.card.instDocument(dc)     -> <x-institutional.doc-row ... />
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};
  var C = MB.card = MB.card || {};
  var fmt = MB.fmt;

  var DOC_STATUS = {
    approved: { cls: 'badge-active', label: 'Approved' },
    pending:  { cls: 'badge-warn',   label: 'Pending' },
    rejected: { cls: 'badge-sell',   label: 'Rejected' }
  };

  /* Tiles show "+$8.4K"; the exact figure lives in the title and on the detail page. */
  function shortSigned(n) {
    var v = Number(n || 0);
    return (v >= 0 ? '+' : '-') + '$' + fmt.compact(Math.abs(v));
  }
  /* Rates that are not a change (win rate, drawdown) never carry a "+". */
  function plainPct(n) { return Number(n || 0).toFixed(1) + '%'; }

  C.instAccount = function (a) {
    var profitCls = a.profit_total >= 0 ? 'c-up' : 'c-down';
    var visCls = a.visible ? 'badge-active' : '';
    var detailHref = 'account.html?id=' + a.id;

    return '<div class="card inst-acct-card">' +
      '<div class="between">' +
        '<div>' +
          '<div class="row g2">' +
            '<span class="w-semi t-sm">' + MB.esc(a.name || a.login) + '</span>' +
            '<span class="badge">' + MB.esc(a.platform) + '</span>' +
            '<span class="badge">' + MB.esc(a.type) + '</span>' +
          (a.name ? '<span class="t-xs c-3">' + MB.esc(a.login) + '</span>' : '') +
          '</div>' +
          '<div class="t-sm w-bold mt2">' + fmt.money(a.balance) +
            '<span class="t-xs c-3 w-reg"> ' + a.currency + '</span></div>' +
        '</div>' +
        '<button class="badge inst-vis-toggle ' + visCls + '" data-acct="' + a.id + '">' +
          (a.visible ? 'Visible' : 'Hidden') + '</button>' +
      '</div>' +
      '<div class="stat-grid stat-grid-sm mt3">' +
        '<div class="stat-cell"><div class="stat-v ' + profitCls + '" title="' + fmt.signed(a.profit_total) + '">' +
          shortSigned(a.profit_total) + '</div>' +
          '<div class="stat-k">Profit</div></div>' +
        '<div class="stat-cell"><div class="stat-v ' + profitCls + '">' +
          fmt.pct(a.profit_pct, 1) + '</div>' +
          '<div class="stat-k">Return</div></div>' +
        '<div class="stat-cell"><div class="stat-v">' +
          plainPct(a.win_rate) + '</div>' +
          '<div class="stat-k">Win Rate</div></div>' +
        '<div class="stat-cell"><div class="stat-v">' +
          (a.trades_total || 0) + '</div>' +
          '<div class="stat-k">Trades</div></div>' +
      '</div>' +
      '<div class="between mt3">' +
        '<div class="t-xs c-3">Max drawdown: -' + plainPct(Math.abs(a.drawdown_max)) + '</div>' +
        '<a class="btn btn-sm btn-ghost" href="' + detailHref + '">' +
          MB.icon('chevright', 14) + ' Details</a>' +
      '</div>' +
    '</div>';
  };

  C.instAccountPublic = function (a, opts) {
    var o = opts || {};
    var profitCls = a.profit_total >= 0 ? 'c-up' : 'c-down';
    var detailHref = 'account.html?id=' + encodeURIComponent(a.id) + (o.query || '');

    return '<div class="card inst-acct-card">' +
      '<div class="between">' +
        '<div class="row g2">' +
          '<span class="w-semi">' + MB.esc(a.name || a.login) + '</span>' +
          '<span class="badge">' + MB.esc(a.platform) + '</span>' +
          '<span class="badge">' + MB.esc(a.type) + '</span>' +
          (a.name ? '<span class="t-xs c-3">' + MB.esc(a.login) + '</span>' : '') +
        '</div>' +
      '</div>' +
      (o.hideBalances
        ? '<div class="t-xs c-3 mt2">' + MB.icon('lock', 12) + ' Amounts kept private by the owner</div>'
        : '<div class="t-sm w-bold mt2">' + fmt.money(a.balance) +
            '<span class="t-xs c-3 w-reg"> ' + a.currency + '</span></div>') +
      '<div class="stat-grid stat-grid-sm' + (o.hideBalances ? ' cols-3' : '') + ' mt3">' +
        (o.hideBalances ? '' :
        '<div class="stat-cell"><div class="stat-v ' + profitCls + '" title="' + fmt.signed(a.profit_total) + '">' +
          shortSigned(a.profit_total) + '</div>' +
          '<div class="stat-k">Profit</div></div>') +
        '<div class="stat-cell"><div class="stat-v ' + profitCls + '">' +
          fmt.pct(a.profit_pct, 1) + '</div>' +
          '<div class="stat-k">Return</div></div>' +
        '<div class="stat-cell"><div class="stat-v">' + plainPct(a.win_rate) + '</div>' +
          '<div class="stat-k">Win Rate</div></div>' +
        '<div class="stat-cell"><div class="stat-v">' + (a.trades_total || 0) + '</div>' +
          '<div class="stat-k">Trades</div></div>' +
      '</div>' +
      '<div class="between mt3">' +
        '<div class="t-xs c-3">Max drawdown: -' + plainPct(Math.abs(a.drawdown_max)) + '</div>' +
        '<a class="btn btn-sm btn-ghost" href="' + detailHref + '">' +
          MB.icon('chevright', 14) + ' Details</a>' +
      '</div>' +
    '</div>';
  };

  /* Read-only team row for the dashboard; managing happens on team.html. */
  C.instTeamMember = function (t) {
    var label = MB.instTeam ? MB.instTeam.label(t.role) : t.role;
    return '<div class="card card-flat row g3">' +
      '<span class="avatar avatar-sm" style="background:' + MB.avatarColor(t.name) + '">' +
        MB.esc(t.name.charAt(0)) + '</span>' +
      '<div class="grow" style="min-width:0">' +
        '<div class="w-semi truncate">' + MB.esc(t.name) + '</div>' +
        '<div class="t-xs c-3 truncate">' + MB.esc(t.title || t.email) + '</div>' +
      '</div>' +
      '<span class="role-chip role-' + MB.esc(t.role) + '">' + MB.esc(label) + '</span>' +
    '</div>';
  };

  /* Showcase — who may see the portfolio. Private by default: it is only
     visible while the owner switches it public, or through a private,
     expiring investor link. Stage 1 keeps this in localStorage; Stage 2 the
     server enforces it and the link token is checked server side. */
  var SHOWCASE_KEY = 'mb.inst.showcase';

  function token() {
    var a = new Uint8Array(12);
    (global.crypto || global.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  MB.instShowcase = {
    load: function (d) {
      var base = (d && d.showcase) || {};
      var st = {
        public: !!base.public,
        show_balances: base.show_balances !== false,
        show_history: base.show_history !== false,
        visible: {}, links: []
      };
      ((d && d.linked_accounts) || []).forEach(function (a) { st.visible[a.id] = !!a.visible; });
      try {
        var saved = JSON.parse(localStorage.getItem(SHOWCASE_KEY) || 'null');
        if (saved) { Object.keys(saved).forEach(function (k) { st[k] = saved[k]; }); }
      } catch (e) {}
      return st;
    },
    save: function (st) {
      try { localStorage.setItem(SHOWCASE_KEY, JSON.stringify(st)); } catch (e) {}
    },
    isVisible: function (st, acct) { return !!st.visible[acct.id]; },
    createLink: function (st, label, hours) {
      var link = {
        token: token(), label: String(label || '').trim().slice(0, 40) || 'Investor link',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + hours * 3600000).toISOString()
      };
      st.links.unshift(link);
      return link;
    },
    activeLinks: function (st) {
      var now = Date.now();
      return st.links.filter(function (l) { return new Date(l.expires_at).getTime() > now; });
    },
    linkUrl: function (link) {
      return new URL('portfolio.html?t=' + link.token, location.href).href;
    },
    /* owner | public | link | private | expired.
       Stage 2: "owner" comes from the session, never from ?preview. */
    access: function (st, params) {
      if (params.get('preview') === '1') { return { mode: 'owner' }; }
      var t = params.get('t');
      if (t) {
        var l = st.links.filter(function (x) { return x.token === t; })[0];
        if (l && new Date(l.expires_at).getTime() > Date.now()) { return { mode: 'link', link: l }; }
        return { mode: 'expired' };
      }
      return { mode: st.public ? 'public' : 'private' };
    }
  };

  /* Social links. Stage 1 keeps edits in localStorage; Stage 2 swaps
     load/save for PATCH /institutional/socials. Only http(s) URLs pass. */
  var SOCIAL_KEY = 'mb.inst.socials';
  var PLATFORMS = {
    x:         { label: 'X',         icon: 'xsocial' },
    telegram:  { label: 'Telegram',  icon: 'telegram' },
    instagram: { label: 'Instagram', icon: 'instagram' },
    youtube:   { label: 'YouTube',   icon: 'youtube' },
    website:   { label: 'Website',   icon: 'globe' }
  };

  function safeUrl(u) {
    var s = String(u || '').trim();
    if (!s) { return ''; }
    if (!/^https?:\/\//i.test(s)) { s = 'https://' + s; }
    try { var p = new URL(s); return /^https?:$/.test(p.protocol) && p.hostname.indexOf('.') > 0 ? p.href : ''; }
    catch (e) { return ''; }
  }

  MB.instSocials = {
    PLATFORMS: PLATFORMS,
    safeUrl: safeUrl,
    load: function (fallback) {
      try {
        var raw = localStorage.getItem(SOCIAL_KEY);
        if (raw) { return JSON.parse(raw); }
      } catch (e) {}
      return fallback || [];
    },
    save: function (list) {
      try { localStorage.setItem(SOCIAL_KEY, JSON.stringify(list)); } catch (e) {}
    },
    chips: function (list) {
      return list.filter(function (s) { return PLATFORMS[s.platform] && safeUrl(s.url); })
        .map(function (s) {
          var p = PLATFORMS[s.platform];
          return '<a class="btn btn-ghost btn-xs social-chip" href="' + MB.esc(safeUrl(s.url)) +
            '" target="_blank" rel="noopener noreferrer">' + MB.icon(p.icon, 14) + MB.esc(p.label) + '</a>';
        }).join('');
    }
  };

  /* ======================================================================
     PROFILE TYPES (§1)
     Individual: one Deriv login (its sub-accounts still show under it).
     Institution: verified business, up to 20 Deriv connections, a team,
     company achievements and performance. Both climb the same
     Trader -> Premium -> Pro room path.
     ====================================================================== */
  MB.instProfile = {
    TYPES: {
      individual:  { label: 'Individual',  max: 1,  icon: 'users',
        points: ['One Deriv connection', 'Personal achievements', 'Trader → Premium → Pro rooms'] },
      institution: { label: 'Institution', max: 20, icon: 'bank',
        points: ['Verified business', 'Up to 20 Deriv connections', 'Team with roles and an audit log',
                 'Company achievements and performance', 'Trader → Premium → Pro rooms'] }
    },
    type: function (d) { return (d && d.profile_type) === 'individual' ? 'individual' : 'institution'; },
    maxConnections: function (d) { return MB.instProfile.TYPES[MB.instProfile.type(d)].max; },
    badge: function (d) {
      var t = MB.instProfile.TYPES[MB.instProfile.type(d)];
      return '<span class="ptype-chip ptype-' + MB.instProfile.type(d) + '">' + MB.icon(t.icon, 12) +
        MB.esc(t.label) + (d && d.verified ? ' · Verified' : '') + '</span>';
    }
  };

  /* ======================================================================
     TEAM ROLES & PERMISSIONS (§2)
     One matrix; every control on the institutional pages asks
     MB.instTeam.can(role, action). Stage 2: the server enforces the same
     matrix on every request — hiding a button is not the security.
     ====================================================================== */
  var ROLES = [
    { id: 'owner',             label: 'Owner',             blurb: 'Full control. Cannot be removed; there is always at least one.' },
    { id: 'admin',             label: 'Administrator',     blurb: 'Runs the institution day to day: team, accounts and settings.' },
    { id: 'trader',            label: 'Trader',            blurb: 'Publishes signals and trades on the connected accounts.' },
    { id: 'analyst',           label: 'Analyst',           blurb: 'Writes signal drafts; publishes directly only if the institution allows it.' },
    { id: 'community_manager', label: 'Community Manager', blurb: 'Runs the rooms and their members.' },
    { id: 'viewer',            label: 'Viewer',            blurb: 'Read-only access to dashboards and performance.' }
  ];
  var ACTIONS = [
    { id: 'accounts.manage',  label: 'Connected accounts',   hint: 'Connect, remove, show or hide Deriv accounts' },
    { id: 'signals.publish',  label: 'Publish signals',      hint: 'Post signals under the institution' },
    { id: 'signals.draft',    label: 'Create drafts',        hint: 'Write signal drafts' },
    { id: 'signals.approve',  label: 'Approve drafts',       hint: 'Publish or reject analysts’ drafts' },
    { id: 'rooms.manage',     label: 'Rooms & members',      hint: 'Room settings, members, moderation' },
    { id: 'team.manage',      label: 'Team',                 hint: 'Invite, change roles, remove' },
    { id: 'settings.manage',  label: 'Institution settings', hint: 'Profile, approval rules, showcase' },
    { id: 'audit.view',       label: 'Audit log',            hint: 'See who did what' },
    { id: 'view',             label: 'View',                 hint: 'Dashboards and performance' }
  ];
  var MATRIX = {
    owner:             ['accounts.manage', 'signals.publish', 'signals.draft', 'signals.approve', 'rooms.manage', 'team.manage', 'settings.manage', 'audit.view', 'view'],
    admin:             ['accounts.manage', 'signals.publish', 'signals.draft', 'signals.approve', 'rooms.manage', 'team.manage', 'settings.manage', 'audit.view', 'view'],
    trader:            ['signals.publish', 'signals.draft', 'view'],
    analyst:           ['signals.draft', 'view'],
    community_manager: ['rooms.manage', 'view'],
    viewer:            ['view']
  };
  var TEAM_KEY = 'mb.inst.team', SET_KEY = 'mb.inst.teamSettings', ACT_KEY = 'mb.inst.actingAs', DRAFT_KEY = 'mb.inst.drafts';

  function readJSON(k, fb) {
    try { var raw = localStorage.getItem(k); if (raw) { return JSON.parse(raw); } } catch (e) {}
    return fb;
  }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  MB.instTeam = {
    ROLES: ROLES, ACTIONS: ACTIONS, MATRIX: MATRIX,
    label: function (role) {
      var r = ROLES.filter(function (x) { return x.id === role; })[0];
      return r ? r.label : String(role || '');
    },
    /* settings.analyst_publish: 'direct' | 'approval' */
    can: function (role, action, settings) {
      var s = settings || MB.instTeam.settings();
      if (action === 'signals.publish' && role === 'analyst') { return s.analyst_publish === 'direct'; }
      return (MATRIX[role] || []).indexOf(action) > -1;
    },
    load: function (d) { return readJSON(TEAM_KEY, null) || ((d && d.team) || []).slice(); },
    save: function (team) { writeJSON(TEAM_KEY, team); },
    settings: function (d) {
      return readJSON(SET_KEY, null) || Object.assign({ analyst_publish: 'approval' }, (d && d.team_settings) || {});
    },
    saveSettings: function (s) { writeJSON(SET_KEY, s); },
    drafts: function (d) { return readJSON(DRAFT_KEY, null) || ((d && d.signal_drafts) || []).slice(); },
    saveDrafts: function (list) { writeJSON(DRAFT_KEY, list); },
    owners: function (team) { return team.filter(function (t) { return t.role === 'owner'; }).length; },

    /* Demo only: which role the viewer is acting as. Stage 2: the role comes
       from the signed-in member's record, never from the client. */
    actingAs: function () {
      var r = readJSON(ACT_KEY, 'owner');
      return MATRIX[r] ? r : 'owner';
    },
    setActingAs: function (role) { if (MATRIX[role]) { writeJSON(ACT_KEY, role); } },
    /* The team member whose name goes into audit lines for the acting role. */
    actor: function (team, role) {
      var r = role || MB.instTeam.actingAs();
      var m = team.filter(function (t) { return t.role === r; })[0] || team.filter(function (t) { return t.is_you; })[0] || team[0];
      return { name: m ? m.name : 'You', role: r };
    },

    /* A small "Acting as" select. onChange(role) fires after it is saved. */
    switcher: function (host, onChange) {
      if (!host) { return; }
      var cur = MB.instTeam.actingAs();
      host.innerHTML = '<div class="acting-as">' +
        '<span class="aa-tag">Demo</span>' +
        '<label class="aa-l" for="actingAsSel">Acting as</label>' +
        '<select class="select select-sm" id="actingAsSel">' + ROLES.map(function (r) {
          return '<option value="' + r.id + '"' + (r.id === cur ? ' selected' : '') + '>' + MB.esc(r.label) + '</option>';
        }).join('') + '</select></div>';
      host.querySelector('select').addEventListener('change', function () {
        MB.instTeam.setActingAs(this.value);
        MB.toast('Now viewing as ' + MB.instTeam.label(this.value));
        if (onChange) { onChange(this.value); }
      });
    },

    /* Remove every [data-inst-can] control the acting role may not use. */
    apply: function (root, role) {
      var r = role || MB.instTeam.actingAs();
      MB.$$('[data-inst-can]', root || document).forEach(function (el) {
        var ok = MB.instTeam.can(r, el.getAttribute('data-inst-can'));
        el.classList.toggle('hide', !ok);
        if (!ok) { el.setAttribute('aria-hidden', 'true'); } else { el.removeAttribute('aria-hidden'); }
      });
    }
  };

  /* ======================================================================
     AUDIT LOG (§2) — Stage 1 localStorage, newest first.
     Stage 2: the server writes every entry; the client only reads.
     ====================================================================== */
  var AUDIT_KEY = 'mb.inst.audit';
  MB.instAudit = {
    TYPES: { signal: 'Signals', team: 'Team', account: 'Accounts', settings: 'Settings', room: 'Rooms' },
    load: function (d) {
      var local = readJSON(AUDIT_KEY, []);
      var seed = (d && d.audit_log) || [];
      return local.concat(seed.filter(function (s) {
        return !local.some(function (l) { return l.id === s.id; });
      })).sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    },
    log: function (entry) {
      var list = readJSON(AUDIT_KEY, []);
      var e = Object.assign({ id: 'au_' + Date.now().toString(36), at: new Date().toISOString() }, entry);
      list.unshift(e);
      writeJSON(AUDIT_KEY, list.slice(0, 300));
      MB.api.post('institutional/audit', e);
      return e;
    },
    /* "Deriv Account 04 connected by Daniel Udo — Administrator" */
    by: function (actor) { return 'by ' + actor.name + ' — ' + MB.instTeam.label(actor.role); }
  };

  /* ======================================================================
     DERIV CONNECTIONS (§3) — up to 20 per institution, OAuth only.
     ====================================================================== */
  var ACCT_KEY = 'mb.inst.accounts';
  MB.instAccounts = {
    load: function (d) {
      var local = readJSON(ACCT_KEY, null);
      var removed = (local && local.removed) || [];
      var added = (local && local.added) || [];
      return ((d && d.linked_accounts) || []).filter(function (a) { return removed.indexOf(a.id) < 0; })
        .concat(added);
    },
    add: function (acct) {
      var local = readJSON(ACCT_KEY, { added: [], removed: [] });
      local.added = (local.added || []).concat([acct]);
      writeJSON(ACCT_KEY, local);
    },
    remove: function (id) {
      var local = readJSON(ACCT_KEY, { added: [], removed: [] });
      local.added = (local.added || []).filter(function (a) { return a.id !== id; });
      local.removed = (local.removed || []).concat([id]);
      writeJSON(ACCT_KEY, local);
    },
    totals: function (list) {
      var sum = function (k) { return list.reduce(function (n, a) { return n + (Number(a[k]) || 0); }, 0); };
      var bal = sum('balance'), pl = sum('profit_total'), trades = sum('trades_total');
      var wins = list.reduce(function (n, a) { return n + (Number(a.trades_total) || 0) * (Number(a.win_rate) || 0) / 100; }, 0);
      return {
        balance: bal, profit: pl, trades: trades,
        return_pct: bal - pl ? pl / (bal - pl) * 100 : 0,
        win_rate: trades ? wins / trades * 100 : 0,
        drawdown: list.reduce(function (m, a) { return Math.max(m, Number(a.drawdown_max) || 0); }, 0),
        count: list.length
      };
    }
  };

  C.instDocument = function (dc) {
    var st = DOC_STATUS[dc.status] || DOC_STATUS.pending;
    return '<div class="card card-flat row g3 inst-doc-row">' +
      '<span class="c-2 none">' + MB.icon('file', 20) + '</span>' +
      '<div class="grow">' +
        '<div class="w-semi t-sm">' + MB.esc(dc.label) + '</div>' +
        '<div class="t-xs c-3">Uploaded ' + MB.fmt.date(new Date(dc.uploaded_at)) + '</div>' +
      '</div>' +
      '<span class="badge ' + st.cls + '">' + st.label + '</span>' +
    '</div>';
  };
})(window);
