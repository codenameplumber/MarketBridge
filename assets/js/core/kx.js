/* ==========================================================================
   KonfluenX — KX ECONOMY  (MB.kx)

   Three separate things live here and must never be mixed up:

     1. KX credits  — purchased platform credit. 1 KX = $1. Bought with USDT
                      through KaastroPay; spent on Pro Room subscriptions,
                      courses, webinars and premium services. NEVER on
                      boosting or advertising. KonfluenX holds no trading
                      funds: KX is not a Deriv balance and is not withdrawable.
     2. KX Points   — earned for useful activity, spent on posting signals and
                      boosting content. Cannot be bought with money or KX.
     3. Creator earnings — money creators earn from their Pro rooms, courses
                      and webinars, net of the platform commission, paid out
                      to a verified KaastroPay account. Not KX.

   Contract other modules build against (see _docs/TASKS-2026-10-12.md):

     MB.kx.balance()                              -> number
     MB.kx.spend(amount, { type, ref, label })    -> Promise<{ ok, balance, txn }>
                                                     rejects Error('insufficient')
     MB.kx.points.balance()                       -> number
     MB.kx.points.cost(action)                    -> number   ('signal_post' | 'boost')
     MB.kx.points.spend(action, { ref })          -> { ok, balance } | { ok:false, reason }
     MB.kx.points.refund(action, { ref })         -> { ok, balance, refunded } | { ok:false, reason }
     MB.kx.points.award(event, { ref, ... })      -> { awarded, reason, balance }
     MB.kx.privileges()                           -> { can_post_signals, reasons:[], unlocked_by:[] , … }

   Stage 1 keeps a local ledger in localStorage ('mb.kx', 'mb.points',
   'mb.creator', and 'mb.kx.config' for Super Admin overrides), seeded from
   mock/kx.json, mock/rewards.json and mock/creator.json.

   Stage 2: the ledger is server-side and the browser never decides a balance.
     - KX balance       GET  /api/v1/kx/wallet
     - KX spend         POST /api/v1/kx/spend   (idempotent on ref; the server
                         debits inside a DB transaction and returns the new
                         balance — a 402 maps to Error('insufficient'))
     - Top up           POST /api/v1/kx/payments → KaastroPay invoice; KX is
                         credited ONLY by the verified KaastroPay webhook
                         (signature checked, amount + network matched).
     - Points           every award/spend/refund/reverse is a server event with
                         the anti-abuse rules below enforced in the service.
     - Creator payouts  POST /api/v1/creator/withdrawals → KaastroPay payout API;
                         status moves by KaastroPay payout webhook.
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  var KEY_KX = 'mb.kx';
  var KEY_PTS = 'mb.points';
  var KEY_CREATOR = 'mb.creator';
  var KEY_CONFIG = 'mb.kx.config';

  /* Badges that are performance awards: they can never be a prerequisite for
     anything, whatever the configuration says. */
  var PERFORMANCE_AWARDS = ['top_signal_provider'];

  /* ----------------------------------------------------------------------
     DEFAULTS — mirror mock/kx.json so the synchronous API answers sensibly
     before (or without) the fixture loading. ready() replaces them.
     ---------------------------------------------------------------------- */
  var DEFAULT_CONFIG = {
    usd_rate: 1,
    min_topup: 5,
    max_topup: 5000,
    presets: [10, 20, 50],
    payment_window_min: 15,
    networks: [
      { id: 'TRC20', label: 'Tron (TRC20)', short: 'TRC20', confirmations: 19, eta: '1–3 minutes', recommended: true },
      { id: 'ERC20', label: 'Ethereum (ERC20)', short: 'ERC20', confirmations: 12, eta: '3–5 minutes', recommended: false },
      { id: 'BSC', label: 'BNB Smart Chain (BEP20)', short: 'BSC', confirmations: 15, eta: '1–3 minutes', recommended: false }
    ],
    kx_uses: ['subscription', 'purchase'],
    kx_blocked_uses: ['boost', 'advert', 'promotion'],
    points: {
      purchasable: false,
      costs: { signal_post: 5, boost: 50, pin_room: 120, spotlight: 200 },
      daily_cap_total: 150,
      starter_grant: 50,
      earn: {
        answer_question:   { label: 'Answering a trading question', points: 5, daily_cap: 25, min_chars: 40 },
        helpful_post:      { label: 'A post others mark helpful', points: 10, daily_cap: 50 },
        educational:       { label: 'Educational contribution', points: 20, daily_cap: 40, min_chars: 200 },
        achievement:       { label: 'Completing an achievement', points: 0, daily_cap: 0 },
        streak_day:        { label: 'Consistent participation (daily streak)', points: 2, daily_cap: 2 },
        quality_signal:    { label: 'A quality signal (verified result)', points: 15, daily_cap: 45 },
        approved_activity: { label: 'Other activity approved by KonfluenX', points: 10, daily_cap: 30 }
      }
    },
    creator: { commission_pct: 20, commission_status: 'provisional', pending_days: 7, min_withdrawal: 20 },
    badges: {
      founding_member:       { name: 'Founding Member', unlocks_signals: false, points: 50 },
      top_signal_provider:   { name: 'Top Signal Provider', unlocks_signals: false, points: 150, performance_award: true },
      consistent_trader:     { name: 'Consistent Trader', unlocks_signals: true, points: 100 },
      community_contributor: { name: 'Community Contributor', unlocks_signals: false, points: 80 },
      market_specialist:     { name: 'Market Specialist', unlocks_signals: true, points: 100 },
      trading_mentor:        { name: 'Trading Mentor', unlocks_signals: true, points: 120 },
      rising_trader:         { name: 'Rising Trader', unlocks_signals: true, points: 60 },
      konfluenx_partner:     { name: 'KonfluenX Partner', unlocks_signals: false, points: 100 },
      analysis_expert:       { name: 'Analysis Expert', unlocks_signals: true, points: 100 },
      streak_master:         { name: 'Streak Master', unlocks_signals: false, points: 60 }
    }
  };

  var DEFAULT_KX = {
    v: 1, seeded: false, balance: 24,
    account: { suspended: false, badges_held: ['founding_member', 'top_signal_provider', 'consistent_trader',
                                               'market_specialist', 'rising_trader', 'streak_master'] },
    txns: [], payments: {}
  };
  var DEFAULT_PTS = {
    v: 1, seeded: false, balance: 340, lifetime: 1180, streak_days: 12,
    history: [], daily: {}, awarded: {}, spends: {}, texts: [], starter_granted: true
  };

  /* ----------------------------------------------------------------------
     STORAGE — every access guarded: private mode and file:// throw.
     ---------------------------------------------------------------------- */
  function read(key) {
    try {
      var raw = global.localStorage && global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function write(key, val) {
    try { if (global.localStorage) { global.localStorage.setItem(key, JSON.stringify(val)); } } catch (e) { /* quota / private mode */ }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(base, over) {
    var out = clone(base);
    Object.keys(over || {}).forEach(function (k) {
      var v = over[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = merge(out[k], v);
      } else { out[k] = v; }
    });
    return out;
  }
  function round2(n) { return Math.round(Number(n || 0) * 100) / 100; }
  function nowIso() { return new Date().toISOString(); }
  function today() { return nowIso().slice(0, 10); }
  function uid(prefix) {
    return prefix + Math.floor(Date.now() / 1000).toString(36).toUpperCase() +
      Math.floor(Math.random() * 1296).toString(36).toUpperCase();
  }

  var baseConfig = clone(DEFAULT_CONFIG);
  var kx = read(KEY_KX) || clone(DEFAULT_KX);
  var pts = read(KEY_PTS) || clone(DEFAULT_PTS);
  var listeners = [];

  function config() { return merge(baseConfig, read(KEY_CONFIG) || {}); }
  function saveKx() { write(KEY_KX, kx); emit('kx'); }
  function savePts() { write(KEY_PTS, pts); emit('points'); }
  function emit(what) {
    listeners.forEach(function (fn) { try { fn(what); } catch (e) { /* listener error */ } });
  }

  /* ----------------------------------------------------------------------
     LOADING — fixtures seed the ledger once; after that localStorage wins.
     ---------------------------------------------------------------------- */
  function fetchJson(name) {
    if (MB.api && MB.api.get) { return MB.api.get(name); }
    return Promise.reject(new Error('no api'));
  }

  var readyP = null;
  function ready() {
    if (readyP) { return readyP; }
    readyP = Promise.all([
      fetchJson('kx').catch(function () { return null; }),
      fetchJson('rewards').catch(function () { return null; }),
      fetchJson('achievements').catch(function () { return null; })
    ]).then(function (r) {
      var k = r[0] && r[0].data, p = r[1] && r[1].data, a = r[2] && r[2].data;
      if (k && k.config) { baseConfig = merge(DEFAULT_CONFIG, k.config); }
      if (k && !kx.seeded) {
        kx.seeded = true;
        kx.balance = round2(k.balance);
        kx.account = merge(kx.account, k.account || {});
        kx.txns = (k.transactions || []).concat(kx.txns.filter(function (t) { return t.local; }));
        saveKx();
      }
      if (p && !pts.seeded) {
        pts.seeded = true;
        pts.balance = p.balance; pts.lifetime = p.lifetime; pts.streak_days = p.streak_days;
        pts.history = (p.history || []).concat(pts.history.filter(function (h) { return h.local; }));
        savePts();
      }
      /* Held badges follow the achievements fixture (Stage 2: from /me). */
      if (a && a.badges) {
        kx.account.badges_held = a.badges.filter(function (b) { return b.earned; }).map(function (b) { return b.id; });
        write(KEY_KX, kx);
      }
      settlePayments();
      return api;
    });
    return readyP;
  }

  /* ======================================================================
     KX CREDITS
     ====================================================================== */
  function addTxn(t) {
    t.id = t.id || uid('KX');
    t.at = t.at || nowIso();
    t.local = true;
    kx.txns.unshift(t);
    return t;
  }

  function kindOf(type) {
    var t = String(type || '').toLowerCase();
    var cfg = config();
    if (cfg.kx_blocked_uses.some(function (b) { return t.indexOf(b) !== -1; })) { return 'blocked'; }
    if (/sub|room|member/.test(t)) { return 'subscription'; }
    if (/course|webinar|purchase|service|premium|resource/.test(t)) { return 'purchase'; }
    return cfg.kx_uses.indexOf(t) !== -1 ? t : 'purchase';
  }

  function spend(amount, opts) {
    var o = opts || {};
    var amt = round2(amount);
    return new Promise(function (resolve, reject) {
      var err;
      if (!(amt > 0) || !isFinite(amt)) {
        err = new Error('invalid_amount'); err.code = 'invalid_amount'; reject(err); return;
      }
      var kind = kindOf(o.type);
      if (kind === 'blocked') {
        /* KX is never used for boosting or advertising — that is KX Points. */
        err = new Error('not_allowed'); err.code = 'not_allowed';
        err.message_human = 'Boosting and promotion use KX Points, not KX.';
        reject(err); return;
      }
      if (kx.account.suspended) {
        err = new Error('suspended'); err.code = 'suspended'; reject(err); return;
      }
      /* Idempotent on ref + type: a double tap never charges twice. */
      if (o.ref) {
        var dup = kx.txns.filter(function (t) {
          return t.ref === o.ref && t.type === kind && t.amount < 0 && t.at.slice(0, 10) === today();
        })[0];
        if (dup) { resolve({ ok: true, balance: kx.balance, txn: dup, duplicate: true }); return; }
      }
      if (kx.balance < amt) {
        err = new Error('insufficient'); err.code = 'insufficient';
        err.balance = kx.balance; err.needed = round2(amt - kx.balance);
        reject(err); return;
      }
      /* Stage 2: POST /api/v1/kx/spend — the server debits; this is a mirror. */
      setTimeout(function () {
        if (kx.balance < amt) {
          var e2 = new Error('insufficient'); e2.code = 'insufficient';
          e2.balance = kx.balance; e2.needed = round2(amt - kx.balance);
          reject(e2); return;
        }
        kx.balance = round2(kx.balance - amt);
        var txn = addTxn({ type: kind, label: o.label || (kind === 'subscription' ? 'Subscription' : 'Purchase'),
                           amount: -amt, ref: o.ref || null, status: 'completed' });
        saveKx();
        resolve({ ok: true, balance: kx.balance, txn: txn });
      }, 180);
    });
  }

  function txns(filter) {
    settlePayments();
    var list = kx.txns.slice();
    if (filter && filter !== 'all') { list = list.filter(function (t) { return t.type === filter; }); }
    return list.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }
  function txn(id) {
    settlePayments();
    return kx.txns.filter(function (t) { return t.id === id; })[0] || null;
  }

  /* ----------------------------------------------------------------------
     PAYMENTS — KaastroPay crypto top-ups.

     Lifecycle:  awaiting_payment ─(user: "I have sent")→ confirming
                 confirming ─(webhook: full amount)→ completed  → KX credited
                 confirming ─(webhook: short amount)→ underpaid → no credit
                 awaiting_payment ─(15 min pass)→ expired       → no credit

     "I have sent the payment" NEVER credits. In Stage 1 a simulated webhook
     fires a few seconds after the user says they sent it (settlePayments()
     runs on every read, so it lands even if they navigate away).
     Stage 2: the server credits ONLY from the verified KaastroPay webhook;
     the page just polls GET /api/v1/kx/payments/{id}.
     ---------------------------------------------------------------------- */
  var CONFIRM_DELAY_MS = 9000;

  function demoAddress(network, seed) {
    var s = String(seed), h = 0, out = '', i;
    var b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var hex = '0123456789abcdef';
    function next() { h = (h * 1103515245 + 12345 + s.charCodeAt(i % s.length)) % 2147483648; i++; return h; }
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) % 2147483648; }
    if (network === 'TRC20') {
      out = 'T';
      for (var a = 0; a < 33; a++) { out += b58.charAt(next() % b58.length); }
      return out;
    }
    out = '0x';
    for (var c = 0; c < 40; c++) { out += hex.charAt(next() % 16); }
    return out;
  }
  function demoHash(seed) {
    var s = String(seed), h = 7, out = '';
    for (var i = 0; i < 64; i++) { h = (h * 33 + s.charCodeAt(i % s.length) + i) % 2147483648; out += '0123456789abcdef'.charAt(h % 16); }
    return out;
  }

  function createPayment(opts) {
    var o = opts || {};
    var cfg = config();
    var amount = round2(o.amount);
    if (!(amount >= cfg.min_topup) || amount > cfg.max_topup) { throw new Error('invalid_amount'); }
    var net = cfg.networks.filter(function (n) { return n.id === o.network; })[0] || cfg.networks[0];
    var id = uid('KP');
    var created = Date.now();
    var p = {
      id: id,
      reference: 'KX' + String(created).slice(-7),
      asset: 'USDT',
      amount: amount,                     /* USDT to send — 1 USDT buys 1 KX */
      kx: round2(amount / cfg.usd_rate),
      network: net.id,
      network_label: net.label,
      confirmations_needed: net.confirmations,
      address: demoAddress(net.id, id),
      created_at: new Date(created).toISOString(),
      expires_at: new Date(created + cfg.payment_window_min * 60000).toISOString(),
      status: 'awaiting_payment',
      sim: o.sim || 'ok',                 /* 'ok' | 'underpaid' — Stage 1 demo only */
      received: 0
    };
    kx.payments[id] = p;
    saveKx();
    /* Stage 2: POST /api/v1/kx/payments → KaastroPay creates the invoice and
       returns a unique deposit address per payment. */
    return clone(p);
  }

  function getPayment(id) {
    settlePayments();
    var p = kx.payments[id];
    return p ? clone(p) : null;
  }

  function markSent(id) {
    var p = kx.payments[id];
    if (!p) { return null; }
    if (p.status === 'awaiting_payment' || p.status === 'underpaid') {
      p.status = 'confirming';
      p.sent_at = nowIso();
      p.confirm_at = new Date(Date.now() + CONFIRM_DELAY_MS).toISOString();
      saveKx();
    }
    return clone(p);
  }

  function expirePayment(id) {
    var p = kx.payments[id];
    if (p && p.status === 'awaiting_payment') { p.status = 'expired'; saveKx(); }
    return p ? clone(p) : null;
  }

  /* The simulated KaastroPay webhook. Credits only when the full amount has
     been received on the right network. */
  function applyWebhook(p) {
    var due = round2(p.amount);
    var received;
    if (p.sim === 'underpaid' && !p.topped_up) {
      received = round2(Math.max(1, due - Math.max(1, Math.round(due * 0.25))));
      p.topped_up = true;           /* the next "I sent the rest" settles in full */
    } else {
      received = due;
    }
    p.received = received;
    p.txid = p.network === 'TRC20' ? demoHash(p.id) : '0x' + demoHash(p.id);
    p.confirmations = p.confirmations_needed;
    if (received + 1e-9 < due) {
      p.status = 'underpaid';
      p.shortfall = round2(due - received);
      return;
    }
    p.status = 'completed';
    p.completed_at = nowIso();
    kx.balance = round2(kx.balance + p.kx);
    var t = addTxn({
      id: p.reference, type: 'topup', label: 'Top up (USDT — ' + p.network + ')',
      amount: p.kx, ref: p.id, status: 'completed', at: p.completed_at,
      meta: { network: p.network, asset: 'USDT', sent: due, received: received, fee: 0,
              txid: p.txid, address: p.address, payment_id: p.id }
    });
    p.txn_id = t.id;
  }

  function settlePayments() {
    var changed = false, now = Date.now();
    Object.keys(kx.payments || {}).forEach(function (id) {
      var p = kx.payments[id];
      if (p.status === 'awaiting_payment' && now > Date.parse(p.expires_at)) {
        p.status = 'expired'; changed = true;
      } else if (p.status === 'confirming' && p.confirm_at && now >= Date.parse(p.confirm_at)) {
        applyWebhook(p); changed = true;
      }
    });
    if (changed) { saveKx(); }
  }

  /* ======================================================================
     KX POINTS
     ====================================================================== */
  function ptsCost(action) {
    var c = config().points.costs;
    return Object.prototype.hasOwnProperty.call(c, action) ? Number(c[action]) : 0;
  }

  function addHistory(h) {
    h.id = h.id || uid('PT');
    h.at = h.at || nowIso();
    h.local = true;
    pts.history.unshift(h);
  }

  function ptsSpend(action, opts) {
    var o = opts || {};
    var cost = ptsCost(action);
    if (!cost) { return { ok: false, reason: 'unknown_action', balance: pts.balance }; }
    if (kx.account.suspended) { return { ok: false, reason: 'suspended', balance: pts.balance }; }
    var key = action + ':' + (o.ref || '');
    if (o.ref && pts.spends[key]) { return { ok: true, balance: pts.balance, duplicate: true }; }
    if (pts.balance < cost) {
      return { ok: false, reason: 'insufficient', cost: cost, balance: pts.balance, needed: cost - pts.balance };
    }
    pts.balance -= cost;
    if (o.ref) { pts.spends[key] = cost; }
    addHistory({ event: action, label: o.label || (action === 'signal_post' ? 'Signal posted' : 'Boosted content'),
                 points: -cost, ref: o.ref || null });
    savePts();
    return { ok: true, balance: pts.balance, cost: cost };
  }

  function ptsRefund(action, opts) {
    var o = opts || {};
    var key = action + ':' + (o.ref || '');
    var amt = pts.spends[key];
    if (!o.ref || !amt) { return { ok: false, reason: 'not_found', balance: pts.balance }; }
    delete pts.spends[key];
    pts.balance += amt;
    addHistory({ event: action + '_refund', label: o.label ||
                 (action === 'signal_post' ? 'Refund — signal rejected by validation' : 'Refund — boost cancelled'),
                 points: amt, ref: o.ref });
    savePts();
    return { ok: true, balance: pts.balance, refunded: amt };
  }

  function normText(s) {
    return String(s || '').toLowerCase().replace(/https?:\/\/\S+/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /**
   * Award points for an event. Anti-abuse is enforced here (and, in Stage 2,
   * again on the server — the client is never trusted):
   *   - unknown events earn nothing
   *   - self-engagement (opts.self, or actor === owner) earns nothing
   *   - the same event + ref is paid once
   *   - repeated / duplicate text earns nothing; too-short answers earn nothing
   *   - per-event daily caps and an overall daily cap
   *   - suspended accounts earn nothing
   * opts: { ref, text, self, actor, owner, badge, label }
   */
  function ptsAward(event, opts) {
    var o = opts || {};
    var cfg = config().points;
    var rule = cfg.earn[event];
    function no(reason) { return { awarded: 0, reason: reason, balance: pts.balance }; }

    if (!rule) { return no('unknown_event'); }
    if (kx.account.suspended) { return no('suspended'); }
    if (o.self || (o.actor && o.owner && o.actor === o.owner)) { return no('self_engagement'); }
    if (!o.ref) { return no('missing_ref'); }
    var key = event + ':' + o.ref;
    if (pts.awarded[key]) { return no('duplicate'); }

    var amount = Number(rule.points || 0);
    var label = o.label || rule.label;
    var capped = true;

    if (event === 'achievement') {
      var b = config().badges[o.badge || o.ref];
      if (!b) { return no('unknown_badge'); }
      amount = Number(b.points || 0);
      label = o.label || ('Achievement — ' + b.name);
      capped = false;                       /* one-off by badge, not a daily stream */
    }

    var t = null;
    if (o.text !== undefined) {
      t = normText(o.text);
      if (rule.min_chars && t.length < rule.min_chars) { return no('low_effort'); }
      if (pts.texts.indexOf(t) !== -1) { return no('repetitive_content'); }
    }

    var day = null;
    if (capped) {
      /* Only today's counters are kept; older days are dropped. */
      if (!pts.daily[today()]) { pts.daily = {}; pts.daily[today()] = { total: 0 }; }
      day = pts.daily[today()];
      var leftEvent = Math.max(0, Number(rule.daily_cap || 0) - (day[event] || 0));
      var leftTotal = Math.max(0, Number(cfg.daily_cap_total || 0) - (day.total || 0));
      if (leftEvent <= 0) { return no('daily_cap'); }
      if (leftTotal <= 0) { return no('daily_cap_total'); }
      amount = Math.min(amount, leftEvent, leftTotal);
    }

    if (amount <= 0) { return no('nothing_to_award'); }

    if (day) {
      day[event] = (day[event] || 0) + amount;
      day.total = (day.total || 0) + amount;
    }
    if (t !== null) {
      pts.texts.unshift(t);
      pts.texts = pts.texts.slice(0, 200);
    }

    pts.awarded[key] = amount;
    pts.balance += amount;
    pts.lifetime += amount;
    addHistory({ event: event, label: label, points: amount, ref: o.ref });

    /* Starter grant: the first signal-eligibility badge also gives enough
       points for a few signals, so legitimate providers are never blocked. */
    var bonus = 0;
    if (event === 'achievement' && !pts.starter_granted) {
      var bb = config().badges[o.badge || o.ref];
      if (bb && bb.unlocks_signals && PERFORMANCE_AWARDS.indexOf(o.badge || o.ref) === -1) {
        bonus = Number(cfg.starter_grant || 0);
        pts.starter_granted = true;
        pts.balance += bonus; pts.lifetime += bonus;
        addHistory({ event: 'starter_grant', label: 'Starter grant — signal posting unlocked', points: bonus, ref: 'starter' });
      }
    }
    savePts();
    return { awarded: amount + bonus, reason: amount < Number(rule.points || amount) ? 'partially_capped' : 'ok',
             balance: pts.balance };
  }

  /** Points are reversed when the content that earned them is removed. */
  function ptsReverse(event, opts) {
    var o = opts || {};
    var key = event + ':' + (o.ref || '');
    var amt = pts.awarded[key];
    if (!amt) { return { ok: false, reason: 'not_found', balance: pts.balance }; }
    delete pts.awarded[key];
    pts.balance = Math.max(0, pts.balance - amt);
    pts.lifetime = Math.max(0, pts.lifetime - amt);
    addHistory({ event: 'reversal', label: o.label || 'Reversed — content removed', points: -amt, ref: o.ref });
    savePts();
    return { ok: true, balance: pts.balance, reversed: amt };
  }

  /* ======================================================================
     PRIVILEGES — achievements feed signal-posting eligibility.
     ====================================================================== */
  function badgeName(id) {
    var b = config().badges[id];
    return b ? b.name : String(id).replace(/_/g, ' ');
  }
  function eligibilityBadges() {
    var b = config().badges;
    return Object.keys(b).filter(function (id) {
      return b[id].unlocks_signals && PERFORMANCE_AWARDS.indexOf(id) === -1;
    });
  }
  function listNames(ids) {
    var n = ids.map(badgeName);
    if (n.length <= 1) { return n.join(''); }
    return n.slice(0, -1).join(', ') + ' or ' + n[n.length - 1];
  }

  function privileges(opts) {
    var o = opts || {};
    var held = o.badges || kx.account.badges_held || [];
    var suspended = o.suspended !== undefined ? !!o.suspended : !!kx.account.suspended;
    var elig = eligibilityBadges();
    var unlocked = elig.filter(function (id) { return held.indexOf(id) !== -1; });
    var cost = ptsCost('signal_post');
    var reasons = [];
    var can = unlocked.length > 0 && !suspended;

    if (suspended) {
      reasons.push('Your account is suspended, so you cannot post signals until the suspension is lifted.');
    }
    if (!unlocked.length) {
      reasons.push('Signal posting unlocks with one of these achievements: ' + listNames(elig) + '.');
    } else if (!suspended) {
      reasons.push('Signal posting unlocked by ' + unlocked.map(badgeName).join(', ') + '.');
    }
    var afford = pts.balance >= cost;
    if (can && !afford) {
      reasons.push('Each signal costs ' + cost + ' KX Points; you have ' + pts.balance + '. Earn more by contributing.');
    }
    return {
      can_post_signals: can,
      can_afford_signal: afford,
      signal_cost: cost,
      points_balance: pts.balance,
      suspended: suspended,
      reasons: reasons,
      unlocked_by: unlocked.map(function (id) { return { id: id, name: badgeName(id) }; }),
      eligible_badges: elig.map(function (id) { return { id: id, name: badgeName(id), held: held.indexOf(id) !== -1 }; })
    };
  }

  /* ======================================================================
     CREATOR EARNINGS — separate from KX. Seeded from mock/creator.json.
     ====================================================================== */
  var creator = read(KEY_CREATOR);
  var creatorP = null;
  var PAYOUT_DELAY_MS = 7000;

  function saveCreator() { write(KEY_CREATOR, creator); emit('creator'); }

  function settleWithdrawals() {
    if (!creator) { return; }
    var changed = false, now = Date.now();
    creator.withdrawals.forEach(function (w) {
      if (w.status === 'processing' && w.complete_at && now >= Date.parse(w.complete_at)) {
        /* Stage 2: set by the KaastroPay payout webhook, never by a timer. */
        w.status = 'completed';
        w.completed_at = w.complete_at;
        changed = true;
      }
    });
    if (changed) { saveCreator(); }
  }

  function creatorLoad() {
    if (creatorP) { return creatorP; }
    creatorP = (creator && creator.seeded ? Promise.resolve(null) : fetchJson('creator').catch(function () { return null; }))
      .then(function (r) {
        if (r && r.data && !(creator && creator.seeded)) {
          creator = clone(r.data);
          creator.seeded = true;
          saveCreator();
        }
        if (!creator) {
          creator = { seeded: false, summary: { available: 0, pending: 0, lifetime: 0 },
                      kaastropay: { linked: false, verified: false }, earnings: [], withdrawals: [] };
        }
        settleWithdrawals();
        return creatorSummary();
      });
    return creatorP;
  }

  function creatorSummary() {
    settleWithdrawals();
    var c = clone(creator || {});
    var cfg = config().creator;
    c.commission_pct = cfg.commission_pct;
    c.commission_status = cfg.commission_status;
    c.pending_days = cfg.pending_days;
    c.min_withdrawal = cfg.min_withdrawal;
    return c;
  }

  function creatorWithdraw(amount) {
    var amt = round2(amount);
    var cfg = config().creator;
    return new Promise(function (resolve, reject) {
      function fail(code) { var e = new Error(code); e.code = code; reject(e); }
      if (!creator) { fail('not_loaded'); return; }
      if (!creator.kaastropay || !creator.kaastropay.linked) { fail('no_payout_account'); return; }
      if (!creator.kaastropay.verified) { fail('payout_account_unverified'); return; }
      if (!(amt > 0) || !isFinite(amt)) { fail('invalid_amount'); return; }
      if (amt < cfg.min_withdrawal) { fail('below_minimum'); return; }
      if (amt > creator.summary.available) { fail('insufficient'); return; }
      setTimeout(function () {
        creator.summary.available = round2(creator.summary.available - amt);
        creator.summary.withdrawn = round2((creator.summary.withdrawn || 0) + amt);
        var created = Date.now();
        var w = {
          id: 'WD' + String(created).slice(-7),
          amount: amt, fee: 0, received: amt, currency: 'USD',
          destination: creator.kaastropay.account_name + ' — KaastroPay',
          destination_email: creator.kaastropay.email,
          status: 'processing',
          created_at: new Date(created).toISOString(),
          complete_at: new Date(created + PAYOUT_DELAY_MS).toISOString(),
          local: true
        };
        creator.withdrawals.unshift(w);
        saveCreator();
        resolve(clone(w));
      }, 300);
    });
  }

  function creatorWithdrawal(id) {
    settleWithdrawals();
    if (!creator) { return null; }
    var w = creator.withdrawals.filter(function (x) { return x.id === id; })[0];
    return w ? clone(w) : null;
  }

  /* ======================================================================
     SUPER ADMIN — Stage 1 stores overrides locally so the user app reflects
     them in the prototype. Stage 2: PATCH /api/v1/admin/kx/config, audited.
     ====================================================================== */
  function setConfig(patch) {
    var cur = read(KEY_CONFIG) || {};
    var next = merge(cur, patch || {});
    next.usd_rate = 1;                       /* 1 KX = $1 is not configurable */
    if (next.points) { next.points.purchasable = false; }
    if (next.badges) {
      PERFORMANCE_AWARDS.forEach(function (id) { if (next.badges[id]) { next.badges[id].unlocks_signals = false; } });
    }
    write(KEY_CONFIG, next);
    emit('config');
    return config();
  }

  /* ======================================================================
     UI helper — a receipt in the KaastroPay style (green header with amount
     and status pill, amount summary, transaction information, notice).
     ====================================================================== */
  function receipt(r) {
    var esc = MB.esc || function (s) { return String(s); };
    var icon = MB.icon || function () { return ''; };
    var tone = r.status === 'completed' ? 'ok' : (r.status === 'failed' || r.status === 'expired' || r.status === 'underpaid') ? 'bad' : 'wait';
    var pill = { ok: 'Completed', wait: 'Pending', bad: r.status === 'underpaid' ? 'Underpaid' : (r.status === 'expired' ? 'Expired' : 'Failed') }[tone];
    if (r.status_label) { pill = r.status_label; }
    var rows = function (list) {
      return (list || []).map(function (x) {
        return '<div class="rc-row' + (x.cls ? ' ' + x.cls : '') + '"><span class="rc-k">' + esc(x.k) +
          '</span><span class="rc-v num">' + (x.html ? x.v : esc(x.v)) + '</span></div>';
      }).join('');
    };
    return '<article class="rc">' +
      '<header class="rc-hero">' +
        '<div class="rc-brand">' + icon('verified', 16) + '<span>KaastroPay</span></div>' +
        '<div class="rc-title">' + esc(r.title) + '</div>' +
        '<div class="rc-amount num">' + esc(r.amount) + '</div>' +
        '<span class="rc-pill is-' + tone + '">' + icon(tone === 'ok' ? 'check' : tone === 'wait' ? 'clock' : 'warning', 14) +
          '<span>' + esc(pill) + '</span></span>' +
        (r.hero_note ? '<div class="rc-note">' + esc(r.hero_note) + '</div>' : '') +
        '<div class="rc-tag">Fast · Secure · Reliable</div>' +
      '</header>' +
      (r.summary ? '<section class="rc-card"><div class="rc-h">' + icon('receipt', 16) + '<span>Amount summary</span></div>' +
        rows(r.summary) +
        (r.charges !== undefined ? '<div class="rc-charges"><span>Total charges</span><span class="num">' + esc(r.charges) + '</span></div>' : '') +
        (r.net ? '<div class="rc-net"><span>' + esc(r.net.k) + '</span><span class="num">' + esc(r.net.v) + '</span></div>' : '') +
      '</section>' : '') +
      '<section class="rc-card"><div class="rc-h">' + icon('file', 16) + '<span>Transaction information</span></div>' +
        rows(r.info) +
        '<div class="rc-row"><span class="rc-k">Status</span><span class="rc-v"><span class="rc-status is-' + tone + '">' + esc(pill) + '</span></span></div>' +
      '</section>' +
      (r.details && r.details.length ? '<section class="rc-card">' + rows(r.details) + '</section>' : '') +
      (tone !== 'ok' && r.notice !== false ? '<div class="rc-notice is-' + tone + '">' + icon(tone === 'wait' ? 'hourglass' : 'warning', 26) +
        '<div><strong>' + esc(r.notice_title || (tone === 'wait' ? 'This transaction is still being confirmed.' : 'This transaction did not complete.')) + '</strong>' +
        '<p>' + esc(r.notice_text || 'If you did not make this transaction, please contact support immediately.') + '</p></div></div>' : '') +
      '<footer class="rc-foot"><b>KonfluenX</b> × <b>KaastroPay</b><span>Payments processed by KaastroPay, by Kaastro.</span></footer>' +
    '</article>';
  }

  /** One KX ledger row. Credits read green, debits red (money out). */
  function txRow(t, base) {
    var esc = MB.esc || function (s) { return String(s); };
    var icon = MB.icon || function () { return ''; };
    var ic = { topup: 'coin', subscription: 'crown', purchase: 'book', refund: 'refresh' }[t.type] || 'receipt';
    var up = t.amount >= 0;
    var when = MB.fmt ? MB.fmt.date(t.at) + ', ' + new Date(t.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : t.at;
    return '<a class="list-row is-tight" href="' + (base || '') + 'kx-receipt.html?id=' + encodeURIComponent(t.id) + '">' +
      '<span class="kx-row-ic is-' + esc(t.type) + '">' + icon(ic, 18) + '</span>' +
      '<span class="grow"><span class="lr-title truncate" style="display:block">' + esc(t.label) + '</span>' +
        '<span class="lr-sub">' + esc(when) + '</span></span>' +
      '<span class="kx-amt-val num ' + (up ? 'c-up' : 'c-down') + '">' + (up ? '+' : '−') +
        Math.abs(t.amount).toFixed(2) + ' KX</span></a>';
  }

  /* ======================================================================
     PUBLIC API
     ====================================================================== */
  var api = MB.kx = {
    ready: ready,
    config: config,
    balance: function () { settlePayments(); return kx.balance; },
    usd: function (n) { return round2(Number(n || 0) * config().usd_rate); },
    spend: spend,
    transactions: txns,
    transaction: txn,
    on: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },

    payments: {
      create: createPayment,
      get: getPayment,
      list: function () {
        settlePayments();
        return Object.keys(kx.payments || {}).map(function (id) { return clone(kx.payments[id]); })
          .sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
      },
      markSent: markSent,
      expire: expirePayment,
      settle: settlePayments
    },

    points: {
      purchasable: false,                     /* points can never be bought */
      balance: function () { return pts.balance; },
      lifetime: function () { return pts.lifetime; },
      streak: function () { return pts.streak_days; },
      history: function () { return pts.history.slice(); },
      cost: ptsCost,
      spend: ptsSpend,
      refund: ptsRefund,
      award: ptsAward,
      reverse: ptsReverse,
      today: function () { return clone(pts.daily[today()] || { total: 0 }); }
    },

    privileges: privileges,
    badges: {
      name: badgeName,
      info: function (id) { var b = config().badges[id]; return b ? clone(b) : null; },
      eligibility: eligibilityBadges,
      isPerformanceAward: function (id) { return PERFORMANCE_AWARDS.indexOf(id) !== -1; }
    },

    creator: {
      load: creatorLoad,
      summary: creatorSummary,
      withdraw: creatorWithdraw,
      withdrawal: creatorWithdrawal
    },

    admin: { setConfig: setConfig },
    ui: { receipt: receipt, txRow: txRow },

    /* Prototype only: wipe the local ledger so the fixtures seed again. */
    _reset: function () {
      [KEY_KX, KEY_PTS, KEY_CREATOR, KEY_CONFIG].forEach(function (k) {
        try { global.localStorage.removeItem(k); } catch (e) { /* ignore */ }
      });
      kx = clone(DEFAULT_KX); pts = clone(DEFAULT_PTS); creator = null;
      readyP = null; creatorP = null;
    }
  };

  settlePayments();
})(typeof window !== 'undefined' ? window : this);
