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
        '<div class="stat-cell"><div class="stat-v ' + profitCls + '">' +
          (a.profit_total >= 0 ? '+' : '') + fmt.money(a.profit_total) + '</div>' +
          '<div class="stat-k">Profit</div></div>' +
        '<div class="stat-cell"><div class="stat-v ' + profitCls + '">' +
          fmt.pct(a.profit_pct) + '</div>' +
          '<div class="stat-k">Return</div></div>' +
        '<div class="stat-cell"><div class="stat-v">' +
          fmt.pct(a.win_rate) + '</div>' +
          '<div class="stat-k">Win Rate</div></div>' +
        '<div class="stat-cell"><div class="stat-v">' +
          (a.trades_total || 0) + '</div>' +
          '<div class="stat-k">Trades</div></div>' +
      '</div>' +
      '<div class="between mt3">' +
        '<div class="t-xs c-3">Max drawdown: ' + fmt.pct(a.drawdown_max) + '</div>' +
        '<a class="btn btn-sm btn-ghost" href="' + detailHref + '">' +
          MB.icon('chevright', 14) + ' Details</a>' +
      '</div>' +
    '</div>';
  };

  C.instAccountPublic = function (a) {
    var profitCls = a.profit_total >= 0 ? 'c-up' : 'c-down';
    var detailHref = 'account.html?id=' + a.id;

    return '<div class="card inst-acct-card">' +
      '<div class="between">' +
        '<div class="row g2">' +
          '<span class="w-semi">' + MB.esc(a.login) + '</span>' +
          '<span class="badge">' + MB.esc(a.platform) + '</span>' +
          '<span class="badge">' + MB.esc(a.type) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="t-sm w-bold mt2">' + fmt.money(a.balance) +
        '<span class="t-xs c-3 w-reg"> ' + a.currency + '</span></div>' +
      '<div class="stat-grid stat-grid-sm mt3">' +
        '<div class="stat-cell"><div class="stat-v ' + profitCls + '">' +
          (a.profit_total >= 0 ? '+' : '') + fmt.money(a.profit_total) + '</div>' +
          '<div class="stat-k">Profit</div></div>' +
        '<div class="stat-cell"><div class="stat-v ' + profitCls + '">' +
          fmt.pct(a.profit_pct) + '</div>' +
          '<div class="stat-k">Return</div></div>' +
        '<div class="stat-cell"><div class="stat-v">' + fmt.pct(a.win_rate) + '</div>' +
          '<div class="stat-k">Win Rate</div></div>' +
        '<div class="stat-cell"><div class="stat-v">' + (a.trades_total || 0) + '</div>' +
          '<div class="stat-k">Trades</div></div>' +
      '</div>' +
      '<div class="between mt3">' +
        '<div class="t-xs c-3">Max drawdown: ' + fmt.pct(a.drawdown_max) + '</div>' +
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

  C.instDocument = function (dc) {
    var st = DOC_STATUS[dc.status] || DOC_STATUS.pending;
    return '<div class="card card-flat row g3 inst-doc-row">' +
      '<span data-icon="file" data-icon-size="20"></span>' +
      '<div class="grow">' +
        '<div class="w-semi t-sm">' + MB.esc(dc.label) + '</div>' +
        '<div class="t-xs c-3">Uploaded ' + MB.fmt.date(new Date(dc.uploaded_at)) + '</div>' +
      '</div>' +
      '<span class="badge ' + st.cls + '">' + st.label + '</span>' +
    '</div>';
  };
})(window);
