/* ==========================================================================
   KonfluenX — CARD TEMPLATES

   One function per reusable card. Each maps 1:1 to a Blade component at
   port time, and the parameters here become the component's props:

     MB.card.signal(s)        -> <x-signal.card :signal="$signal" />
       .signalExecutable(s)   -> <livewire:signal.card-executable ... />
       .signalAnalysis(s)     -> <x-signal.card-analysis ... />
     MB.card.market(m)        -> <x-market.card :market="$market" />
     MB.card.marketRow(m)     -> <x-market.row ... />
     MB.card.post(p)          -> <livewire:community.post-card ... />
     MB.card.provider(u)      -> <x-provider.card ... />
     MB.card.contract(c)      -> <x-trade.contract-row ... />
     MB.card.resource(r)      -> <x-resource.card ... />
     MB.card.leaderRow(row)   -> <x-results.leaderboard-row ... />
     MB.card.notification(n)  -> <x-notification.row ... />
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};
  var C = MB.card = {};

  var R = function () { return MB.root(); };

  /* Small shared fragments ------------------------------------------------ */
  function badges(u) {
    var out = '';
    if (u.is_pro) { out += '<span class="badge badge-pro">Pro</span>'; }
    if (u.is_verified) { out += '<span class="badge badge-verified">' + MB.icon('check', 11) + 'Verified</span>'; }
    return out;
  }

  /* The chip carries the market's 24h direction where the payload has it, so
     a feed shows at a glance which way the thing being discussed is going.
     Stage 2 replaces the denormalised figure with the live feed. */
  function marketChip(m, href) {
    if (!m) { return ''; }
    var url = href || (R() + 'users/markets/detail.html?symbol=' + m.symbol);
    var ch = m.change_pct_24h;
    var move = (ch === undefined || ch === null) ? '' :
      '<span class="cm-move ' + (ch >= 0 ? 'c-up' : 'c-down') + '">' +
        MB.fmt.pct(ch) + '</span>';
    return '<a class="chip-market" href="' + url + '">' +
      MB.esc(m.short_name || m.name) + move + '</a>';
  }

  /* ======================================================================
     SIGNAL CARDS
     Two species. The dispatcher below is the ONLY place that decides which
     one renders, and it decides on `kind` — never on a display flag.
     ====================================================================== */
  C.signal = function (s) {
    return s.kind === 'executable' ? C.signalExecutable(s) : C.signalAnalysis(s);
  };

  function signalHead(s, kindLabel, kindClass) {
    return '<div class="signal-head">' +
      MB.avatar(s.author, 'avatar-sm') +
      '<div class="grow" style="min-width:0">' +
        '<div class="row g2"><span class="signal-author">' + MB.esc(s.author.username) + '</span>' +
          badges(s.author) + '</div>' +
        '<div class="signal-meta">' + MB.esc(s.market.short_name) + ' &middot; ' +
          MB.fmt.ago(s.published_at) + '</div>' +
      '</div>' +
      (s.boost && s.boost.is_boosted
        ? '<span class="badge badge-boost">' + MB.icon('flame', 11) + 'Boosted</span>' : '') +
      '<span class="signal-kind ' + kindClass + '">' + kindLabel + '</span>' +
    '</div>';
  }

  function signalFoot(s) {
    var e = s.engagement || {};
    return '<div class="signal-foot">' +
      '<button data-toggle-icon="heart,heartfill" data-toggle-class="is-liked" aria-label="Like">' +
        MB.icon('heart', 15) + '<span data-count>' + (e.likes || 0) + '</span></button>' +
      '<button aria-label="Comments">' + MB.icon('comment', 15) + '<span>' + (e.comments || 0) + '</span></button>' +
      '<button aria-label="Share">' + MB.icon('share', 15) + '<span>' + (e.shares || 0) + '</span></button>' +
      '<span class="grow"></span>' +
      '<button data-toggle-icon="bookmark,bookmarkfill" data-toggle-class="is-saved" aria-label="Save">' +
        MB.icon('bookmark', 15) + '</button>' +
    '</div>';
  }

  function resultBadge(s) {
    if (!s.result) {
      return s.status === 'active' ? '<span class="badge badge-active">Active</span>' : '';
    }
    var r = s.result;
    var cls = r.outcome === 'won' ? 'badge-won' : r.outcome === 'lost' ? 'badge-lost' : 'badge-neutral';
    var label = r.outcome === 'won' ? (r.hit_level === 'sl' ? 'SL Hit' : (r.hit_level || 'Won').toUpperCase() + ' Hit')
                                    : r.outcome === 'lost' ? 'SL Hit' : r.outcome;
    /* An unverified result must never look like a verified one. */
    var unver = r.verification_status !== 'verified'
      ? '<span class="badge badge-warn" title="Resolved from the provider\'s claim, not from evidence">Unverified</span>' : '';
    return '<span class="badge ' + cls + '">' + MB.esc(label) + '</span>' + unver;
  }

  /* ---------- EXECUTABLE: green, Trade This Signal ---------------------- */
  C.signalExecutable = function (s) {
    var x = s.execution || {};
    var p = x.params || {};
    var dirLabel = (p.direction || s.direction || 'buy').toUpperCase();
    var isSell = /sell|fall|down|put/i.test(dirLabel);

    var paramCells = '';
    if (p.duration) {
      paramCells += cell('Duration', p.duration + (p.duration_unit === 't' ? ' ticks' : ' ' + (p.duration_unit || '')));
    }
    if (p.growth_rate) { paramCells += cell('Growth rate', p.growth_rate + '%'); }
    if (p.multiplier)  { paramCells += cell('Multiplier', 'x' + p.multiplier); }
    if (p.digit !== undefined) { paramCells += cell('Digit', String(p.digit)); }
    if (p.sub_type)    { paramCells += cell('Mode', p.sub_type); }
    if (x.stake_min)   { paramCells += cell('Stake', x.stake_min + '–' + x.stake_max); }
    paramCells += cell('Win rate', (s.author.win_rate || 0) + '%');

    function cell(k, v) {
      return '<div><div class="lk">' + MB.esc(k) + '</div><div class="lv">' + MB.esc(v) + '</div></div>';
    }

    return '<article class="signal-card is-executable' + (s.boost && s.boost.is_boosted ? ' is-boosted' : '') + '">' +
      signalHead(s, 'EXECUTABLE', 'k-exec') +
      '<div class="signal-body">' +
        '<div class="between">' +
          '<span class="signal-dir ' + (isSell ? 'd-sell' : 'd-buy') + '">' +
            MB.icon(isSell ? 'down' : 'up', 17) + dirLabel + '</span>' +
          '<span class="row g1">' + resultBadge(s) + '</span>' +
        '</div>' +
        (s.body ? '<p class="t-sm c-2 mt3 clamp-2">' + MB.esc(s.body) + '</p>' : '') +
        '<div class="signal-params">' + paramCells + '</div>' +
        (s.tags && s.tags.length
          ? '<div class="post-tags">' + s.tags.map(function (t) {
              return '<span class="chip-tag">' + MB.esc(t) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="signal-chart"><div data-chart="candle" data-seed="' + s.id +
          '" data-h="80" data-direction="' + (isSell ? 'down' : 'up') + '"></div></div>' +
        '<a class="btn btn-primary btn-block mt2" href="' +
          (x.trade_route ? R() + 'users/' + x.trade_route.replace('../', '') : R() + 'users/trade/index.html') +
          '">' + MB.icon('trade', 18) + ' Trade This Signal</a>' +
      '</div>' +
      '<div class="signal-disclaimer">Signal not from KonfluenX. Trade at your own risk.</div>' +
      signalFoot(s) +
    '</article>';
  };

  /* ---------- ANALYSIS: red, View Market -------------------------------- */
  C.signalAnalysis = function (s) {
    var a = s.analysis || {};
    var dirLabel = (s.direction || 'neutral').toUpperCase();
    var isSell = s.direction === 'sell';
    var isNeutral = s.direction === 'neutral';

    var entry = a.entry_zone
      ? MB.fmt.price(a.entry_zone.low, 0) + '–' + MB.fmt.price(a.entry_zone.high, 0)
      : MB.fmt.price(a.entry_price, 0);

    var tps = (a.take_profits || []);
    var levels =
      '<div class="level-cell"><div class="lk">Entry</div><div class="lv">' + entry + '</div></div>' +
      '<div class="level-cell is-sl"><div class="lk">Stop Loss</div><div class="lv">' + MB.fmt.price(a.stop_loss, 0) + '</div></div>' +
      (tps[0] !== undefined ? '<div class="level-cell is-tp"><div class="lk">TP1</div><div class="lv">' + MB.fmt.price(tps[0], 0) + '</div></div>' : '') +
      (tps[1] !== undefined ? '<div class="level-cell is-tp"><div class="lk">TP2</div><div class="lv">' + MB.fmt.price(tps[1], 0) + '</div></div>' : '');

    return '<article class="signal-card is-analysis">' +
      signalHead(s, 'ANALYSIS', 'k-anal') +
      '<div class="signal-body">' +
        '<div class="between">' +
          '<span class="signal-dir ' + (isNeutral ? '' : isSell ? 'd-sell' : 'd-buy') + '"' +
            (isNeutral ? ' style="color:var(--mb-text-2)"' : '') + '>' +
            (isNeutral ? '' : MB.icon(isSell ? 'down' : 'up', 17)) + dirLabel + '</span>' +
          '<span class="row g1">' + resultBadge(s) + '</span>' +
        '</div>' +
        (s.body ? '<p class="t-sm c-2 mt3 clamp-2">' + MB.esc(s.body) + '</p>' : '') +
        '<div class="signal-levels' + (tps.length < 2 ? ' cols-3' : '') + '">' + levels + '</div>' +
        (a.risk_reward ? '<div class="t-xs c-3 mt2">Risk/Reward 1:' + a.risk_reward +
          (a.timeframe ? ' &middot; ' + MB.esc(a.timeframe) : '') + '</div>' : '') +
        (s.tags && s.tags.length
          ? '<div class="post-tags">' + s.tags.map(function (t) {
              return '<span class="chip-tag">' + MB.esc(t) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="signal-chart"><div data-chart="candle" data-seed="' + s.id +
          '" data-h="80" data-direction="' + (isSell ? 'down' : 'up') +
          '" data-levels=\'{"entry":1,"sl":1' + (tps[0] ? ',"tp1":1' : '') + (tps[1] ? ',"tp2":1' : '') + '}\'></div></div>' +
        '<a class="btn btn-analysis btn-block mt2" href="' + R() + 'users/markets/detail.html?symbol=' +
          s.market.symbol + '">' + MB.icon('markets', 18) + ' View Market</a>' +
      '</div>' +
      '<div class="signal-disclaimer">Analysis only &mdash; not executable from KonfluenX.</div>' +
      signalFoot(s) +
    '</article>';
  };

  /* Compact list variant for feeds and market pages */
  C.signalMini = function (s) {
    var exec = s.kind === 'executable';
    var isSell = s.direction === 'sell';
    return '<a class="card card-hover" style="border-color:color-mix(in srgb,var(--mb-' +
      (exec ? 'green' : 'analysis') + ') 26%,var(--mb-border));padding:12px" href="' + R() + 'users/signals/detail-' +
      (exec ? 'executable' : 'analysis') + '.html?id=' + s.id + '">' +
      '<div class="row g2">' + MB.avatar(s.author, 'avatar-xs') +
        '<span class="t-sm w-semi grow truncate">' + MB.esc(s.author.username) + '</span>' +
        '<span class="signal-kind ' + (exec ? 'k-exec' : 'k-anal') + '">' + (exec ? 'EXEC' : 'ANALYSIS') + '</span>' +
      '</div>' +
      '<div class="between mt2">' +
        '<span class="t-sm w-bold ' + (isSell ? 'c-down' : 'c-up') + '">' +
          (s.direction || '').toUpperCase() + ' ' + MB.esc(s.market.short_name) + '</span>' +
        '<span class="t-xs c-3">' + MB.fmt.ago(s.published_at) + '</span>' +
      '</div></a>';
  };

  /* ======================================================================
     MARKETS
     ====================================================================== */
  C.market = function (m) {
    var up = m.stats.change_pct_24h >= 0;
    return '<a class="market-card" href="' + R() + 'users/markets/detail.html?symbol=' + m.symbol + '">' +
      '<div class="m-name truncate">' + MB.esc(m.short_name) + '</div>' +
      '<div class="m-price" data-tick="' + m.symbol + '" data-tick-dp="' + m.decimal_places + '" data-tick-flash>' +
        MB.fmt.price(m.stats.last_price, m.decimal_places) + '</div>' +
      '<div class="m-change ' + (up ? 'c-up' : 'c-down') + '">' + MB.fmt.pct(m.stats.change_pct_24h) + '</div>' +
      '<svg class="spark" data-spark="' + (up ? 'up' : 'down') + '" data-seed="' + m.symbol + '" data-h="34"></svg>' +
    '</a>';
  };

  C.marketRow = function (m) {
    var up = m.stats.change_pct_24h >= 0;
    return '<a class="market-row" href="' + R() + 'users/markets/detail.html?symbol=' + m.symbol + '">' +
      '<span class="m-icon" style="color:var(--mb-' + (up ? 'green' : 'sell') + ')">' + MB.esc(m.icon_key) + '</span>' +
      '<span class="grow" style="min-width:0">' +
        '<span class="m-name truncate" style="display:block">' + MB.esc(m.name) + '</span>' +
        '<span class="m-sym">' + MB.esc(m.symbol) + '</span>' +
      '</span>' +
      '<svg class="spark none" style="width:56px" data-spark="' + (up ? 'up' : 'down') +
        '" data-seed="' + m.symbol + '" data-h="26" data-fill="false"></svg>' +
      '<span class="none" style="min-width:84px">' +
        '<span class="m-price" style="display:block" data-tick="' + m.symbol +
          '" data-tick-dp="' + m.decimal_places + '">' + MB.fmt.price(m.stats.last_price, m.decimal_places) + '</span>' +
        '<span class="m-change ' + (up ? 'c-up' : 'c-down') + '" style="display:block">' +
          MB.fmt.pct(m.stats.change_pct_24h) + '</span>' +
      '</span>' +
      '<span class="star none' + (m.is_favorite ? ' is-on' : '') + '">' +
        MB.icon(m.is_favorite ? 'starfill' : 'star', 18) + '</span>' +
    '</a>';
  };

  /* ======================================================================
     COMMUNITY
     ====================================================================== */
  C.post = function (p) {
    var e = p.engagement || {};
    return '<article class="post-card">' +
      '<div class="post-head">' +
        MB.avatar(p.author, 'avatar-sm') +
        '<div class="grow" style="min-width:0">' +
          '<div class="row g2"><span class="post-author">' + MB.esc(p.author.username) + '</span>' +
            badges(p.author) + '</div>' +
          '<div class="post-time">' + MB.fmt.ago(p.created_at) + '</div>' +
        '</div>' +
        '<button class="icon-btn none" aria-label="More options">' + MB.icon('more', 20) + '</button>' +
      '</div>' +
      '<p class="post-body">' + MB.esc(p.body) + '</p>' +
      (p.media && p.media.length
        ? '<div class="post-media"><div data-chart="candle" data-seed="' + p.id + '" data-h="150"></div></div>' : '') +
      '<div class="post-tags">' + marketChip(p.market) +
        (p.tags || []).map(function (t) { return '<span class="chip-tag">' + MB.esc(t) + '</span>'; }).join('') +
      '</div>' +
      '<div class="post-foot">' +
        '<button data-toggle-icon="heart,heartfill" data-toggle-class="is-liked" aria-label="Like">' +
          MB.icon('heart', 16) + '<span data-count>' + (e.likes || 0) + '</span></button>' +
        '<a href="' + R() + 'users/community/post-detail.html?id=' + p.id + '" style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--mb-text-3);font-weight:600">' +
          MB.icon('comment', 16) + '<span>' + (e.comments || 0) + '</span></a>' +
        '<button aria-label="Share">' + MB.icon('share', 16) + '<span>' + (e.shares || 0) + '</span></button>' +
        '<span class="grow"></span>' +
        '<button data-toggle-icon="bookmark,bookmarkfill" data-toggle-class="is-saved" aria-label="Save">' +
          MB.icon('bookmark', 16) + '</button>' +
      '</div>' +
    '</article>';
  };

  C.comment = function (c) {
    var replies = (c.replies || []).map(function (r) {
      return '<div class="comment">' + MB.avatar(r.author, 'avatar-xs') +
        '<div class="grow"><div class="row g2"><span class="comment-name">' + MB.esc(r.author.username) +
        '</span><span class="comment-time">' + MB.fmt.ago(r.created_at) + '</span></div>' +
        '<p class="comment-body">' + MB.esc(r.body) + '</p></div></div>';
    }).join('');

    return '<div class="comment">' + MB.avatar(c.author, 'avatar-sm') +
      '<div class="grow">' +
        '<div class="row g2"><span class="comment-name">' + MB.esc(c.author.username) + '</span>' +
          '<span class="comment-time">' + MB.fmt.ago(c.created_at) + '</span></div>' +
        '<p class="comment-body">' + MB.esc(c.body) + '</p>' +
        '<div class="comment-actions">' +
          '<button>Like &middot; ' + (c.likes || 0) + '</button><button>Reply</button></div>' +
        (replies ? '<div class="comment-replies mt3">' + replies + '</div>' : '') +
      '</div></div>';
  };

  /* ======================================================================
     PROVIDERS
     ====================================================================== */
  C.provider = function (u) {
    return '<a class="provider-card" href="' + R() + 'users/signals/provider.html?u=' + u.username + '">' +
      '<div class="center">' + MB.avatar(u, 'avatar-lg avatar-online') + '</div>' +
      '<div class="p-name truncate">' + MB.esc(u.username) + '</div>' +
      '<div class="t-xs c-3">' + MB.icon('starfill', 11) + ' ' + (u.win_rate / 20).toFixed(1) + '</div>' +
      '<div class="p-stats">' +
        '<div class="p-stat"><div class="v c-up">' + (u.win_rate || 0) + '%</div><div class="k">Win Rate</div></div>' +
        '<div class="p-stat"><div class="v">' + MB.fmt.compact(u.followers) + '</div><div class="k">Followers</div></div>' +
      '</div>' +
      '<span class="btn btn-green-soft btn-sm btn-block">Follow</span>' +
    '</a>';
  };

  /* ======================================================================
     TRADING
     ====================================================================== */
  C.contract = function (c) {
    var win = c.profit >= 0;
    return '<article class="contract-row ' + (win ? 'is-win' : 'is-loss') + '">' +
      '<div class="between">' +
        '<div style="min-width:0">' +
          '<div class="row g2"><span class="cr-market truncate">' + MB.esc(c.label) + '</span>' +
            (c.source_signal_id ? '<span class="badge badge-info">From signal</span>' : '') + '</div>' +
          '<div class="cr-meta">ID ' + MB.esc(c.deriv_contract_id) + ' &middot; ' + MB.fmt.ago(c.purchase_time) + '</div>' +
        '</div>' +
        '<div style="text-align:right" class="none">' +
          '<div class="cr-pl">' + MB.fmt.signed(c.profit) + '</div>' +
          '<div class="cr-meta">Stake ' + MB.fmt.money(c.stake) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="between mt3">' +
        '<div><div class="label">Entry</div><div class="t-sm w-semi num">' +
          MB.fmt.price(c.entry_spot, c.market.decimal_places) + '</div></div>' +
        '<div><div class="label">Current</div><div class="t-sm w-semi num" data-tick="' + c.market.symbol +
          '" data-tick-dp="' + c.market.decimal_places + '">' +
          MB.fmt.price(c.current_spot, c.market.decimal_places) + '</div></div>' +
        '<button class="btn ' + (win ? 'btn-primary' : 'btn-sell') + ' btn-sm none">' +
          (win ? 'Cash Out ' + MB.fmt.money(c.buy_price + c.profit) : 'Sell ' + MB.fmt.money(c.buy_price + c.profit)) +
        '</button>' +
      '</div>' +
    '</article>';
  };

  C.historyRow = function (h) {
    var win = h.status === 'won';
    return '<div class="market-row">' +
      '<span class="none" style="color:var(--mb-' + (win ? 'green' : 'sell') + ')">' +
        MB.icon(win ? 'trendup' : 'trenddown', 20) + '</span>' +
      '<span class="grow" style="min-width:0">' +
        '<span class="m-name truncate" style="display:block">' + MB.esc(h.label) + '</span>' +
        '<span class="m-sym">Stake ' + MB.fmt.money(h.stake) + ' &middot; ' + MB.fmt.ago(h.closed_at) + '</span>' +
      '</span>' +
      '<span class="none" style="text-align:right">' +
        '<span class="m-price ' + (win ? 'c-up' : 'c-down') + '" style="display:block">' +
          MB.fmt.signed(h.profit) + '</span>' +
        '<span class="badge ' + (win ? 'badge-won' : 'badge-lost') + '">' + (win ? 'Won' : 'Lost') + '</span>' +
      '</span>' +
    '</div>';
  };

  /* ======================================================================
     RESULTS
     ====================================================================== */
  C.leaderRow = function (row) {
    var r = row.rank;
    var ch = row.rank_change || 0;
    var pl = row.total_pl || 0;

    /* Rank movement: up the board is green, down is red, level is neutral.
       A leaderboard where every number is green tells the reader nothing. */
    var move = ch === 0
      ? '<span class="lb-move is-flat">&ndash;</span>'
      : '<span class="lb-move ' + (ch > 0 ? 'c-up' : 'c-down') + '">' +
          MB.icon(ch > 0 ? 'up' : 'down', 11) + Math.abs(ch) + '</span>';

    /* Win rate is only green when it actually beats breakeven. */
    var wrClass = row.win_rate >= 50 ? 'c-up' : 'c-down';

    return '<a class="lb-row" href="' + R() + 'users/signals/provider.html?u=' + row.user.username + '">' +
      '<span class="lb-rank' + (r <= 3 ? ' r' + r : '') + '">' + r + '</span>' +
      move +
      MB.avatar(row.user, 'avatar-sm') +
      '<span class="grow" style="min-width:0">' +
        '<span class="lb-name truncate" style="display:block">' + MB.esc(row.user.username) + '</span>' +
        '<span class="t-xs c-3">' + row.signals + ' signals &middot; ' +
          '<span class="c-up">' + (row.wins || 0) + 'W</span> / ' +
          '<span class="c-down">' + (row.losses || 0) + 'L</span>' +
          (row.min_sample_met ? '' : ' &middot; sample too small to rank') + '</span>' +
      '</span>' +
      '<span class="lb-figures">' +
        '<span class="lb-metric ' + wrClass + '">' + row.win_rate + '%</span>' +
        '<span class="lb-pl num ' + (pl >= 0 ? 'c-up' : 'c-down') + '">' +
          MB.fmt.signed(pl) + '</span>' +
      '</span>' +
    '</a>';
  };

  /* ======================================================================
     EDUCATION
     ====================================================================== */
  C.resource = function (r) {
    var lvl = { beginner: 'badge-active', intermediate: 'badge-info', advanced: 'badge-warn' }[r.level] || 'badge-neutral';
    return '<a class="resource-card" href="' + R() + 'users/resources/detail.html?slug=' + r.slug + '">' +
      '<div class="resource-cover">' +
        '<div data-chart="candle" data-seed="' + r.id + '" data-h="124"></div>' +
        '<span class="badge ' + lvl + ' lvl">' + MB.esc(r.level) + '</span>' +
        (r.duration_seconds ? '<span class="dur">' + MB.fmt.duration(r.duration_seconds) + '</span>' : '') +
        (r.type === 'video' || r.type === 'course' ? '<span class="play">' + MB.icon('play', 15) + '</span>' : '') +
      '</div>' +
      '<div class="resource-body">' +
        '<div class="resource-title clamp-2">' + MB.esc(r.title) + '</div>' +
        '<div class="resource-desc clamp-2">' + MB.esc(r.summary) + '</div>' +
        (r.progress_percent
          ? '<div class="mt3"><div class="t-xs c-up w-semi">' + r.progress_percent + '% Complete</div>' +
            '<div class="progress mt2"><i style="width:' + r.progress_percent + '%"></i></div></div>' : '') +
      '</div>' +
    '</a>';
  };

  /* ======================================================================
     NOTIFICATIONS
     ====================================================================== */
  C.notification = function (n) {
    var icons = {
      signal_posted: 'signals', signal_result: 'results', signal_updated: 'refresh',
      comment: 'comment', reply: 'comment', follow: 'userplus', mention: 'chat',
      system: 'megaphone', moderation: 'shield'
    };
    return '<a class="list-row' + (n.read_at ? '' : ' is-unread') + '" href="' + R() + 'users/' + n.deep_link + '">' +
      (n.actor ? MB.avatar(n.actor, 'avatar-sm')
               : '<span class="avatar avatar-sm" style="background:var(--mb-green-soft);color:var(--mb-green)">' +
                 MB.icon(icons[n.type] || 'bell', 16) + '</span>') +
      '<span class="grow" style="min-width:0">' +
        '<span class="lr-title" style="display:block">' + MB.esc(n.title) + '</span>' +
        (n.body ? '<span class="lr-sub">' + MB.esc(n.body) + '</span>' : '') +
      '</span>' +
      '<span class="none" style="text-align:right">' +
        '<span class="t-xs c-3" style="display:block">' + MB.fmt.ago(n.created_at) + '</span>' +
        (n.read_at ? '' : '<span class="unread-dot" style="margin-left:auto;margin-top:4px"></span>') +
      '</span>' +
    '</a>';
  };
})(window);

/* ==========================================================================
   ADDITIONS — compact signal card, rooms, chat, members
   ========================================================================== */
(function (global) {
  'use strict';
  var MB = global.MB;
  var C = MB.card;
  var R = function () { return MB.root(); };

  /* Category label shown on every market reference */
  var CAT = {
    synthetic_indices: 'Synthetics', derived: 'Derived', forex: 'Forex',
    crypto: 'Crypto', commodities: 'Commodities', stock_indices: 'Indices'
  };
  MB.catLabel = function (slug) { return CAT[slug] || slug; };

  /* ======================================================================
     COMPACT SIGNAL CARD — the feed default
     Same dispatch rule as the full card: kind decides, nothing else.
     ====================================================================== */
  C.sig = function (s) {
    var exec = s.kind === 'executable';
    var xp = (s.execution && s.execution.params) || {};
    /* Direction is the glance label — short, and the thing that matters.
       The contract family lives in the detail grid below. */
    var dir = xp.direction || s.direction || 'neutral';
    var isSell = /sell|fall|down|put/i.test(dir);
    var isFlat = dir === 'neutral';
    var m = s.market;
    var label = String(dir).toUpperCase();

    var detail;
    if (exec && s.execution) {
      var p = xp;
      var bits = [];
      if (p.duration) { bits.push(p.duration + (p.duration_unit === 't' ? ' ticks' : '')); }
      if (p.growth_rate) { bits.push(p.growth_rate + '% growth'); }
      if (p.multiplier) { bits.push('x' + p.multiplier); }
      if (p.digit !== undefined) { bits.push('digit ' + p.digit); }
      if (p.sub_type) { bits.push(p.sub_type); }
      bits.push('stake ' + s.execution.stake_min + '–' + s.execution.stake_max);
      detail =
        '<div class="sig-levels cols-3">' +
          cell('Contract', s.execution.contract_label) +
          cell('Setup', bits.slice(0, 2).join(' · ')) +
          cell('Win rate', (s.author.win_rate || 0) + '%') +
        '</div>';
    } else {
      var a = s.analysis || {};
      var tp = a.take_profits || [];
      /* Big numbers lose their decimals so the cell stays readable; small
         ones keep full pip precision, which is where it actually matters. */
      var dp = Math.abs(a.entry_price || 0) >= 10000 ? 0 : m.decimal_places;
      detail =
        '<div class="sig-levels' + (tp.length < 2 ? ' cols-3' : '') + '">' +
          cell('Entry', MB.fmt.price(a.entry_price, dp)) +
          cell('Stop', MB.fmt.price(a.stop_loss, dp), 'is-sl') +
          (tp[0] !== undefined ? cell('TP1', MB.fmt.price(tp[0], dp), 'is-tp') : '') +
          (tp[1] !== undefined ? cell('TP2', MB.fmt.price(tp[1], dp), 'is-tp') : '') +
        '</div>';
    }

    function cell(k, v, cls) {
      return '<div class="' + (cls || '') + '"><div class="k">' + MB.esc(k) +
             '</div><div class="v">' + MB.esc(v) + '</div></div>';
    }

    var result = '';
    if (s.result) {
      var won = s.result.outcome === 'won';
      result = '<span class="badge ' + (won ? 'badge-won' : 'badge-lost') + '">' +
        (won ? (s.result.hit_level || 'won').toUpperCase() : 'SL') + '</span>';
    } else if (s.status === 'active') {
      result = '<span class="badge badge-active">Active</span>';
    }

    var href = R() + 'users/signals/detail-' + (exec ? 'executable' : 'analysis') + '.html?id=' + s.id;

    return '<article class="sig ' + (exec ? 'is-exec' : 'is-anal') + '">' +
      '<div class="sig-top">' +
        MB.avatar(s.author, 'avatar-xs') +
        '<span class="sig-who">' + MB.esc(s.author.username) + '</span>' +
        (s.author.is_pro ? '<span class="badge badge-pro">Pro</span>' : '') +
        (s.boost && s.boost.is_boosted ? '<span class="badge badge-boost">' + MB.icon('flame', 11) + '</span>' : '') +
        '<span class="grow"></span>' +
        '<span class="sig-time">' + MB.fmt.ago(s.published_at) + '</span>' +
        '<span class="sig-kind ' + (exec ? 'k-exec' : 'k-anal') + '">' + (exec ? 'EXEC' : 'ANALYSIS') + '</span>' +
      '</div>' +

      '<div class="sig-mid">' +
        '<span class="sig-dir ' + (isFlat ? 'd-flat' : isSell ? 'd-sell' : 'd-buy') + '">' +
          (isFlat ? '' : MB.icon(isSell ? 'down' : 'up', 14)) + MB.esc(label) + '</span>' +
        '<span style="min-width:0">' +
          '<span class="sig-market truncate" style="display:block">' + MB.esc(m.short_name) + '</span>' +
          '<span class="sig-cat">' + MB.esc(MB.catLabel(m.category)) + '</span>' +
        '</span>' +
        '<svg class="sig-spark" data-spark="' + (isSell ? 'down' : 'up') +
          '" data-seed="' + s.id + '" data-h="26" data-fill="false"></svg>' +
      '</div>' +

      detail +

      '<div class="sig-foot">' +
        '<span class="sig-stat">' + MB.icon('heart', 13) + (s.engagement.likes || 0) + '</span>' +
        '<span class="sig-stat">' + MB.icon('comment', 13) + (s.engagement.comments || 0) + '</span>' +
        result +
        (exec
          ? '<a class="btn btn-primary btn-xs" href="' + R() + 'users/' +
            ((s.execution && s.execution.trade_route) || 'trade/index.html') + '">Trade</a>'
          : '<a class="btn btn-analysis btn-xs" href="' + R() + 'users/markets/detail.html?symbol=' +
            m.symbol + '">View Market</a>') +
      '</div>' +

      '<a href="' + href + '" class="sr">Open signal</a>' +
    '</article>';
  };

  /* ======================================================================
     ROOMS
     ====================================================================== */
  C.room = function (r) {
    var isTrader = r.kind === 'trader';
    var href = R() + 'users/community/room.html?room=' + r.id;
    return '<a class="room-card" href="' + href + '">' +
      (isTrader
        ? MB.avatar(r.owner, 'avatar-sm')
        : '<span class="rc-ic">' + MB.esc((r.market && r.market.short_name || r.name).slice(0, 4)) + '</span>') +
      '<span class="grow" style="min-width:0">' +
        '<span class="rc-n truncate" style="display:block">' + MB.esc(r.name) + '</span>' +
        '<span class="rc-m">' + MB.fmt.compact(r.member_count) + ' members' +
          (r.market ? ' · ' + MB.esc(MB.catLabel(r.market.category)) : ' · Trader room') +
        '</span>' +
      '</span>' +
      '<span class="none" style="text-align:right">' +
        '<span class="rc-live"><i></i>' + r.online_count + '</span>' +
        (r.is_owner ? '<span class="badge badge-owner" style="margin-top:4px;display:inline-block">Owner</span>'
                    : r.is_member ? '<span class="badge badge-active" style="margin-top:4px;display:inline-block">Joined</span>' : '') +
      '</span>' +
    '</a>';
  };

  /* ======================================================================
     CHAT
     ====================================================================== */
  C.message = function (msg) {
    var att = (msg.attachments || []).map(function (a) {
      if (a.type === 'image') {
        return '<img class="attach-img" src="' + a.url +
               '" alt="' + MB.esc(a.name || 'Attached image') + '" loading="lazy">';
      }
      return '<div class="attach"><div class="attach-file">' +
        '<span class="af-ic">' + MB.icon('file', 17) + '</span>' +
        '<span class="grow" style="min-width:0">' +
          '<span class="af-n truncate" style="display:block">' + MB.esc(a.name) + '</span>' +
          '<span class="af-s">' + MB.esc(a.size) + '</span></span>' +
        '<span class="none c-3">' + MB.icon('download', 16) + '</span>' +
      '</div></div>';
    }).join('');

    var flag = msg.is_own ? '' :
      '<button class="msg-flag" data-can="message.flag" data-flag-msg="' +
        MB.esc(msg.id || '') + '" aria-label="Flag this message for review">' +
        MB.icon('flag', 13) + '</button>';

    var replyBtn = '<button class="msg-reply-btn" data-reply-msg="' +
      MB.esc(msg.id || '') + '" aria-label="Reply">' + MB.icon('reply', 13) + '</button>';

    var replyQuote = '';
    if (msg.reply_to) {
      replyQuote = '<div class="msg-reply-quote" data-scroll-to="' + MB.esc(msg.reply_to.id || '') + '">' +
        '<div class="msg-reply-author">' + MB.esc(msg.reply_to.author) + '</div>' +
        '<div class="msg-reply-text">' + MB.esc(msg.reply_to.body) + '</div>' +
      '</div>';
    }

    var signalCard = '';
    if (msg.signal) {
      var s = msg.signal;
      var buy = s.direction === 'BUY';
      var st = s.status || s.result || 'active';
      var px = function (v) { return isFinite(Number(v)) ? MB.fmt.price(Number(v), s.dp) : MB.esc(String(v)); };
      var STATUS = {
        pending: '<span class="badge">Waiting for entry</span>',
        active:  '<span class="badge badge-active">Running</span>',
        won:     '<span class="badge badge-won">Won' + (s.points ? ' · +' + s.points + ' pts' : '') + '</span>',
        lost:    '<span class="badge badge-lost">Lost</span>',
        expired: '<span class="badge">Expired</span>'
      };

      signalCard = '<div class="signal-form-card sig-' + st + ' mt2" data-signal-id="' + MB.esc(s.id || '') + '">' +
        '<div class="between">' +
          '<div class="row g2">' +
            '<span style="color:var(--mb-' + (buy ? 'green' : 'sell') + ')">' + MB.icon(buy ? 'up' : 'down', 16) + '</span>' +
            '<span class="w-bold t-sm">' + MB.esc(s.pair) + ' ' + (buy ? 'BUY' : 'SELL') + '</span>' +
          '</div>' +
          (STATUS[st] || STATUS.active) +
        '</div>' +
        '<div class="signal-form-row mt2">' +
          '<div><div class="t-xs c-3">Entry</div><div class="t-sm w-semi num">' + px(s.entry) + '</div></div>' +
          '<div><div class="t-xs c-3">Take profit</div><div class="t-sm w-semi num c-up">' + px(s.tp) + '</div></div>' +
        '</div>' +
        '<div class="signal-form-row mt1">' +
          '<div><div class="t-xs c-3">Stop loss</div><div class="t-sm w-semi num c-down">' + px(s.sl) + '</div></div>' +
          '<div><div class="t-xs c-3">Posted</div><div class="t-sm">' + MB.fmt.ago(msg.created_at) + '</div></div>' +
        '</div>' +
        (st === 'won' || st === 'lost'
          ? '<div class="t-xs c-3 mt2">Closed at ' + px(s.exit) + ' · resolved from the live price</div>'
          : '') +
      '</div>';
    }

    return '<div class="msg' + (msg.is_own ? ' msg-own' : '') +
        (msg.is_flagged ? ' is-flagged' : '') + '" data-msg-id="' + MB.esc(msg.id || '') + '">' +
      MB.avatar(msg.author, 'avatar-sm') +
      '<div class="msg-body">' +
        '<div class="msg-head">' +
          '<span class="msg-name">' + MB.esc(msg.author.username) + '</span>' +
          (msg.author.is_pro ? '<span class="badge badge-pro">Pro</span>' : '') +
          (msg.author.role === 'moderator'
            ? '<span class="badge badge-mod">Mod</span>' : '') +
          '<span class="msg-time">' + MB.fmt.ago(msg.created_at) + '</span>' +
          replyBtn +
          flag +
        '</div>' +
        '<div class="msg-bubble">' +
          replyQuote +
          (msg.body ? '<div class="msg-text">' + MB.esc(msg.body) + '</div>' : '') +
          att +
          signalCard +
        '</div>' +
        (msg.is_flagged
          ? '<div class="msg-flagged">' + MB.icon('flag', 11) +
            ' Flagged for review</div>' : '') +
      '</div>' +
    '</div>';
  };

  /* ======================================================================
     ROOM MEMBERS — remove is shown only where the viewer may act
     ====================================================================== */
  C.member = function (m, canManage) {
    var role = m.role;
    var badge = role === 'owner' ? '<span class="badge badge-owner">Owner</span>'
              : role === 'moderator' ? '<span class="badge badge-mod">Moderator</span>' : '';
    return '<div class="member-row" data-member="' + MB.esc(m.user.username) + '">' +
      MB.avatar(m.user, 'avatar-sm') +
      '<span class="grow" style="min-width:0">' +
        '<span class="row g2"><span class="mr-n truncate">' + MB.esc(m.user.username) + '</span>' + badge + '</span>' +
        '<span class="mr-r">Joined ' + MB.fmt.date(m.joined_at) + '</span>' +
      '</span>' +
      (canManage && m.can_remove
        ? '<button class="btn-remove none" data-remove="' + MB.esc(m.user.username) + '">Remove</button>'
        : '') +
    '</div>';
  };
})(window);

/* ==========================================================================
   MARKET ROW — the Markets screen and the dashboard's Trade Now list.
   Carries the coloured market chip and the capability tags from the designs.
   ========================================================================== */
(function (global) {
  'use strict';
  var MB = global.MB;
  var C = MB.card;

  /* Which coloured chip a market wears. Derived from the catalogue rather
     than hard-coded per symbol, so a new market inherits the right hue. */
  var CHIP = [
    [/^BOOM/,     'mk-boom'],
    [/^CRASH/,    'mk-crash'],
    [/^JD/,       'mk-jump'],
    [/^stpRNG/i,  'mk-step'],
    [/^RB/,       'mk-range'],
    [/^cry/,      'mk-crypto'],
    [/^frxXA|^WTI/, 'mk-metal'],
    [/^frx/,      'mk-forex'],
    [/^OTC_/,     'mk-index'],
    [/^R_|^1HZ/,  'mk-vol']
  ];
  MB.mktChipClass = function (symbol) {
    for (var i = 0; i < CHIP.length; i++) {
      if (CHIP[i][0].test(symbol)) { return CHIP[i][1]; }
    }
    return 'mk-step';
  };
  /* Short label for the chip — "V75", "BOOM1000", "XAUUSD". */
  MB.mktChipText = function (m) {
    return (m.icon_key || m.short_name || m.symbol).toUpperCase().slice(0, 8);
  };

  var KIND_LABEL = { binary: 'Binary', multiplier: 'Multipliers', cfd_mt5: 'CFD' };

  C.mktRow = function (m) {
    var up = m.stats.change_pct_24h >= 0;
    var tags = (m.contract_kinds || []).map(function (k) {
      return '<span class="kind-tag">' + (KIND_LABEL[k] || k) + '</span>';
    }).join('');

    return '<a class="mkt-row" href="' + MB.root() + 'users/markets/detail.html?symbol=' +
      m.symbol + '">' +
      '<span class="mk-chip ' + MB.mktChipClass(m.symbol) + '">' + MB.esc(MB.mktChipText(m)) + '</span>' +
      '<span class="grow" style="min-width:0">' +
        '<span class="mr-name truncate" style="display:block">' + MB.esc(m.short_name) + '</span>' +
        '<span class="mr-sym">' + MB.esc(m.symbol.toUpperCase()) + '</span>' +
        '<span class="mr-tags">' + tags + '</span>' +
      '</span>' +
      '<span class="mr-spark"><span data-spark="' + (up ? 'up' : 'down') +
        '" data-seed="mr' + m.symbol + '" data-h="30" data-sw="2" data-fill="false"></span></span>' +
      '<span class="none" style="min-width:88px">' +
        '<span class="mr-price" style="display:block" data-tick="' + m.symbol +
          '" data-tick-dp="' + m.decimal_places + '">' +
          MB.fmt.price(m.stats.last_price, m.decimal_places) + '</span>' +
        '<span class="mr-chg ' + (up ? 'c-up' : 'c-down') + '" style="display:block">' +
          MB.fmt.pct(m.stats.change_pct_24h) + '</span>' +
      '</span>' +
      '<span class="mr-star' + (m.is_favorite ? ' is-on' : '') + '">' +
        MB.icon(m.is_favorite ? 'starfill' : 'star', 18) + '</span>' +
    '</a>';
  };

  /* Room row with the LIVE indicator from the designs. */
  C.roomRow = function (r) {
    var live = r.online_count > 30;
    return '<a class="room-row" href="' + MB.root() + 'users/community/room.html?room=' + r.id + '">' +
      (r.kind === 'trader'
        ? MB.avatar(r.owner, 'avatar-sm')
        : '<span class="mk-chip ' + MB.mktChipClass(r.market ? r.market.symbol : '') + '">' +
          MB.esc((r.market ? (r.market.short_name || r.market.symbol) : r.name).toUpperCase().slice(0, 6)) +
          '</span>') +
      '<span class="grow" style="min-width:0">' +
        '<span class="row g2"><span class="rr-n truncate">' + MB.esc(r.name) + '</span>' +
          (live ? '<span class="live-badge"><i></i>LIVE</span>' : '') + '</span>' +
        '<span class="rr-m">' + MB.fmt.compact(r.member_count) + ' members' +
          (r.market ? ' · ' + MB.catLabel(r.market.category) : ' · Trader room') +
          /* A market room shows where its pair is going right now. */
          (r.market && r.market.change_pct_24h !== undefined
            ? ' · <span class="' + (r.market.change_pct_24h >= 0 ? 'c-up' : 'c-down') +
              '">' + MB.fmt.pct(r.market.change_pct_24h) + '</span>'
            : '') + '</span>' +
        '<span class="rr-stats">' +
          '<span class="online-dot"><i></i>Active now</span>' +
          '<span>' + MB.icon('comment', 12) + (r.online_count || 0) + '</span>' +
          '<span>' + MB.icon('community', 12) + MB.fmt.compact(r.post_count || 0) + '</span>' +
        '</span>' +
      '</span>' +
      '<span class="none">' +
        (r.is_member
          ? '<span class="btn btn-ghost btn-xs">Joined</span>'
          : '<span class="btn btn-primary btn-xs">Join</span>') +
      '</span>' +
    '</a>';
  };
})(window);
