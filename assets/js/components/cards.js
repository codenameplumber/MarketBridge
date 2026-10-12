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
     MB.card.chatSignal(s)    -> room chat signal (MB.signalTracker.toMessageSignal)
     MB.card.signalDetail(s)  -> lifecycle, TP ladder, matching, Agree/Dispute, history
     MB.card.sx.view(s)       -> shared signal view model (feed or tracker shape)
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

  /* Entry / SL / TP1…TP5 with hit ticks — every signal carries price levels. */
  function levelGrid(s) {
    if (!C.sx) { return ''; }
    var v = C.sx.view(s);
    if (!isFinite(v.entry)) { return ''; }
    var dp = C.sx.shortDp(v.entry, v.dp);
    var cell = function (k, val, cls) {
      return '<div class="level-cell ' + (cls || '') + '"><div class="lk">' + k + '</div><div class="lv">' +
        MB.fmt.price(val, dp) + '</div></div>';
    };
    var out = cell('Entry', v.entry) + cell('Stop Loss', v.sl, 'is-sl');
    v.tps.forEach(function (tp, i) {
      var hit = v.hits.indexOf(i + 1) > -1;
      out += cell('TP' + (i + 1) + (hit ? ' ' + MB.icon('check', 10) : ''), tp, 'is-tp' + (hit ? ' is-hit' : ''));
    });
    return '<div class="signal-levels' + (v.tps.length === 1 ? ' cols-3' : '') + '">' + out + '</div>' +
      '<div class="t-xs c-3 mt2">TP1 is the official win target' + (v.timeframe ? ' &middot; ' + MB.esc(v.timeframe) : '') +
      ' &middot; ' + MB.icon('lock', 11) + ' locked' + (v.version > 1 ? ' (v' + v.version + ')' : '') + '</div>';
  }

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

  /* Full-card status: the lifecycle chip and the matching badge when the
     signal model carries them (C.sx, defined further down); otherwise the
     legacy result badge. */
  function resultBadge(s) {
    if (C.sx && (s.lifecycle || s.levels)) {
      var v = C.sx.view(s);
      return C.sx.chip(v, true) + C.sx.matchChip(v);
    }
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
        levelGrid(s) +
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
        (C.sx && s.levels ? levelGrid(s)
          : '<div class="signal-levels' + (tps.length < 2 ? ' cols-3' : '') + '">' + levels + '</div>') +
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
    var sx = C.sx;
    if (sx) { sx.ensureCss(); }
    var v = sx ? sx.view(s) : null;
    var xp = (s.execution && s.execution.params) || {};
    var dir = (v && v.dir) || xp.direction || s.direction || 'neutral';
    var isSell = /sell|fall|down|put/i.test(dir);
    var isFlat = String(dir).toLowerCase() === 'neutral';
    var m = s.market;
    var label = String(dir).toUpperCase();

    function cell(k, val, cls) {
      return '<div class="' + (cls || '') + '"><div class="k">' + k +
             '</div><div class="v">' + MB.esc(val) + '</div></div>';
    }

    /* Price levels are required on every signal — executable ones too. TP1 is
       the official win target; a hit level carries a tick. Extra targets
       collapse into "+n" so the card stays one row tall. */
    var detail = '';
    if (v && isFinite(v.entry)) {
      var dp = Math.abs(v.entry || 0) >= 10000 ? 0 : v.dp;
      var tick = function (i) { return v.hits.indexOf(i) > -1 ? MB.icon('check', 9) : ''; };
      var extra = v.tps.length > 2 ? '<span class="sig-more">+' + (v.tps.length - 2) + '</span>' : '';
      detail =
        '<div class="sig-levels' + (v.tps.length < 2 ? ' cols-3' : '') + '">' +
          cell('Entry', MB.fmt.price(v.entry, dp)) +
          cell('SL', MB.fmt.price(v.sl, dp), 'is-sl') +
          (v.tps[0] !== undefined ? cell('TP1' + tick(1), MB.fmt.price(v.tps[0], dp), 'is-tp' + (v.hits.indexOf(1) > -1 ? ' is-hit' : '')) : '') +
          (v.tps[1] !== undefined ? cell('TP2' + tick(2) + extra, MB.fmt.price(v.tps[1], dp), 'is-tp' + (v.hits.indexOf(2) > -1 ? ' is-hit' : '')) : '') +
        '</div>';
    }

    var sub = [MB.esc(MB.catLabel(m.category))];
    if (v && v.timeframe) { sub.push(MB.esc(v.timeframe)); }
    if (exec && s.execution && s.execution.contract_label) { sub.push(MB.esc(s.execution.contract_label)); }

    var href = R() + 'users/signals/detail-' + (exec ? 'executable' : 'analysis') + '.html?id=' + s.id;
    var e = s.engagement || {};
    var inst = s.author.profile_type === 'institution';

    return '<article class="sig ' + (exec ? 'is-exec' : 'is-anal') + '">' +
      '<div class="sig-top">' +
        MB.avatar(s.author, 'avatar-xs') +
        '<span class="sig-who truncate">' + MB.esc(s.author.display_name || s.author.username) + '</span>' +
        (inst ? '<span class="badge badge-info">Institution</span>'
              : s.author.is_pro ? '<span class="badge badge-pro">Pro</span>' : '') +
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
          '<span class="sig-cat truncate" style="display:block">' + sub.join(' · ') + '</span>' +
        '</span>' +
        (v ? sx.chip(v) : '') +
      '</div>' +

      detail +

      '<div class="sig-foot">' +
        '<span class="sig-stat">' + MB.icon('heart', 13) + (e.likes || 0) + '</span>' +
        '<span class="sig-stat">' + MB.icon('comment', 13) + (e.comments || 0) + '</span>' +
        (v ? sx.matchChip(v) : '') +
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

    /* Room signals render through C.chatSignal (signal lifecycle section) —
       it accepts MB.signalTracker.toMessageSignal(sig) and the legacy
       {pair, direction, dp, entry, tp, sl, status, points, exit} shape. */
    var signalCard = msg.signal ? C.chatSignal(msg.signal) : '';

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

/* ==========================================================================
   SIGNAL LIFECYCLE — shared view model and templates (directive §5–§9)

   Every signal card reads a signal through C.sx.view(), which accepts either
   a feed signal from mock/signals.json (levels + lifecycle + performance) or
   a record from MB.signalTracker. Cards never compute results themselves —
   the engine in signal-tracker.js decides, these only display.

     C.sigLifecycle(s)  Published → Waiting → Entry Hit → Monitoring → Result
     C.sigLadder(s)     Entry / SL / TP1…TP5 with hit ticks + Performance Points
     C.sigMatching(s)   "✓ Matching Trade Found" / "No Matching Trade Verified"
     C.sigFeedback(s)   Agree · Dispute under a result
     C.sigVersions(s)   locked versions and correction reasons (audit history)
     C.sigPriceChart(o) price history with entry / SL / TP lines (staff review)
   ========================================================================== */
(function (global) {
  'use strict';
  var MB = global.MB;
  var C = MB.card;

  /* Cards render on pages that do not link signals.css — load it once. */
  var cssDone = false;
  function ensureCss() {
    if (cssDone || typeof document === 'undefined') { return; }
    cssDone = true;
    if (document.querySelector('link[href$="signals.css"]')) { return; }
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = MB.root() + 'assets/css/signals.css';
    document.head.appendChild(l);
  }

  /* +42.5 pips · −16 pts · 0 pts */
  function fmtPts(p, unit) {
    var n = Number(p || 0);
    var abs = Math.abs(n);
    var txt = MB.fmt.price(abs, abs % 1 ? 1 : 0);
    return (n > 0 ? '+' : n < 0 ? '−' : '') + txt + ' ' + (unit || 'pts');
  }
  function shortDp(price, dp) { return Math.abs(Number(price) || 0) >= 10000 ? 0 : dp; }
  function timeOf(iso) {
    if (!iso) { return ''; }
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return ''; }
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /* ---- view model -------------------------------------------------------- */
  function view(s) {
    var lc = s.lifecycle || {};
    var a = s.analysis || {};
    var lv = s.levels ||
      (s.entry !== undefined ? { entry: s.entry, sl: s.sl, tps: s.tps || (s.tp !== undefined ? [s.tp] : []) }
                             : { entry: a.entry_price, sl: a.stop_loss, tps: a.take_profits || [] });
    var status = lc.stage || s.status || (s.result && s.result.outcome) || 'active';
    if (status === 'pending') { status = 'waiting'; }
    var hitsRaw = lc.tp_hits || s.tp_hits || [];
    var hits = hitsRaw.map(function (h) { return typeof h === 'number' ? h : h.level; });
    var hitAt = {};
    hitsRaw.forEach(function (h) { if (h && typeof h === 'object') { hitAt[h.level] = h.at; } });
    if (status === 'won' && !hits.length) { hits = [1]; }
    var m = s.market && typeof s.market === 'object' ? s.market : {};
    var perf = s.performance || {};
    var T = MB.signalTracker;
    var unit = perf.unit || s.unit ||
      (T ? T.unit({ symbol: s.symbol || m.symbol, category: s.category || m.category, pair: s.pair }).unit : 'pts');
    var points = perf.points !== undefined ? perf.points
      : s.points !== undefined && s.unit ? s.points
      : (T ? T.points(s) : (s.points || 0));

    /* a dispute raised in this browser shows at once; Stage 2 reads it from the API */
    var fb = T && s.id ? T.feedback(s.id) : null;
    var dispute = fb && fb.kind === 'dispute' ? { status: fb.status, reason: fb.reason, at: fb.at, local: true }
                : (s.dispute || null);

    return {
      id: s.id,
      dir: String(s.direction || 'buy').toUpperCase(),
      pair: s.pair || m.short_name || s.symbol,
      symbol: s.symbol || m.symbol,
      category: s.category || m.category,
      dp: s.dp !== undefined ? s.dp : (m.decimal_places !== undefined ? m.decimal_places : 2),
      entry: Number(lv.entry), sl: Number(lv.sl), tps: (lv.tps || []).map(Number),
      status: status, hits: hits, hitAt: hitAt,
      monitoring: !!(lc.monitoring || s.monitoring), monitorEnd: lc.monitor_end || s.monitor_end || null,
      points: points, unit: unit, basis: perf.basis || null,
      posted: s.published_at || s.posted_at, entryAt: lc.entry_hit_at || s.activated_at || null,
      resolvedAt: lc.resolved_at || s.resolved_at || null,
      slAt: lc.sl_hit_at || (s.status === 'lost' ? s.resolved_at : null) || null,
      ambiguous: !!(lc.ambiguous || s.ambiguous),
      timeframe: s.timeframe || a.timeframe || null,
      matching: s.matching || null, dispute: dispute,
      corrected: s.result && s.result.corrected ? s.result.corrected : null,
      versions: s.versions || null, version: s.version || 1,
      room: s.room || (s.room_name ? { name: s.room_name, tier: s.room_tier } : null),
      author: s.author || null
    };
  }

  /* ---- status chip --------------------------------------------------------- */
  function chip(v, full) {
    if (v.dispute && v.dispute.status === 'open') {
      return '<span class="sx-chip sx-disp">' + MB.icon('gavel', 11) +
        (full ? 'Disputed — Moderator Review' : 'Disputed') + '</span>';
    }
    var corr = v.corrected && full ? ' · corrected' : '';
    switch (v.status) {
      case 'waiting': return '<span class="sx-chip sx-wait">' + MB.icon('hourglass', 11) + (full ? 'Waiting for entry' : 'Waiting') + '</span>';
      case 'active':  return '<span class="sx-chip sx-active">' + MB.icon('activity', 11) + (full ? 'Entry hit · monitoring TP/SL' : 'Active') + '</span>';
      case 'won':
        return '<span class="sx-chip sx-won">' + MB.icon('check', 11) + 'WIN' +
          (full ? ' · TP' + Math.max.apply(null, v.hits.concat([1])) + ' hit' : '') +
          ' ' + fmtPts(v.points, v.unit) + corr + '</span>';
      case 'lost':
        return '<span class="sx-chip sx-lost">LOSS ' + fmtPts(v.points, v.unit) + corr + '</span>';
      case 'expired': return '<span class="sx-chip sx-exp">Expired</span>';
      default: return '';
    }
  }

  function matchChip(v) {
    var mt = v.matching;
    if (!mt || !mt.eligible || mt.status === 'pending') { return ''; }
    return mt.status === 'found'
      ? '<span class="sx-chip sx-match" title="Matching trade found on the provider\'s connected Deriv account">' +
          MB.icon('verified', 11) + 'Matched</span>'
      : '<span class="sx-chip sx-nomatch" title="No matching trade verified — this does not mean the signal lost">No match</span>';
  }

  C.sx = { view: view, chip: chip, matchChip: matchChip, fmtPts: fmtPts, ensureCss: ensureCss, timeOf: timeOf, shortDp: shortDp };

  /* ======================================================================
     LIFECYCLE STRIP
     ====================================================================== */
  C.sigLifecycle = function (s) {
    ensureCss();
    var v = view(s);
    var at = { waiting: 1, active: 3, won: 4, lost: 4, expired: 4 }[v.status];
    if (at === undefined) { at = 1; }
    var expired = v.status === 'expired';
    var steps = [
      { l: 'Published', t: v.posted, icon: 'lock' },
      { l: 'Waiting for entry', t: null, icon: 'hourglass' },
      { l: expired ? 'Entry not reached' : 'Entry hit', t: v.entryAt, icon: 'target' },
      { l: 'TP/SL monitoring', t: null, icon: 'activity' },
      { l: v.status === 'won' ? 'WIN' : v.status === 'lost' ? 'LOSS' : expired ? 'Expired' : 'Result',
        t: v.resolvedAt, icon: v.status === 'lost' ? 'close' : v.status === 'won' ? 'check' : 'results' }
    ];
    return '<div class="sx-life" role="list" aria-label="Signal lifecycle">' + steps.map(function (st, i) {
      var cls = 'sx-step';
      var done = false;
      if (i === 4 && at === 4) {
        cls += v.status === 'won' ? ' is-won' : v.status === 'lost' ? ' is-lost' : ' is-exp';
        done = true;
      } else if (expired && (i === 2 || i === 3)) {
        /* never reached */
      } else if (i < at) { cls += ' is-done'; done = true; }
      else if (i === at) { cls += ' is-now'; }
      return '<div class="' + cls + '" role="listitem"' + (i === at && at < 4 ? ' aria-current="step"' : '') + '>' +
        '<span class="sx-dot">' + MB.icon(done && i < 4 ? 'check' : st.icon, 12) + '</span>' +
        '<span class="sx-l">' + MB.esc(st.l) + '</span>' +
        (st.t && (done || i === 0) ? '<span class="sx-t">' + MB.esc(timeOf(st.t)) + '</span>' : '') +
      '</div>';
    }).join('') + '</div>';
  };

  /* ======================================================================
     TP LADDER + PERFORMANCE POINTS
     ====================================================================== */
  C.sigLadder = function (s) {
    ensureCss();
    var v = view(s);
    var T = MB.signalTracker;
    var mk = { symbol: v.symbol, category: v.category, pair: s.pair };
    function pts(to) { return T ? fmtPts(T.move(mk, v.dir, v.entry, to), v.unit) : ''; }
    var rows = '';
    rows += '<div class="sx-rung"><span class="k">Entry<small>' +
      (v.entryAt ? 'hit ' + MB.esc(timeOf(v.entryAt)) : v.status === 'expired' ? 'never reached' : 'not reached yet') +
      '</small></span><span class="v">' + MB.fmt.price(v.entry, v.dp) + '</span><span class="s">' +
      (v.entryAt ? 'HIT ' + MB.icon('check', 12) : '—') + '</span></div>';
    v.tps.forEach(function (tp, i) {
      var hit = v.hits.indexOf(i + 1) > -1;
      rows += '<div class="sx-rung is-tp' + (hit ? ' is-hit' : '') + '"><span class="k">TP' + (i + 1) +
        '<small>' + (i === 0 ? 'official win target' : pts(tp)) + '</small></span>' +
        '<span class="v">' + MB.fmt.price(tp, v.dp) + '</span>' +
        '<span class="s">' + (hit ? 'TP' + (i + 1) + ' HIT ' + MB.icon('check', 12) +
          (v.hitAt[i + 1] ? '<small>' + MB.esc(timeOf(v.hitAt[i + 1])) + '</small>' : '') : (i === 0 ? pts(tp) : '—')) +
        '</span></div>';
    });
    var slHit = v.status === 'lost';
    rows += '<div class="sx-rung is-sl' + (slHit ? ' is-slhit' : '') + '"><span class="k">Stop loss<small>' + pts(v.sl) +
      '</small></span><span class="v">' + MB.fmt.price(v.sl, v.dp) + '</span><span class="s">' +
      (slHit ? 'SL HIT' + (v.slAt ? '<small>' + MB.esc(timeOf(v.slAt)) + '</small>' : '')
             : v.monitorEnd === 'sl_return' ? 'Reached after win<small>result unchanged</small>' : '—') + '</span></div>';

    var resolved = v.status === 'won' || v.status === 'lost';
    var tone = v.points > 0 ? 'c-up' : v.points < 0 ? 'c-down' : '';
    var note = v.status === 'won'
      ? (v.monitoring ? 'WIN is final. Still monitoring TP' + (v.hits.length + 1) + ' — each further target adds points.'
                      : v.monitorEnd === 'all_targets' ? 'WIN is final. All targets reached.' : 'WIN is final. Monitoring has ended.')
      : v.status === 'lost' ? (v.ambiguous ? 'Stop and target were both inside one tick — resolved against the author.' : 'Stop loss reached before TP1.')
      : v.status === 'expired' ? 'Entry not reached within 24 hours — not counted either way.'
      : 'Points are awarded once TP1 or the stop loss is reached.';

    return '<div class="sx-points"><span class="n ' + tone + '">' + (resolved ? fmtPts(v.points, v.unit) : '0 ' + MB.esc(v.unit)) +
        '</span><span class="u">Performance Points</span></div>' +
      '<div class="t-xs c-3 mt2">' + MB.esc(note) + ' ' +
        MB.esc(v.basis || (v.unit === 'pips' ? '1 point = 1 pip.' : '1 point = a 0.01% move from entry.')) +
        '. Not KX Points.</div>' +
      '<div class="sx-ladder mt3">' + rows + '</div>';
  };

  /* ======================================================================
     MATCHING TRADE (§9)
     ====================================================================== */
  C.sigMatching = function (s) {
    ensureCss();
    var v = view(s);
    var mt = v.matching;
    if (!mt) { return ''; }
    if (!mt.eligible) {
      return '<div class="sx-matchbox is-none">' + MB.icon('info', 20) + '<div class="grow">' +
        '<div class="t c-2">Trade matching not applicable</div>' +
        '<div class="t-xs c-3 mt2">' + MB.esc(mt.reason || 'Matching is checked for Premium and Pro rooms and institutions with a connected Deriv account.') + '</div></div></div>';
    }
    if (mt.status === 'pending') {
      return '<div class="sx-matchbox is-none">' + MB.icon('hourglass', 20) + '<div class="grow">' +
        '<div class="t c-2">Matching trade check pending</div>' +
        '<div class="t-xs c-3 mt2">' + MB.esc(mt.note || 'Checked once the entry is hit.') + '</div></div></div>';
    }
    if (mt.status === 'found') {
      var inst = v.author && v.author.profile_type === 'institution';
      return '<div class="sx-matchbox is-found">' + MB.icon('verified', 20) + '<div class="grow">' +
        '<div class="t">✓ Matching Trade Found</div>' +
        '<div class="t-xs c-3 mt2">This signal matches the provider\'s trading activity on a connected Deriv account.</div>' +
        '<dl class="sx-kv">' +
          '<dt>Instrument</dt><dd>' + MB.esc(mt.instrument_name || mt.instrument) + '</dd>' +
          '<dt>Direction / contract</dt><dd>' + MB.esc(mt.contract || mt.direction) + '</dd>' +
          '<dt>Timing</dt><dd>' + (mt.delta_sec !== undefined ? 'opened ' + mt.delta_sec + 's after entry' : MB.esc(timeOf(mt.opened_at))) + '</dd>' +
          (mt.account ? '<dt>' + (inst ? 'Connected account' : 'Account') + '</dt><dd>' +
            MB.esc(mt.account.label) + ' · ' + MB.esc(mt.account.login) + '</dd>' : '') +
        '</dl></div></div>';
    }
    return '<div class="sx-matchbox is-none">' + MB.icon('info', 20) + '<div class="grow">' +
      '<div class="t">No Matching Trade Verified</div>' +
      '<div class="t-xs c-3 mt2">' + MB.esc(mt.note || 'No trade on the connected account matched this signal.') +
      ' <strong class="c-2">This does not mean the signal lost</strong> — the result is decided by price alone; the provider may simply not have taken the trade.</div>' +
      '</div></div>';
  };

  /* ======================================================================
     RESULT FEEDBACK — Agree · Dispute (no voting, no tallies)
     ====================================================================== */
  C.sigFeedback = function (s) {
    ensureCss();
    var v = view(s);
    if (v.status !== 'won' && v.status !== 'lost' && v.status !== 'expired') {
      return '<div class="t-xs c-3">Agree or Dispute opens once the system records a result.</div>';
    }
    var d = v.dispute;
    if (d && d.status === 'open') {
      return '<div class="alert alert-warn">' + MB.icon('gavel', 18) + '<div class="t-sm">' +
        '<strong>Disputed — Moderator Review.</strong> The automated result stands while a moderator ' +
        'checks the price history.' + (d.reason ? '<div class="t-xs c-2 mt2">Reason: “' + MB.esc(d.reason) + '”</div>' : '') +
        '</div></div>';
    }
    if (d && (d.status === 'upheld' || d.status === 'corrected')) {
      return '<div class="alert ' + (d.status === 'upheld' ? 'alert-info' : 'alert-green') + '">' + MB.icon('gavel', 18) +
        '<div class="t-sm"><strong>' + (d.status === 'upheld' ? 'Dispute reviewed — result upheld.' : 'Dispute reviewed — result corrected.') +
        '</strong>' + (v.corrected ? '<div class="t-xs c-2 mt2">' + MB.esc(v.corrected.reason || '') + '</div>' : '') + '</div></div>';
    }
    var fb = MB.signalTracker && v.id ? MB.signalTracker.feedback(v.id) : null;
    var agreed = fb && fb.kind === 'agree';
    return '<div class="t-sm w-semi">Is this result correct?</div>' +
      '<div class="sx-verdict">' +
        '<button class="btn btn-ghost btn-sm' + (agreed ? ' is-on' : '') + '" data-sig-agree="' + MB.esc(v.id) + '"' +
          ' aria-pressed="' + (agreed ? 'true' : 'false') + '">' + MB.icon(agreed ? 'check' : 'thumbsup', 16) + (agreed ? ' Agreed' : ' Agree') + '</button>' +
        '<button class="btn btn-ghost btn-sm" data-sig-dispute="' + MB.esc(v.id) + '">' + MB.icon('gavel', 16) + ' Dispute</button>' +
      '</div>' +
      '<div class="sx-fine">Results come from the price feed, not from votes. A dispute needs a reason and ' +
        'goes to a moderator, who can only uphold or correct the result with a written explanation.</div>';
  };

  /** Wires Agree / Dispute buttons inside `root`. onChange() re-renders. */
  C.bindSigFeedback = function (root, extra, onChange) {
    if (!root || !MB.signalTracker) { return; }
    MB.$$('[data-sig-agree]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var r = MB.signalTracker.agree(b.getAttribute('data-sig-agree'));
        MB.toast(r.ok ? 'Thanks — your feedback was recorded' : r.error, r.ok ? undefined : 'err');
        if (r.ok && onChange) { onChange(); }
      });
    });
    MB.$$('[data-sig-dispute]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-sig-dispute');
        var min = MB.signalTracker.DISPUTE_MIN;
        MB.modal({
          title: 'Dispute this result',
          sub: 'A moderator reviews the price history. The result only changes if the data was wrong.',
          body: '<div class="field"><label for="dspReason">Reason <span class="sc-req">*</span></label>' +
            '<textarea class="textarea" id="dspReason" maxlength="500" placeholder="What does the system have wrong? e.g. a bad tick, a level that was never touched…"></textarea>' +
            '<span class="field-hint"><span id="dspCount">0</span>/500 · at least ' + min + ' characters</span>' +
            '<span class="field-error" id="dspErr"></span></div>',
          actions: [
            { label: 'Cancel', kind: 'ghost', close: true },
            { label: 'Send to moderator', kind: 'trade', disabled: true, onClick: function (m) {
                var r = MB.signalTracker.dispute(id, m.$('#dspReason').value, extra || null);
                if (!r.ok) { m.$('#dspErr').textContent = r.error; return; }
                m.close();
                MB.toast('Disputed — Moderator Review');
                if (onChange) { onChange(); }
              } }
          ],
          onOpen: function (w, m) {
            var ta = m.$('#dspReason');
            ta.addEventListener('input', function () {
              m.$('#dspCount').textContent = ta.value.length;
              m.setAction(1, { disabled: ta.value.trim().length < min });
            });
            setTimeout(function () { ta.focus(); }, 60);
          }
        });
      });
    });
  };

  /* ======================================================================
     VERSION HISTORY — the locked original is always visible
     ====================================================================== */
  C.sigVersions = function (s) {
    ensureCss();
    var v = view(s);
    var list = v.versions || [];
    if (!list.length) { return ''; }
    function fmtL(x, k) {
      return k === 'tps' ? (x.tps || []).map(function (t) { return MB.fmt.price(t, v.dp); }).join(' / ')
                         : MB.fmt.price(x[k], v.dp);
    }
    function lv(x, prev, k, label) {
      var val = fmtL(x, k), pv = prev ? fmtL(prev, k) : null;
      return label + ' ' + (pv !== null && pv !== val ? '<s>' + pv + '</s> → <b>' + val + '</b>' : val);
    }
    return list.slice().reverse().map(function (x) {
      var prev = list.filter(function (p) { return p.v === x.v - 1; })[0];
      var cur = x.v === v.version;
      return '<div class="sx-ver' + (cur ? ' is-current' : '') + '">' +
        '<div class="sx-ver-h"><span class="sx-ver-v">v' + x.v + '</span>' +
          '<span class="grow">' + (x.v === 1 ? 'Original — locked on publish' : 'Correction') + (cur ? ' · current' : '') + '</span>' +
          '<span>' + MB.esc(timeOf(x.at)) + '</span></div>' +
        '<div class="sx-ver-l">' + lv(x, prev, 'entry', 'Entry') + ' · ' + lv(x, prev, 'sl', 'SL') + ' · ' + lv(x, prev, 'tps', 'TP') + '</div>' +
        (x.reason ? '<div class="sx-ver-r">“' + MB.esc(x.reason) + '”</div>' : '') +
      '</div>';
    }).join('');
  };

  /* ======================================================================
     PRICE HISTORY CHART — entry / SL / TP lines and the hit sequence
     o = { prices:[{t,p,glitch?}], entry, sl, tps:[], events:[{type,at,level}], dp, h }
     ====================================================================== */
  C.sigPriceChart = function (o) {
    ensureCss();
    var W = 640, H = o.h || 260, padL = 8, padR = 92, padT = 12, padB = 22;
    var ps = o.prices || [];
    if (!ps.length) { return ''; }
    var t0 = Date.parse(ps[0].t), t1 = Date.parse(ps[ps.length - 1].t);
    var vals = ps.map(function (p) { return p.p; }).concat([o.entry, o.sl]).concat(o.tps || []);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    var x = function (t) { return padL + (W - padL - padR) * ((Date.parse(t) - t0) / ((t1 - t0) || 1)); };
    var y = function (p) { return padT + (H - padT - padB) * (1 - (p - lo) / (hi - lo)); };
    var dp = o.dp === undefined ? 2 : o.dp;
    var line = ps.map(function (p, i) { return (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.p).toFixed(1); }).join(' ');
    function hl(val, cls, label) {
      var yy = y(val).toFixed(1);
      return '<line class="lv lv-' + cls + '" x1="' + padL + '" x2="' + (W - padR + 4) + '" y1="' + yy + '" y2="' + yy + '"/>' +
        '<text class="lv-t ' + cls + '" x="' + (W - padR + 8) + '" y="' + (Number(yy) + 3.5) + '">' +
        MB.esc(label) + ' ' + MB.fmt.price(val, shortDp(val, dp)) + '</text>';
    }
    var lines = hl(o.entry, 'entry', 'Entry') + hl(o.sl, 'sl', 'SL');
    (o.tps || []).forEach(function (tp, i) { lines += hl(tp, 'tp', 'TP' + (i + 1)); });
    var marks = '';
    (o.events || []).forEach(function (e) {
      var price = e.type === 'entry' ? o.entry : e.type === 'tp' ? o.tps[e.level - 1]
        : (e.type === 'sl' || e.type === 'sl_after_win') ? o.sl : null;
      if (price === null || price === undefined) { return; }
      var cls = e.type === 'entry' ? 'ev-entry' : e.type === 'tp' ? 'ev-tp' : 'ev-sl';
      var xx = x(e.at).toFixed(1);
      marks += '<line class="ev-vline" x1="' + xx + '" x2="' + xx + '" y1="' + padT + '" y2="' + (H - padB) + '"/>' +
        '<circle class="ev ' + cls + '" cx="' + xx + '" cy="' + y(price).toFixed(1) + '" r="5"><title>' +
        MB.esc(e.type === 'tp' ? 'TP' + e.level + ' hit' : e.type === 'entry' ? 'Entry hit' : e.type === 'sl' ? 'SL hit' : 'Back at SL after win') +
        ' · ' + MB.esc(timeOf(e.at)) + '</title></circle>';
    });
    ps.forEach(function (p) {
      if (p.glitch) {
        marks += '<circle class="ev ev-glitch" cx="' + x(p.t).toFixed(1) + '" cy="' + y(p.p).toFixed(1) + '" r="5"><title>Invalid print · ' +
          MB.fmt.price(p.p, dp) + '</title></circle>';
      }
    });
    var axis = '<line class="ax" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (H - padB) + '" y2="' + (H - padB) + '"/>' +
      '<text class="ax-t" x="' + padL + '" y="' + (H - 6) + '">' + MB.esc(timeOf(ps[0].t)) + '</text>' +
      '<text class="ax-t" x="' + (W - padR) + '" y="' + (H - 6) + '" text-anchor="end">' + MB.esc(timeOf(ps[ps.length - 1].t)) + '</text>';
    return '<svg class="sx-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Market price history with entry, stop loss and take profit levels">' +
      axis + lines + '<path class="px" d="' + line + '"/>' + marks + '</svg>';
  };
})(window);

/* ==========================================================================
   CHAT SIGNAL CARD — compact, inside a message bubble (image 06, panel 11)
   ========================================================================== */
(function (global) {
  'use strict';
  var MB = global.MB;
  var C = MB.card;

  C.chatSignal = function (s) {
    var sx = C.sx;
    sx.ensureCss();
    var dir = String(s.direction || 'BUY').toUpperCase();
    var buy = dir !== 'SELL';
    var tps = (s.tps || (s.tp !== undefined ? [s.tp] : [])).map(Number);
    var st = s.status || s.result || 'active';
    if (st === 'pending') { st = 'waiting'; }
    var hits = (s.tp_hits || []).map(function (h) { return typeof h === 'number' ? h : h.level; });
    if (st === 'won' && !hits.length) { hits = [1]; }
    var disputed = !!(s.dispute && s.dispute.status === 'open');
    var v = { status: st, hits: hits, points: s.points || 0, unit: s.unit || 'pts',
              dispute: s.dispute || null, corrected: null, matching: s.matching || null };
    var px = function (n) {
      return isFinite(Number(n)) ? MB.fmt.price(Number(n), s.dp) : MB.esc(String(n));
    };
    function cell(k, val, cls) {
      return '<div class="' + (cls || '') + '"><div class="k">' + k + '</div><div class="v">' + val + '</div></div>';
    }
    var cells = cell('Entry', px(s.entry)) + cell('Stop loss', px(s.sl), 'is-sl');
    tps.forEach(function (tp, i) {
      var hit = hits.indexOf(i + 1) > -1;
      cells += cell('TP' + (i + 1) + (hit ? ' ' + MB.icon('check', 9) : ''), px(tp), 'is-tp' + (hit ? ' is-hit' : ''));
    });

    var mt = s.matching;
    var match = !mt || !mt.eligible || mt.status === 'pending' ? ''
      : mt.status === 'found'
        ? '<span class="c-up w-semi">' + MB.icon('verified', 11) + ' Trade Matched</span>'
        : '<span title="This does not mean the signal lost">No matching trade verified</span>';

    var bits = [];
    if (match) { bits.push(match); }
    if (s.timeframe) { bits.push(MB.esc(s.timeframe)); }
    bits.push(MB.icon('lock', 11) + ' Locked' + (s.version > 1 ? ' v' + s.version : ''));
    if (st === 'won' && s.monitoring) { bits.push('watching TP' + (hits.length + 1)); }
    if (st === 'lost' && s.ambiguous) { bits.push('one tick spanned SL and TP — counted as SL'); }

    return '<div class="signal-form-card sxm sig-' + (disputed ? 'disputed' : st === 'waiting' ? 'pending' : st) +
        ' mt2" data-signal-id="' + MB.esc(s.id || '') + '">' +
      '<div class="sxm-h">' +
        '<span style="color:var(--mb-' + (buy ? 'green' : 'sell') + ')">' + MB.icon(buy ? 'up' : 'down', 15) + '</span>' +
        '<span class="p truncate">' + MB.esc(s.pair || '') + ' ' + (buy ? 'BUY' : 'SELL') + '</span>' +
        '<span class="grow"></span>' +
        sx.chip(v, false) +
      '</div>' +
      '<div class="sxm-g">' + cells + '</div>' +
      '<div class="sxm-f">' + bits.join(' <span aria-hidden="true">·</span> ') +
        (s.href ? '<a href="' + MB.esc(s.href) + '">Details</a>' : '') + '</div>' +
    '</div>';
  };
})(window);

/* ==========================================================================
   SIGNAL DETAIL — card + lifecycle + result + matching + audit history.
   Used by users/signals/detail-executable.html and detail-analysis.html.
   ========================================================================== */
(function (global) {
  'use strict';
  var MB = global.MB;
  var C = MB.card;

  C.signalDetail = function (s) {
    var sx = C.sx;
    sx.ensureCss();
    var v = sx.view(s);
    var roomLine = v.room && v.room.name
      ? '<div class="t-xs c-3 mt3">Posted in ' + MB.esc(v.room.name) +
        (v.room.tier && v.room.tier !== 'market' ? ' · ' + MB.esc(v.room.tier.charAt(0).toUpperCase() + v.room.tier.slice(1)) + ' room' : '') + '</div>'
      : '';
    var match = C.sigMatching(s);
    var versions = C.sigVersions(s);
    return C.signal(s) +
      '<section class="page-section">' +
        '<div class="sec-head"><h2>Status</h2>' + sx.chip(v, true) + '</div>' +
        '<div class="card">' + C.sigLifecycle(s) + roomLine + '</div>' +
      '</section>' +
      '<section class="page-section">' +
        '<div class="sec-head"><h2>Result &amp; Performance Points</h2></div>' +
        '<div class="card">' + C.sigLadder(s) + '</div>' +
        '<div class="card" id="sigFeedback">' + C.sigFeedback(s) + '</div>' +
      '</section>' +
      (match ? '<section class="page-section">' +
        '<div class="sec-head"><h2>Matching Trade</h2></div>' +
        '<div class="card">' + match + '</div></section>' : '') +
      (versions ? '<section class="page-section">' +
        '<div class="sec-head"><h2>Locked levels &amp; history</h2>' +
          (v.version > 1 ? '<span class="sx-chip sx-wait">' + v.version + ' versions</span>' : '') + '</div>' +
        '<div class="card">' + versions +
          '<div class="sx-fine">Levels lock when a signal is published. A correction creates a new version with a reason — the original is never overwritten.</div>' +
        '</div></section>' : '');
  };

  /** Wires Agree / Dispute; `repaint` is called after a change. */
  C.bindSignalDetail = function (root, s, repaint) {
    var v = C.sx.view(s);
    C.bindSigFeedback(root, {
      id: v.id, pair: v.pair, symbol: v.symbol, direction: v.dir, status: v.status,
      levels: { entry: v.entry, sl: v.sl, tps: v.tps }, points: v.points, unit: v.unit,
      author: v.author ? v.author.username : null, published_at: v.posted
    }, repaint);
  };
})(window);
