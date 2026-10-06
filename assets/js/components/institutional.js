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
            '<span class="w-semi t-sm">' + MB.esc(a.login) + '</span>' +
            '<span class="badge">' + MB.esc(a.platform) + '</span>' +
            '<span class="badge">' + MB.esc(a.type) + '</span>' +
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
          fmt.pct(a.profit_pct) + '</div>' +
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
          '<span class="w-semi">' + MB.esc(a.login) + '</span>' +
          '<span class="badge">' + MB.esc(a.platform) + '</span>' +
          '<span class="badge">' + MB.esc(a.type) + '</span>' +
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
          fmt.pct(a.profit_pct) + '</div>' +
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

  C.instTeamMember = function (t) {
    return '<div class="card card-flat row g3">' +
      '<span class="avatar avatar-sm" style="background:' + MB.avatarColor(t.name) + '">' +
        t.name.charAt(0) + '</span>' +
      '<div class="grow">' +
        '<div class="w-semi">' + MB.esc(t.name) + '</div>' +
        '<div class="t-xs c-3">' + MB.esc(t.email) + '</div>' +
      '</div>' +
      '<span class="badge">' + MB.esc(t.role) + '</span>' +
      '<button class="btn btn-sm btn-ghost" aria-label="Remove">' +
        MB.icon('close', 14) + '</button>' +
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
