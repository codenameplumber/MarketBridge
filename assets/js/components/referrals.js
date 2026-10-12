/* ==========================================================================
   KonfluenX — REFERRAL & PARTNERSHIPS (staff console)

   The engine behind superadmin/referrals.html, referral-detail.html and the
   Top Referrers card on the dashboard. Three programmes are monitored here,
   and they must never be mixed up:

     Deriv Affiliate   Deriv pays the affiliate. Those commissions are the
                       affiliate's money, not KonfluenX revenue, and nothing
                       in this file estimates or shows them.
     KonfluenX IB      a Deriv account linked to the KonfluenX IB. Verified
                       links earn a Partner Badge and KX Points.
     KonfluenX Referral
                       the referrer earns `referral_pct` (20 %) of the PLATFORM
                       FEE KonfluenX collects from each referred user's
                       payment, for life. Never a share of the whole payment.

   Every total is computed here from the transaction records, in integer
   cents, so no figure on any page can disagree with the ledger. Records are
   never edited or deleted: a refund is a new reversal entry, a correction is
   a new adjustment entry, and every staff action lands in the audit trail.

   STAGE 1: writes go through MB.api.post (simulated) and are mirrored in a
   localStorage overlay so both pages see the same state in this browser.
   STAGE 2: the overlay goes away; the same calls hit Laravel endpoints that
   enforce the role permissions server side and append to the real ledger.
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  var OVERLAY_KEY = 'mb.referrals.overlay.v1';
  var DAY = 86400000;
  var R = {};
  var state = null;

  /* ---------------------------------------------------------------- utils */
  function c(x) { return Math.round(Number(x || 0) * 100); }       /* dollars -> cents */
  function m(cents, dp) { return MB.fmt.money(cents / 100, null, dp); }
  function t(iso) { return iso ? Date.parse(iso) : NaN; }
  function isoNow() { return new Date(R.now()).toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  function sum(list, fn) { return list.reduce(function (a, x) { return a + fn(x); }, 0); }
  function label(s) { return String(s || '').replace(/_/g, ' '); }
  function cap(s) { s = label(s); return s.charAt(0).toUpperCase() + s.slice(1); }

  R.cents = c;
  R.money = m;
  R.label = label;
  R.cap = cap;

  /* ------------------------------------------------------------- overlay */
  function readOverlay() {
    try { return JSON.parse(localStorage.getItem(OVERLAY_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeOverlay(o) {
    try { localStorage.setItem(OVERLAY_KEY, JSON.stringify(o)); } catch (e) { /* private mode */ }
  }
  function overlay() {
    var o = readOverlay();
    o.audit = o.audit || []; o.txns = o.txns || []; o.earnings = o.earnings || {};
    o.ib = o.ib || {}; o.aff = o.aff || {}; o.flags = o.flags || {}; o.program = o.program || null;
    return o;
  }

  function apply(data) {
    var o = overlay();
    data.audit = data.audit.concat(o.audit);
    data.transactions = data.transactions.concat(o.txns);
    if (o.program) { data.program = o.program; }
    data.referrers.forEach(function (r) {
      var e = o.earnings[r.id];
      if (e) {
        r.earnings_status = e.status;
        r.earnings_suspended_at = e.status === 'suspended' ? e.at : null;
        r.earnings_suspended_reason = e.status === 'suspended' ? e.reason : null;
      }
    });
    data.ib_links.forEach(function (l) { if (o.ib[l.id]) { Object.assign(l, o.ib[l.id]); } });
    data.affiliates.forEach(function (a) { if (o.aff[a.id]) { Object.assign(a, o.aff[a.id]); } });
    data.fraud_flags.forEach(function (f) { if (o.flags[f.id]) { Object.assign(f, o.flags[f.id]); } });
    /* Unpaid commissions of a suspended referrer are held, not cancelled. */
    var suspended = {};
    data.referrers.forEach(function (r) { if (r.earnings_status === 'suspended') { suspended[r.id] = 1; } });
    data.transactions.forEach(function (x) {
      x.held = !!suspended[x.referrer_id] && (x.status === 'pending' || x.status === 'available');
    });
    return data;
  }

  /** Loads the fixture once per page, with this browser's staff actions applied. */
  R.load = function () {
    if (state) { return Promise.resolve(state); }
    return MB.api.get('admin/referrals').then(function (r) {
      state = apply(r.data);
      state.byId = {};
      state.referrers.forEach(function (x) { state.byId[x.id] = x; });
      state.users = {};
      state.referred_users.forEach(function (u) { state.users[u.id] = u; });
      return state;
    });
  };
  R.state = function () { return state; };

  /** "Now" is the snapshot time of the data, so the date filters stay meaningful. */
  R.now = function () { return state ? t(state.as_of) : Date.now(); };

  /* ---------------------------------------------------------------- range */
  R.RANGES = [
    { id: 'today', label: 'Today' }, { id: '7d', label: '7D' }, { id: '30d', label: '30D' },
    { id: '90d', label: '90D' }, { id: 'custom', label: 'Custom' }
  ];

  /** Resolves a range id (and optional custom dates) to [start, end] in ms. */
  R.range = function (id, custom) {
    var now = R.now();
    var d0 = new Date(now); d0.setUTCHours(0, 0, 0, 0);
    var start, end = now, text;
    if (id === 'today') { start = d0.getTime(); text = 'Today'; }
    else if (id === '7d') { start = now - 7 * DAY; text = 'Last 7 days'; }
    else if (id === '90d') { start = now - 90 * DAY; text = 'Last 90 days'; }
    else if (id === 'custom' && custom && custom.start && custom.end) {
      start = Date.parse(custom.start + 'T00:00:00Z');
      end = Math.min(now, Date.parse(custom.end + 'T23:59:59Z'));
      text = MB.fmt.date(custom.start + 'T12:00:00Z') + ' – ' + MB.fmt.date(custom.end + 'T12:00:00Z');
    } else { start = now - 30 * DAY; text = 'Last 30 days'; id = id === 'custom' ? 'custom' : '30d'; }
    var span = end - start;
    return { id: id, start: start, end: end, text: text,
             bucket: span <= 1.01 * DAY ? 'hour' : span <= 45 * DAY ? 'day' : 'week' };
  };
  function inR(iso, r) { var x = t(iso); return x >= r.start && x <= r.end; }
  R.inRange = inR;

  /* ------------------------------------------------------------- ledgers */
  function eligible(x) { return x.kind === 'commission' && x.status !== 'reversed'; }
  R.isEligible = eligible;

  /** The figures every card on the page is built from, for one window. */
  R.summary = function (r, referrerId) {
    var s = state;
    var tx = s.transactions.filter(function (x) {
      return (!referrerId || x.referrer_id === referrerId) && inR(x.created_at, r);
    });
    var com = tx.filter(eligible);
    var users = s.referred_users.filter(function (u) {
      return (!referrerId || u.referrer_id === referrerId) && inR(u.registered_at, r);
    });
    var payers = payingSet(null);
    var converted = users.filter(function (u) { return payers[u.id]; }).length;
    var adj = tx.filter(function (x) { return x.kind === 'adjustment'; });
    var reversed = tx.filter(function (x) { return x.kind === 'commission' && x.status === 'reversed'; });
    var activeRef = {};
    users.forEach(function (u) { activeRef[u.referrer_id] = 1; });
    com.forEach(function (x) { activeRef[x.referrer_id] = 1; });
    Object.keys(activeRef).forEach(function (id) {
      if (s.byId[id] && s.byId[id].account_status === 'blocked') { delete activeRef[id]; }
    });
    var paidOut = s.transactions.filter(function (x) {
      return (!referrerId || x.referrer_id === referrerId) && x.status === 'paid' && inR(x.paid_at, r);
    });

    var o = {
      referred: users.length,
      converted: converted,
      conversion: users.length ? converted / users.length * 100 : 0,
      activeReferrers: Object.keys(activeRef).length,
      txCount: com.length,
      grossPaidC: sum(com, function (x) { return c(x.amount_paid); }),
      feesC: sum(com, function (x) { return c(x.platform_fee); }),
      sharesC: sum(com, function (x) { return c(x.referral_share); }),
      retainedC: sum(com, function (x) { return c(x.konfluenx_retained); }),
      paidC: sum(com.filter(function (x) { return x.status === 'paid'; }), function (x) { return c(x.referral_share); }),
      pendingC: sum(com.filter(function (x) { return x.status === 'pending'; }), function (x) { return c(x.referral_share); }),
      availableC: sum(com.filter(function (x) { return x.status === 'available'; }), function (x) { return c(x.referral_share); }),
      heldC: sum(com.filter(function (x) { return x.held; }), function (x) { return c(x.referral_share); }),
      adjC: sum(adj, function (x) { return c(x.referral_share); }),
      adjCount: adj.length,
      reversedFeesC: sum(reversed, function (x) { return c(x.platform_fee); }),
      reversedSharesC: sum(reversed, function (x) { return c(x.referral_share); }),
      reversedCount: reversed.length,
      payoutsInWindowC: sum(paidOut, function (x) { return c(x.referral_share); })
    };
    o.unpaidC = o.pendingC + o.availableC;
    o.netC = o.feesC - o.sharesC;
    return o;
  };

  /** Referred users with at least one qualifying (non-reversed) payment, optionally within r. */
  function payingSet(r) {
    var set = {};
    state.transactions.forEach(function (x) {
      if (eligible(x) && (!r || inR(x.created_at, r))) { set[x.user_id] = 1; }
    });
    return set;
  }

  /** One row per referrer for the window. Lifetime figures ignore the window. */
  R.perReferrer = function (r) {
    var s = state;
    var everPaid = payingSet(null);
    return s.referrers.map(function (ref) {
      var mine = s.transactions.filter(function (x) { return x.referrer_id === ref.id; });
      var win = mine.filter(function (x) { return inR(x.created_at, r); });
      var com = win.filter(eligible);
      var earn = win.filter(function (x) { return eligible(x) || x.kind === 'adjustment'; });
      var cohort = s.referred_users.filter(function (u) { return u.referrer_id === ref.id && inR(u.registered_at, r); });
      var payersWin = {};
      com.forEach(function (x) { payersWin[x.user_id] = 1; });
      var conv = cohort.filter(function (u) { return everPaid[u.id]; }).length;
      var life = mine.filter(function (x) { return eligible(x) || x.kind === 'adjustment'; });
      return {
        id: ref.id, ref: ref,
        name: ref.display_name, username: ref.username, code: ref.referral_code,
        status: ref.account_status === 'blocked' ? 'blocked' : ref.earnings_status === 'suspended' ? 'suspended' : 'active',
        referrals: cohort.length,
        paying: Object.keys(payersWin).length,
        converted: conv,
        conversion: cohort.length ? conv / cohort.length * 100 : 0,
        feesC: sum(com, function (x) { return c(x.platform_fee); }),
        sharesC: sum(com, function (x) { return c(x.referral_share); }),
        adjC: sum(win.filter(function (x) { return x.kind === 'adjustment'; }), function (x) { return c(x.referral_share); }),
        paidC: sum(earn.filter(function (x) { return x.status === 'paid'; }), function (x) { return c(x.referral_share); }),
        pendingC: sum(earn.filter(function (x) { return x.status === 'pending' || x.status === 'available'; }), function (x) { return c(x.referral_share); }),
        lifetimeC: sum(life, function (x) { return c(x.referral_share); }),
        totalReferralsEver: s.referred_users.filter(function (u) { return u.referrer_id === ref.id; }).length,
        last: ref.last_activity_at
      };
    });
  };

  /* ---------------------------------------------------------- leaderboard */
  R.METRICS = [
    { id: 'revenue',    label: 'Revenue generated', value: function (x) { return x.feesC; },   fmt: function (x) { return m(x.feesC); } },
    { id: 'earnings',   label: 'Referral earnings', value: function (x) { return x.sharesC; },  fmt: function (x) { return m(x.sharesC); } },
    { id: 'paying',     label: 'Paying users',      value: function (x) { return x.paying; },   fmt: function (x) { return String(x.paying); } },
    { id: 'referrals',  label: 'Total referrals',   value: function (x) { return x.referrals; }, fmt: function (x) { return String(x.referrals); } },
    { id: 'conversion', label: 'Conversion rate',   value: function (x) { return x.referrals >= 3 ? x.conversion : -1; },
      fmt: function (x) { return x.referrals >= 3 ? x.conversion.toFixed(0) + '%' : '—'; } }
  ];

  /** Ranked rows. Revenue breaks every tie, so sign-ups alone never win. */
  R.rank = function (rows, metricId) {
    var met = R.METRICS.filter(function (x) { return x.id === metricId; })[0] || R.METRICS[0];
    return rows.filter(function (x) { return x.status !== 'blocked'; })
      .filter(function (x) { return met.value(x) > 0; })
      .sort(function (a, b) { return (met.value(b) - met.value(a)) || (b.feesC - a.feesC) || (b.paying - a.paying); })
      .map(function (x, i) { return Object.assign({ rank: i + 1, metric: met }, x); });
  };

  R.leaderboardHTML = function (ranked, opts) {
    var o = opts || {};
    var rows = ranked.slice(0, o.limit || 10);
    if (!rows.length) {
      return '<div class="empty rf-empty">' + MB.icon('users', 40) +
        '<h3>No referral activity in this period</h3><p>Pick a longer range.</p></div>';
    }
    return rows.map(function (x) {
      var href = (o.base || '') + 'referral-detail.html?id=' + encodeURIComponent(x.id);
      return '<a class="lb-row rf-lb-row" href="' + MB.esc(href) + '">' +
        '<span class="lb-rank' + (x.rank <= 3 ? ' r' + x.rank : '') + '">' + x.rank + '</span>' +
        MB.avatar({ username: x.username, display_name: x.name }, 'avatar-sm') +
        '<span class="grow rf-lb-who"><span class="lb-name">' + MB.esc(x.name) + '</span>' +
          '<span class="rf-lb-sub">@' + MB.esc(x.username) + ' · ' + x.paying + ' paying · ' +
          x.referrals + ' new referral' + (x.referrals === 1 ? '' : 's') + '</span></span>' +
        (o.compact ? '' :
          '<span class="rf-lb-side num">' + m(x.feesC) + '<small>fees</small></span>' +
          '<span class="rf-lb-side num">' + m(x.sharesC) + '<small>20 % share</small></span>') +
        '<span class="lb-metric">' + MB.esc(x.metric.fmt(x)) + '</span></a>';
    }).join('');
  };

  /* --------------------------------------------------------------- chart */
  function bucketStart(ms, unit) {
    var d = new Date(ms);
    if (unit === 'hour') { d.setUTCMinutes(0, 0, 0); return d.getTime(); }
    d.setUTCHours(0, 0, 0, 0);
    if (unit === 'week') { var wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); }
    return d.getTime();
  }
  R.series = function (r) {
    var unit = r.bucket, step = unit === 'hour' ? 3600000 : unit === 'day' ? DAY : 7 * DAY;
    var buckets = [], idx = {};
    for (var b = bucketStart(r.start, unit); b <= r.end; b += step) {
      idx[b] = buckets.length;
      buckets.push({ start: b, revC: 0, payC: 0 });
    }
    state.transactions.forEach(function (x) {
      if (eligible(x) && inR(x.created_at, r)) {
        var k = idx[bucketStart(t(x.created_at), unit)];
        if (k !== undefined) { buckets[k].revC += c(x.platform_fee); }
      }
      if (x.status === 'paid' && x.paid_at && inR(x.paid_at, r)) {
        var p = idx[bucketStart(t(x.paid_at), unit)];
        if (p !== undefined) { buckets[p].payC += c(x.referral_share); }
      }
    });
    buckets.forEach(function (bk) {
      var d = new Date(bk.start);
      bk.label = unit === 'hour'
        ? String(d.getUTCHours()).padStart(2, '0') + ':00'
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
      bk.long = unit === 'week' ? 'Week of ' + bk.label : unit === 'hour' ? 'Today ' + bk.label + ' UTC' : bk.label;
    });
    return buckets;
  };

  function niceMax(v) {
    if (v <= 0) { return 100; }
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  /** Revenue vs payouts as grouped HTML bars (they scale on a phone where SVG text would not). */
  R.chartHTML = function (buckets, r) {
    var maxC = niceMax(Math.max.apply(null, buckets.map(function (b) { return Math.max(b.revC, b.payC); }).concat([1])));
    var totRev = sum(buckets, function (b) { return b.revC; });
    var totPay = sum(buckets, function (b) { return b.payC; });
    var every = Math.max(1, Math.ceil(buckets.length / 8));
    var grid = [1, .8, .6, .4, .2, 0].map(function (f) {
      return '<div class="rf-grid-line" style="bottom:' + (f * 100) + '%"><span>' + m(maxC * f, 0) + '</span></div>';
    }).join('');
    var cols = buckets.map(function (b, i) {
      var h1 = b.revC / maxC * 100, h2 = b.payC / maxC * 100;
      return '<div class="rf-col" tabindex="0" data-i="' + i + '" aria-label="' + MB.esc(b.long + ': platform fees ' +
          m(b.revC) + ', referral payouts ' + m(b.payC)) + '">' +
        '<div class="rf-pair">' +
          '<i class="rf-mark is-rev" style="height:' + (b.revC ? Math.max(1.5, h1) : 0) + '%"></i>' +
          '<i class="rf-mark is-pay" style="height:' + (b.payC ? Math.max(1.5, h2) : 0) + '%"></i>' +
        '</div>' +
        '<span class="rf-x">' + (i % every === 0 ? MB.esc(b.label) : '') + '</span></div>';
    }).join('');
    return '<div class="rf-legend" aria-hidden="true">' +
        '<span><i class="rf-key is-rev"></i>Referral revenue (platform fees) <b class="num">' + m(totRev) + '</b></span>' +
        '<span><i class="rf-key is-pay"></i>Referral payouts (paid to referrers) <b class="num">' + m(totPay) + '</b></span>' +
      '</div>' +
      '<div class="rf-chart" role="img" aria-label="' + MB.esc('Referral revenue ' + m(totRev) + ' versus referral payouts ' +
        m(totPay) + ', ' + r.text + ', by ' + r.bucket) + '">' +
        '<div class="rf-plot">' + grid + '<div class="rf-cols">' + cols + '</div>' +
          '<div class="rf-tip" aria-hidden="true" hidden></div></div>' +
      '</div>' +
      '<details class="rf-table-view"><summary>View as table</summary><div class="table-wrap">' +
        '<table class="data is-compact"><thead><tr><th>Period</th><th class="ta-r">Referral revenue</th>' +
        '<th class="ta-r">Referral payouts</th></tr></thead><tbody>' +
        buckets.map(function (b) {
          return '<tr><td>' + MB.esc(b.long) + '</td><td class="num">' + m(b.revC) + '</td><td class="num">' + m(b.payC) + '</td></tr>';
        }).join('') + '</tbody></table></div></details>';
  };

  R.wireChart = function (host, buckets) {
    var tip = host.querySelector('.rf-tip');
    var plot = host.querySelector('.rf-plot');
    if (!tip || !plot) { return; }
    function show(col) {
      var b = buckets[Number(col.getAttribute('data-i'))];
      tip.innerHTML = '<strong>' + MB.esc(b.long) + '</strong>' +
        '<span><i class="rf-key is-rev"></i>Revenue <b class="num">' + m(b.revC) + '</b></span>' +
        '<span><i class="rf-key is-pay"></i>Payouts <b class="num">' + m(b.payC) + '</b></span>';
      tip.hidden = false;
      var pr = plot.getBoundingClientRect(), cr = col.getBoundingClientRect();
      var x = cr.left - pr.left + cr.width / 2;
      tip.style.left = Math.max(70, Math.min(pr.width - 70, x)) + 'px';
      MB.$$('.rf-col.is-hover', host).forEach(function (el) { el.classList.remove('is-hover'); });
      col.classList.add('is-hover');
    }
    function hide() {
      tip.hidden = true;
      MB.$$('.rf-col.is-hover', host).forEach(function (el) { el.classList.remove('is-hover'); });
    }
    MB.$$('.rf-col', host).forEach(function (col) {
      col.addEventListener('mouseenter', function () { show(col); });
      col.addEventListener('focus', function () { show(col); });
      col.addEventListener('blur', hide);
    });
    plot.addEventListener('mouseleave', hide);
  };

  /* -------------------------------------------------------------- badges */
  var TX_STATUS = {
    pending: ['badge-warn', 'Pending'], available: ['badge-info', 'Available'], paid: ['badge-active', 'Paid'],
    reversed: ['badge-lost', 'Reversed'], not_eligible: ['badge-neutral', 'Not eligible']
  };
  R.txBadge = function (x) {
    if (x.held) { return '<span class="badge badge-warn" title="Referral earnings suspended — held, not cancelled">Held</span>'; }
    var b = TX_STATUS[x.status] || ['badge-neutral', cap(x.status)];
    return '<span class="badge ' + b[0] + '">' + b[1] + '</span>';
  };
  R.statusBadge = function (s) {
    var map = {
      active: 'badge-active', verified: 'badge-active', resolved: 'badge-active', approved: 'badge-active',
      suspended: 'badge-warn', investigating: 'badge-warn', open: 'badge-lost', verification_pending: 'badge-warn',
      user_submitted: 'badge-info', submitted: 'badge-info', onboarding: 'badge-info', instructions_viewed: 'badge-neutral',
      applicant: 'badge-neutral', not_linked: 'badge-neutral', inactive: 'badge-neutral', blocked: 'badge-lost',
      rejected: 'badge-lost', high: 'badge-lost', medium: 'badge-warn', low: 'badge-neutral'
    };
    return '<span class="badge ' + (map[s] || 'badge-neutral') + '">' + MB.esc(cap(s)) + '</span>';
  };

  /* ------------------------------------------------- calculation + flow */
  /** The money flow for one transaction, as ordered steps with a state each. */
  R.flow = function (x) {
    var s = state, ref = s.byId[x.referrer_id] || {};
    var reached = { pending: 5, available: 7, paid: 9, reversed: 6 }[x.status] || 0;
    var steps = [
      { k: 'User pays', v: m(c(x.amount_paid)), at: x.created_at },
      { k: 'Platform fee calculated', v: m(c(x.platform_fee)), sub: x.platform_fee_pct + ' % of the payment' },
      { k: 'Referral identified', v: '@' + (ref.username || '—'), sub: 'code ' + (ref.referral_code || '—') },
      { k: x.referral_pct + ' % referral share', v: m(c(x.referral_share)), sub: x.referral_pct + ' % of the platform fee' },
      { k: 'KonfluenX share', v: m(c(x.konfluenx_retained)), sub: 'retained' },
      { k: 'Pending', v: s.program.settlement.hold_days + '-day hold', sub: 'refund / chargeback window' },
      { k: 'Settlement condition met', v: x.settles_at ? MB.fmt.date(x.settles_at) : '—', sub: 'hold passed, no refund' },
      { k: 'Available', v: 'awaiting payout run', sub: 'weekly · min ' + m(c(s.program.settlement.min_payout)) },
      { k: 'Paid', v: x.paid_at ? MB.fmt.date(x.paid_at) : '—', sub: x.payout_id || s.program.settlement.rail }
    ];
    steps.forEach(function (st, i) { st.state = i < reached ? 'done' : i === reached ? 'next' : 'todo'; });
    if (x.status === 'reversed') {
      steps = steps.slice(0, 6);
      steps.push({ k: 'Reversed', v: '−' + m(c(x.referral_share)), sub: x.reversal_reason || 'refund', state: 'stop', at: x.reversed_at });
    }
    if (x.held) { steps[reached].k += ' — held'; steps[reached].sub = 'referral earnings suspended'; steps[reached].state = 'stop'; }
    return steps;
  };

  R.flowHTML = function (x) {
    return '<ol class="rf-flow">' + R.flow(x).map(function (st) {
      return '<li class="is-' + st.state + '"><span class="rf-dot" aria-hidden="true"></span>' +
        '<div><div class="rf-flow-k">' + MB.esc(st.k) + '</div>' +
        '<div class="rf-flow-v">' + MB.esc(st.v) + (st.sub ? ' <span>· ' + MB.esc(st.sub) + '</span>' : '') + '</div></div>' +
        '<span class="sr">' + (st.state === 'done' ? 'done' : st.state === 'next' ? 'current step' : st.state === 'stop' ? 'stopped' : 'not yet') + '</span></li>';
    }).join('') + '</ol>';
  };

  /** Opens the exact calculation behind one commission figure. */
  R.openCalc = function (txId) {
    var x = state.transactions.filter(function (y) { return y.id === txId; })[0];
    if (!x) { return; }
    var u = state.users[x.user_id] || {};
    var ref = state.byId[x.referrer_id] || {};
    var body;
    if (x.kind === 'adjustment') {
      body = '<div class="rf-calc">' +
        row('Manual adjustment', m(c(x.referral_share)), 'is-total') +
        '</div><p class="t-sm c-2 mt4">' + MB.esc(x.reason || '') + '</p>' +
        '<p class="t-xs c-3 mt2">By ' + MB.esc((x.actor || {}).name || 'staff') + ' · ' + MB.esc(MB.fmt.date(x.created_at)) +
        '. Adjustments sit outside the 20 % rule and are listed separately in every total.</p>';
    } else {
      body = '<div class="rf-calc">' +
        row('Amount paid by @' + (u.username || 'user'), m(c(x.amount_paid))) +
        row('Eligible platform fee (' + x.platform_fee_pct + ' % of payment)', m(c(x.platform_fee))) +
        row('Referral share (' + x.referral_pct + ' % of fee) → @' + (ref.username || ''), m(c(x.referral_share)), 'is-share') +
        row('KonfluenX retained', m(c(x.konfluenx_retained)), 'is-total') +
        '</div>' +
        '<p class="t-xs c-3 mt3">The share is always ' + x.referral_pct + ' % of the platform fee KonfluenX keeps — never of the ' +
          m(c(x.amount_paid)) + ' the user paid.' +
          (x.kind === 'reversal' ? ' This entry reverses ' + MB.esc(x.reverses) + '; the original record is kept.' : '') + '</p>' +
        (x.kind === 'commission' ? '<h4 class="rf-sub-h mt5">Money flow</h4>' + R.flowHTML(x) : '');
    }
    MB.modal({
      title: (x.kind === 'adjustment' ? 'Adjustment ' : 'Commission ') + x.id,
      sub: x.description + ' · ' + MB.fmt.date(x.created_at),
      body: body,
      actions: [{ label: 'Close', kind: 'ghost', close: true }]
    });
    function row(k, v, cls) {
      return '<div class="rf-calc-row ' + (cls || '') + '"><span>' + MB.esc(k) + '</span><b class="num">' + MB.esc(v) + '</b></div>';
    }
  };

  /** Any element with data-calc="<txn id>" opens the calculation. */
  R.wireCalc = function (root) {
    (root || document).addEventListener('click', function (e) {
      var b = e.target.closest('[data-calc]');
      if (b) { e.preventDefault(); e.stopPropagation(); R.openCalc(b.getAttribute('data-calc')); }
    });
  };
  R.calcButton = function (x) {
    var v = c(x.referral_share);
    if (x.kind === 'not_eligible') { return '<span class="c-3 num">$0.00</span>'; }
    return '<button type="button" class="rf-amt num' + (x.status === 'reversed' || v < 0 ? ' is-void' : '') +
      '" data-calc="' + MB.esc(x.id) + '" aria-label="Show calculation for ' + MB.esc(x.id) + '">' + m(v) + '</button>';
  };

  /* -------------------------------------------------------------- export */
  /** CSV via Blob. Text cells that could be read as a formula are neutralised. */
  R.csv = function (filename, headers, rows) {
    function cell(v) {
      if (v == null) { return ''; }
      var s = String(v);
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) { s = "'" + s; }
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var text = [headers].concat(rows).map(function (r) { return r.map(cell).join(','); }).join('\r\n');
    var blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    MB.toast('Exported ' + rows.length + ' rows');
  };

  /* -------------------------------------------------------- staff actions */
  function actor() {
    var role = MB.roles ? MB.roles.current() : 'admin';
    return { name: role === 'superadmin' ? 'You (Super Admin)' : 'You (Admin)', role: role };
  }
  /** Appends to the audit trail. Never edits or removes an earlier entry. */
  R.record = function (action, targetType, targetId, detail, reason) {
    var e = { id: 'aud_l' + Date.now().toString(36), at: isoNow(), actor: actor(), action: action,
              target_type: targetType, target_id: targetId, detail: detail, reason: reason || '' };
    var o = overlay(); o.audit.push(e); writeOverlay(o);
    state.audit.push(e);
    MB.api.post('admin/referrals/audit', e);
    return e;
  };

  R.setEarnings = function (refId, status, reason) {
    var ref = state.byId[refId];
    var o = overlay();
    o.earnings[refId] = { status: status, at: isoNow(), reason: reason };
    writeOverlay(o);
    ref.earnings_status = status;
    ref.earnings_suspended_at = status === 'suspended' ? isoNow() : null;
    ref.earnings_suspended_reason = status === 'suspended' ? reason : null;
    state.transactions.forEach(function (x) {
      if (x.referrer_id === refId) { x.held = status === 'suspended' && (x.status === 'pending' || x.status === 'available'); }
    });
    MB.api.post('admin/referrals/' + refId + '/earnings', { status: status, reason: reason });
    return R.record(status === 'suspended' ? 'referral.suspend_earnings' : 'referral.resume_earnings', 'referrer', refId,
      status === 'suspended'
        ? 'Referral earnings suspended. Unpaid commissions held. Main account unaffected.'
        : 'Referral earnings resumed. Held commissions return to their normal settlement.', reason);
  };

  /** A manual financial adjustment is a NEW ledger entry with a reason — Super Admin only. */
  R.adjust = function (refId, cents, reason) {
    var x = {
      id: 'rtx_adj_l' + Date.now().toString(36), kind: 'adjustment', referrer_id: refId, user_id: null,
      product: 'adjustment', description: 'Manual adjustment — ' + reason.slice(0, 60),
      amount_paid: 0, platform_fee_pct: 0, platform_fee: 0, referral_pct: state.program.referral_pct,
      referral_share: cents / 100, konfluenx_retained: 0, currency: 'USD', status: 'available',
      created_at: isoNow(), settles_at: isoNow(), paid_at: null, payout_id: null, reason: reason, actor: actor()
    };
    var o = overlay(); o.txns.push(x); writeOverlay(o);
    state.transactions.push(x);
    MB.api.post('admin/referrals/' + refId + '/adjustments', { amount: cents / 100, reason: reason });
    R.record('referral.adjust', 'referrer', refId, 'Manual adjustment ' + (cents >= 0 ? '+' : '−') + m(Math.abs(cents)) + ' (' + x.id + ').', reason);
    return x;
  };

  R.setIb = function (id, patch, reason) {
    var l = state.ib_links.filter(function (x) { return x.id === id; })[0];
    Object.assign(l, patch);
    var o = overlay(); o.ib[id] = Object.assign(o.ib[id] || {}, patch); writeOverlay(o);
    MB.api.post('admin/referrals/ib/' + id, patch);
    return R.record(patch.status === 'verified' ? 'ib.verify' : 'ib.reject', 'ib_link', id,
      patch.status === 'verified'
        ? 'IB link verified for @' + l.username + ' (' + (l.deriv_account || '—') + '). Partner Badge issued.'
        : 'IB link returned to the user for @' + l.username + '.', reason);
  };

  R.AFF_STAGES = ['applicant', 'onboarding', 'submitted', 'approved', 'active'];
  R.AFF_LABELS = { applicant: 'Applicant', onboarding: 'Onboarding', submitted: 'Submitted to Deriv', approved: 'Approved', active: 'Active' };
  R.advanceAffiliate = function (id, reason) {
    var a = state.affiliates.filter(function (x) { return x.id === id; })[0];
    var i = R.AFF_STAGES.indexOf(a.stage);
    if (i < 0 || i >= R.AFF_STAGES.length - 1) { return null; }
    var next = R.AFF_STAGES[i + 1];
    var dStatus = { onboarding: 'Not yet submitted', submitted: 'Under review by Deriv', approved: 'Approved — tracking link issued', active: 'Active affiliate' }[next];
    var patch = { stage: next, deriv_status: dStatus, last_activity_at: isoNow() };
    Object.assign(a, patch);
    var o = overlay(); o.aff[id] = Object.assign(o.aff[id] || {}, patch); writeOverlay(o);
    MB.api.post('admin/referrals/affiliates/' + id, patch);
    return R.record('affiliate.stage', 'affiliate', id, a.name + ' moved to ' + R.AFF_LABELS[next] + '.', reason);
  };

  R.setFlag = function (id, status, note) {
    var f = state.fraud_flags.filter(function (x) { return x.id === id; })[0];
    var patch = { status: status };
    Object.assign(f, patch);
    var o = overlay(); o.flags[id] = patch; writeOverlay(o);
    MB.api.post('admin/referrals/flags/' + id, patch);
    return R.record('fraud.' + status, 'referrer', f.referrer_id, id + ' marked ' + label(status) + '.', note);
  };

  R.setProgram = function (patch, action, detail, reason) {
    var p = JSON.parse(JSON.stringify(state.program));
    Object.keys(patch).forEach(function (k) {
      if (k === 'settlement') { Object.assign(p.settlement, patch.settlement); } else { p[k] = patch[k]; }
    });
    p.updated_at = isoNow();
    state.program = p;
    var o = overlay(); o.program = p; writeOverlay(o);
    MB.api.patch('admin/referrals/program', patch);
    return R.record(action, 'program', 'referral', detail, reason);
  };

  /* --------------------------------------------------------- action modal */
  /**
   * Every state-changing staff action goes through this: a required reason,
   * optional extra fields, and a confirm that only fires when both are valid.
   *   R.actionModal({ title, sub, body, confirm, kind, collect(root) -> {error}|value, onConfirm(value, reason) })
   */
  R.actionModal = function (o) {
    var body = (o.body || '') +
      '<div class="field mt4"><label for="rfReason">Reason (required — saved to the audit trail)</label>' +
      '<textarea class="textarea" id="rfReason" maxlength="500" placeholder="' + MB.esc(o.placeholder || 'What happened and why this action is needed') + '"></textarea>' +
      '<div class="field-error" id="rfErr" role="alert"></div></div>';
    MB.modal({
      title: o.title, sub: o.sub, body: body, wide: !!o.wide,
      actions: [
        { label: 'Cancel', kind: 'ghost', close: true },
        { label: o.confirm || 'Confirm', kind: o.kind || 'brand', onClick: function (h) {
          var err = h.$('#rfErr');
          var reason = h.$('#rfReason').value.trim();
          var value = o.collect ? o.collect(h.root) : null;
          if (value && value.error) { err.textContent = value.error; return; }
          if (reason.length < 8) { err.textContent = 'Give a reason of at least 8 characters.'; h.$('#rfReason').focus(); return; }
          o.onConfirm(value, reason);
          h.close();
        } }
      ]
    });
  };

  /** The audit trail as rows, newest first. */
  R.auditHTML = function (entries) {
    if (!entries.length) { return '<div class="empty rf-empty">' + MB.icon('clock', 40) + '<h3>No staff actions yet</h3></div>'; }
    var icons = { 'referral.adjust': 'scale', 'referral.suspend_earnings': 'ban', 'referral.resume_earnings': 'refresh',
                  'ib.verify': 'verified', 'ib.reject': 'close', 'commission.reverse': 'refresh', 'affiliate.stage': 'handshake',
                  'program.configure': 'settings', 'program.settlement': 'clock', 'program.suspend': 'ban', 'program.resume': 'play' };
    return entries.slice().sort(function (a, b) { return t(b.at) - t(a.at); }).map(function (e) {
      return '<div class="rf-audit-row"><span class="ic">' + MB.icon(icons[e.action] || (e.action.indexOf('fraud') === 0 ? 'flag' : 'edit'), 15) + '</span>' +
        '<div class="grow"><div class="t">' + MB.esc(e.detail) + '</div>' +
        '<div class="m">' + MB.esc(e.actor.name) + ' · ' + MB.esc(cap(e.actor.role)) + ' · ' + MB.esc(MB.fmt.date(e.at)) + ' ' +
          MB.esc(new Date(e.at).toISOString().slice(11, 16)) + ' UTC · <code>' + MB.esc(e.action) + '</code></div>' +
        (e.reason ? '<div class="r">' + MB.esc(e.reason) + '</div>' : '') + '</div></div>';
    }).join('');
  };

  /* ------------------------------------------------------------ reconcile */
  /** Proves the ledger is internally consistent. Returns { ok, problems[] }. */
  R.reconcile = function () {
    var problems = [];
    var com = state.transactions.filter(eligible);
    com.forEach(function (x) {
      var fee = c(x.platform_fee);
      if (fee !== Math.round(c(x.amount_paid) * x.platform_fee_pct / 100)) { problems.push(x.id + ': fee is not ' + x.platform_fee_pct + ' % of the payment'); }
      if (c(x.referral_share) !== Math.round(fee * x.referral_pct / 100)) { problems.push(x.id + ': share is not ' + x.referral_pct + ' % of the fee'); }
      if (c(x.referral_share) + c(x.konfluenx_retained) !== fee) { problems.push(x.id + ': share + retained ≠ fee'); }
    });
    state.transactions.filter(function (x) { return x.kind === 'reversal'; }).forEach(function (x) {
      var orig = state.transactions.filter(function (y) { return y.id === x.reverses; })[0];
      if (!orig || orig.status !== 'reversed' || c(orig.referral_share) !== -c(x.referral_share)) {
        problems.push(x.id + ': reversal does not mirror ' + x.reverses);
      }
    });
    return { ok: !problems.length, problems: problems, checked: com.length };
  };

  MB.referrals = R;
})(window);
