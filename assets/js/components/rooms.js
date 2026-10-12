/* ==========================================================================
   KonfluenX — ROOM TIERS, ROOM CARDS AND THE PRO SUBSCRIPTION FLOW

   Trader rooms climb three tiers:
     Trader Room   — anyone can open one. No Deriv connection needed.
     Premium Room  — the owner connected Deriv, so verified performance shows
                     with a "Deriv Verified" badge. NOT paid.
     Pro Room      — monetised in KX. Only after 3 consecutive qualifying
                     months AND KonfluenX approval.
   Market Rooms (one per pair, platform-owned) are not tiered.

   Loaded after cards.js. Owns the room templates the community pages use;
   cards.js keeps C.roomRow for the market list.

   Stage 1 keeps joins, subscriptions and created rooms in localStorage
   (mb.rooms.state). Stage 2:
     POST   /rooms                        create (tier decided server side)
     POST   /rooms/{id}/join | /leave
     POST   /rooms/{id}/subscription      charges KX through the ledger,
                                          idempotent per billing period
     DELETE /rooms/{id}/subscription      cancel at period end
     GET    /rooms/{id}/performance?p=30d verified Deriv performance
     GET    /rooms/{id}/pro-eligibility   month-by-month criteria
   ========================================================================== */
(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};
  var C = MB.card = MB.card || {};
  var KEY = 'mb.rooms.state';

  var TIERS = {
    trader:  { label: 'Trader Room',  cls: 'tier-trader',  icon: 'users',
               blurb: 'Open room for discussion and signals.' },
    premium: { label: 'Premium Room', cls: 'tier-premium', icon: 'verified',
               blurb: 'Deriv connected — members see verified trading performance.' },
    pro:     { label: 'Pro Room',     cls: 'tier-pro',     icon: 'crown',
               blurb: 'Paid in KX. After 3 qualifying months and KonfluenX approval.' }
  };

  function blank() { return { joined: {}, left: {}, subs: {}, created: [] }; }
  function read() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') {
        var b = blank();
        Object.keys(b).forEach(function (k) { if (!s[k]) { s[k] = b[k]; } });
        return s;
      }
    } catch (e) {}
    return blank();
  }
  function write(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  function tier(r) { return r && r.kind === 'trader' ? (r.tier || 'trader') : null; }
  function isPro(r) { return tier(r) === 'pro'; }
  function verified(r) { return !!(r && r.kind === 'trader' && r.deriv_connected && tier(r) !== 'trader'); }

  function addDays(iso, d) { return new Date(new Date(iso).getTime() + d * 86400000).toISOString(); }

  var R = MB.rooms = {
    TIERS: TIERS,
    tier: tier,
    isPro: isPro,
    verified: verified,

    /* Merge local joins / subscriptions / created rooms into the fixture rows. */
    merge: function (rows) {
      var st = read();
      var created = (st.created || []).filter(function (c) {
        return !rows.some(function (r) { return r.id === c.id; });
      });
      return created.concat(rows).map(function (r) {
        if (st.joined[r.id]) { r.is_member = true; }
        if (st.left[r.id]) { r.is_member = false; }
        var sub = st.subs[r.id];
        if (sub) {
          var live = new Date(sub.renews_at).getTime() > Date.now();
          r.is_subscribed = live;
          r.is_member = live || r.is_member;
          r.subscription = sub;
        }
        return r;
      });
    },

    load: function () {
      return MB.api.list('rooms').then(function (rows) { return R.merge(rows); });
    },

    find: function (rows, id, slug) {
      return rows.filter(function (r) { return id ? r.id === id : slug ? r.slug === slug : false; })[0] || null;
    },

    /* Who may read a room's chat, posts and signals. A Pro room is closed to
       non-subscribers — a missing payment module never opens it. */
    hasAccess: function (r) {
      if (!isPro(r)) { return true; }
      return !!(r.is_owner || r.is_subscribed);
    },
    /* Moderators may still look inside to monitor (see, flag) — an explicit
       step on the paywall, never a silent pass. */
    canMonitor: function (r) {
      return isPro(r) && !!(MB.roles && MB.roles.can && MB.roles.can('room.view_all'));
    },

    setJoined: function (r, on) {
      var st = read();
      if (on) { st.joined[r.id] = true; delete st.left[r.id]; }
      else { st.left[r.id] = true; delete st.joined[r.id]; }
      write(st);
      r.is_member = !!on;
    },

    cancelSubscription: function (r) {
      var st = read();
      if (st.subs[r.id]) { st.subs[r.id].cancelled = true; write(st); r.subscription = st.subs[r.id]; }
      /* Stage 2: DELETE /rooms/{id}/subscription — access runs to period end. */
    },

    createRoom: function (d) {
      var st = read();
      var id = 'room_new_' + Date.now().toString(36);
      var room = {
        id: id, kind: 'trader', slug: id, name: d.name, description: d.description,
        owner: { id: 'usr_me', username: 'johndavid', display_name: 'John David', avatar_url: null },
        market: null, markets: d.markets || [],
        member_count: 1, online_count: 1, post_count: 0,
        is_member: true, is_owner: true, can_manage_members: true, visibility: 'public',
        tier: d.deriv_connected ? 'premium' : 'trader',
        owner_type: 'individual', deriv_connected: !!d.deriv_connected,
        performance: null,
        pro: { status: d.deriv_connected ? 'qualifying' : 'not_eligible', months_qualified: 0,
               months_required: 3, price_kx: 0,
               months: d.deriv_connected ? [{ month: 'This month', qualified: null, in_progress: true }] : [] },
        members: [{ user: { id: 'usr_me', username: 'johndavid', display_name: 'John David' },
                    role: 'owner', joined_at: new Date().toISOString(), can_remove: false }],
        created_at: new Date().toISOString(), is_local: true
      };
      st.created.unshift(room);
      write(st);
      /* Stage 2: POST /rooms — the server sets the tier from the verified
         Deriv connection; a client can never declare itself Premium. */
      return room;
    },

    /* ---------------------------------------------------------- badges */
    tierBadge: function (r) {
      var t = tier(r);
      if (!t) { return ''; }
      var T = TIERS[t];
      return '<span class="tier-chip ' + T.cls + '">' + MB.icon(T.icon, 11) + T.label + '</span>';
    },
    derivBadge: function (r) {
      return verified(r)
        ? '<span class="tier-chip tier-deriv">' + MB.icon('verified', 11) + 'Deriv Verified</span>' : '';
    },
    ownerBadge: function (r) {
      return r && r.owner_type === 'institution'
        ? '<span class="tier-chip tier-inst">' + MB.icon('bank', 11) + 'Institution</span>' : '';
    },

    /* ---------------------------------------------------- eligibility */
    /* Five criteria, all required, every month. One good month is not enough. */
    eligibility: function (r) {
      var p = (r && r.pro) || {};
      var c = p.current || {};
      var money = function (n) { return (n >= 0 ? '+' : '-') + '$' + MB.fmt.price(Math.abs(n || 0), 2); };
      var rows = [
        { key: 'signals', label: 'Signal activity',
          detail: (c.signals || 0) + ' of ' + (c.signals_min || 20) + ' signals published this month',
          pass: (c.signals || 0) >= (c.signals_min || 20) },
        { key: 'performance', label: 'Verified performance',
          detail: (c.win_rate || 0) + '% win rate · ' + money(c.net_pl) + ' verified net P/L (min ' +
                  (c.win_rate_min || 55) + '% and positive)',
          pass: (c.win_rate || 0) >= (c.win_rate_min || 55) && (c.net_pl || 0) > 0 },
        { key: 'consistency', label: 'Consistency',
          detail: 'Max drawdown ' + Number(c.max_drawdown || 0).toFixed(1) + '% (limit ' +
                  (c.drawdown_max || 25) + '%) · no losing qualifying month',
          pass: (c.max_drawdown || 0) <= (c.drawdown_max || 25) && (c.worst_month || 0) >= 0 },
        { key: 'violations', label: 'No violations',
          detail: c.violations ? c.violations + ' upheld dispute or moderation strike' : 'No upheld disputes or moderation strikes',
          pass: !c.violations },
        { key: 'activity', label: 'Minimum activity',
          detail: (c.trading_days || 0) + ' of ' + (c.trading_days_min || 15) + ' trading days · ' +
                  (c.active_members || 0) + ' active members (min ' + (c.active_members_min || 50) + ')',
          pass: (c.trading_days || 0) >= (c.trading_days_min || 15) && (c.active_members || 0) >= (c.active_members_min || 50) }
      ];
      return {
        qualified: p.months_qualified || 0, required: p.months_required || 3,
        status: p.status || 'not_eligible', months: p.months || [], criteria: rows,
        met: rows.filter(function (x) { return x.pass; }).length
      };
    }
  };

  /* ======================================================================
     CARDS
     ====================================================================== */
  function marketsLine(r) {
    if (r.market) { return MB.esc(MB.catLabel ? MB.catLabel(r.market.category) : r.market.category); }
    return (r.markets || []).slice(0, 2).map(MB.esc).join(', ') || 'Trader room';
  }
  function avatarFor(r) {
    if (r.kind === 'trader') {
      return '<span class="tr-av' + (isPro(r) ? ' is-pro' : '') + '">' + MB.avatar(r.owner, 'avatar-sm') + '</span>';
    }
    var m = r.market || {};
    return '<span class="mk-chip ' + (MB.mktChipClass ? MB.mktChipClass(m.symbol || '') : '') + '">' +
      MB.esc((m.short_name || m.symbol || r.name).toUpperCase().slice(0, 6)) + '</span>';
  }
  function href(r) { return MB.root() + 'users/community/room.html?room=' + encodeURIComponent(r.id); }

  function action(r, mode) {
    if (r.is_owner) {
      return '<a class="btn btn-ghost btn-sm" href="' + href(r) + '">Manage</a>';
    }
    if (isPro(r) && !r.is_subscribed) {
      return '<span class="tr-sub">' +
        '<button class="btn btn-pro btn-sm" type="button" data-subscribe="' + MB.esc(r.id) + '">Subscribe</button>' +
        '<span class="tr-price">' + (r.pro.price_kx || 0) + ' KX / month</span></span>';
    }
    if (r.is_member || mode === 'joined') {
      return '<a class="btn btn-ghost btn-sm" href="' + href(r) + '">Open</a>';
    }
    return '<button class="btn btn-primary btn-sm" type="button" data-join="' + MB.esc(r.id) + '">Join</button>';
  }

  /* Trader-room card: tier badge, verified figures for Premium/Pro, and the
     right action — Join, Subscribe · 20 KX / month, Open or Manage. */
  C.roomTier = function (r, mode) {
    var perf = r.performance && r.performance.periods && r.performance.periods['30d'];
    var stats = '';
    if (perf && verified(r)) {
      stats = '<span class="tr-stats"><b>' + perf.win_rate + '%</b> Win Rate · <b>' +
        perf.trades + '</b> Trades</span>';
    }
    return '<div class="tr-card' + (isPro(r) ? ' is-pro' : '') + '" data-room-id="' + MB.esc(r.id) + '">' +
      '<a class="tr-main" href="' + href(r) + '">' +
        avatarFor(r) +
        '<span class="tr-body">' +
          '<span class="tr-title"><span class="tr-n">' + MB.esc(r.name) + '</span></span>' +
          '<span class="tr-badges">' + R.tierBadge(r) + R.ownerBadge(r) + '</span>' +
          '<span class="tr-m">' + MB.fmt.compact(r.member_count) + ' members · ' + marketsLine(r) +
            (r.market && r.market.change_pct_24h !== undefined
              ? ' · <span class="' + (r.market.change_pct_24h >= 0 ? 'c-up' : 'c-down') + '">' +
                MB.fmt.pct(r.market.change_pct_24h) + '</span>' : '') + '</span>' +
          stats +
          '<span class="online-dot"><i></i>' + (r.online_count > 0 ? 'Active now' : 'Quiet') + '</span>' +
        '</span>' +
      '</a>' +
      '<span class="tr-act">' + action(r, mode) + '</span>' +
    '</div>';
  };

  /* Joined list: one row for either kind, always "Open" (or Manage). */
  C.roomJoined = function (r) { return C.roomTier(r, 'joined'); };

  /* ======================================================================
     PRO SUBSCRIPTION FLOW
     Subscribe -> paid-room disclaimer -> confirm sheet -> MB.kx.spend ->
     joined. Every cross-module call is guarded, and a missing module shows
     "Payments unavailable" — it never falls through to granting access.
     ====================================================================== */
  function addFundsHref() { return MB.root() + 'users/wallet/add-funds.html'; }

  function unavailable() {
    MB.modal({
      title: 'Payments unavailable',
      sub: 'Nothing was charged',
      body: '<div class="alert alert-warn">' + MB.icon('warning', 16) +
        '<div class="t-sm">KX payments could not load right now, so this Pro room cannot be joined. ' +
        'Try again in a moment.</div></div>',
      actions: [{ label: 'Close', kind: 'ghost', close: true }]
    });
  }

  function insufficient(room, price, balance) {
    MB.modal({
      title: 'Not enough KX',
      sub: room.name + ' costs ' + price + ' KX / month',
      body:
        '<div class="kx-rows">' +
          '<div class="kx-r"><span>Your KX balance</span><b>' + MB.fmt.price(balance, 2) + ' KX</b></div>' +
          '<div class="kx-r"><span>Needed</span><b>' + MB.fmt.price(price, 2) + ' KX</b></div>' +
          '<div class="kx-r"><span>Short by</span><b>' + MB.fmt.price(Math.max(0, price - balance), 2) + ' KX</b></div>' +
        '</div>' +
        '<p class="t-xs c-3 mt3">1 KX = $1. Add funds, then come back to subscribe.</p>' +
        '<a class="btn btn-primary btn-block mt4" href="' + addFundsHref() + '">' +
          MB.icon('plus', 16) + ' Add funds</a>',
      actions: [{ label: 'Not now', kind: 'ghost', close: true }]
    });
  }

  function success(room, sub, price) {
    MB.modal({
      title: 'You’ve joined the room!',
      body:
        '<div class="join-ok">' +
          '<span class="join-ok-ic">' + MB.icon('check', 30) + '</span>' +
          '<div class="t-h3 w-bold mt3">' + MB.esc(room.name) + '</div>' +
          '<div class="t-sm c-2 mt1">Your subscription is now active.</div>' +
        '</div>' +
        '<div class="kx-rows mt4">' +
          '<div class="kx-r"><span>Price</span><b>' + price + ' KX / month</b></div>' +
          '<div class="kx-r"><span>Activated</span><b>' + MB.fmt.date(sub.activated_at) + '</b></div>' +
          '<div class="kx-r"><span>Next renewal</span><b>' + MB.fmt.date(sub.renews_at) + '</b></div>' +
        '</div>' +
        '<a class="btn btn-primary btn-block mt4" href="' + href(room) + '">Go to Room</a>' +
        '<a class="btn btn-ghost btn-block mt2" href="' + MB.root() + 'users/community/index.html?tab=mine">View My Rooms</a>',
      actions: []
    });
  }

  function confirmSheet(room, price) {
    return new Promise(function (resolve) {
      var bal = Number(MB.kx.balance()) || 0;
      if (bal < price) { insufficient(room, price, bal); resolve(false); return; }
      var settled = false;
      MB.modal({
        title: 'Confirm purchase',
        body:
          '<div class="buy-head">' + MB.avatar(room.owner, 'avatar-sm') +
            '<div class="grow" style="min-width:0"><div class="w-bold truncate">' + MB.esc(room.name) + '</div>' +
            '<div class="t-xs c-3 truncate">By ' + MB.esc(room.owner.display_name || room.owner.username) + '</div></div>' +
            R.tierBadge(room) +
          '</div>' +
          '<div class="buy-price"><b>' + price + ' KX</b> / month <span class="t-xs c-3">≈ $' +
            MB.fmt.price(price, 2) + '</span></div>' +
          '<div class="kx-rows">' +
            '<div class="kx-r"><span>Your KX balance</span><b>' + MB.fmt.price(bal, 2) + ' KX</b></div>' +
            '<div class="kx-r"><span>Amount</span><b>' + MB.fmt.price(price, 2) + ' KX</b></div>' +
            '<div class="kx-r"><span>Remaining balance</span><b>' + MB.fmt.price(bal - price, 2) + ' KX</b></div>' +
          '</div>' +
          '<p class="t-xs c-3 mt3">Your subscription is active for 30 days and renews monthly from your KX balance. ' +
            'Cancel anytime from the room — you keep access until the paid month ends. ' +
            'Room content is the owner’s, not KonfluenX’s; it is not financial advice.</p>',
        actions: [
          { label: 'Cancel', kind: 'ghost', close: true },
          { label: 'Confirm & Join', kind: 'trade', onClick: function (m) {
              settled = true; m.close(); resolve(true);
            } }
        ],
        onClose: function () { if (!settled) { resolve(false); } }
      });
    });
  }

  /* opts.onJoined(room) runs after a successful charge. */
  R.subscribe = function (room, opts) {
    var o = opts || {};
    var price = Number(room && room.pro && room.pro.price_kx) || 0;
    var kxReady = MB.kx && typeof MB.kx.spend === 'function' && typeof MB.kx.balance === 'function';
    var discReady = MB.disclaimer && typeof MB.disclaimer.require === 'function';
    if (!room || !isPro(room) || !price || !kxReady || !discReady) { unavailable(); return Promise.resolve(false); }
    if (room.is_subscribed) { return Promise.resolve(true); }

    var accepted;
    try { accepted = Promise.resolve(MB.disclaimer.require('paid_room')); }
    catch (e) { unavailable(); return Promise.resolve(false); }

    return accepted.then(function () { return confirmSheet(room, price); }, function () { return false; })
      .then(function (go) {
        if (!go) { return false; }
        return Promise.resolve(MB.kx.spend(price, {
          type: 'room_subscription', ref: room.id, label: 'Join: ' + room.name
        })).then(function (res) {
          if (!res || res.ok === false) { throw new Error((res && res.reason) || 'failed'); }
          var now = new Date().toISOString();
          var sub = { activated_at: now, renews_at: addDays(now, 30), price_kx: price,
                      txn: res.txn && (res.txn.id || res.txn.ref) || null };
          var st = read();
          st.subs[room.id] = sub; st.joined[room.id] = true; delete st.left[room.id];
          write(st);
          room.is_subscribed = true; room.is_member = true; room.subscription = sub;
          success(room, sub, price);
          if (o.onJoined) { o.onJoined(room); }
          return true;
        }).catch(function (err) {
          if (err && /insufficient/i.test(err.message || String(err))) {
            insufficient(room, price, Number(MB.kx.balance()) || 0);
          } else {
            MB.toast('Payment did not go through — nothing was charged', 'err');
          }
          return false;
        });
      });
  };

  /* Wire Join / Subscribe buttons inside a list host (event delegation). */
  R.wireList = function (host, rowsFn, onChange) {
    if (!host || host.__roomsWired) { return; }
    host.__roomsWired = true;
    host.addEventListener('click', function (e) {
      var j = e.target.closest('[data-join]'), s = e.target.closest('[data-subscribe]');
      if (!j && !s) { return; }
      e.preventDefault();
      var id = (j || s).getAttribute(j ? 'data-join' : 'data-subscribe');
      var room = (rowsFn() || []).filter(function (r) { return r.id === id; })[0];
      if (!room) { return; }
      if (j) {
        R.setJoined(room, true);
        MB.api.post('rooms/' + room.id + '/join');
        MB.toast('Joined ' + room.name);
        if (onChange) { onChange(room); }
      } else {
        R.subscribe(room, { onJoined: function () { if (onChange) { onChange(room); } } });
      }
    });
  };
})(window);
