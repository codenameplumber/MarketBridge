/* ==========================================================================
   KonfluenX — ROOM SIGNAL TRACKER

   A signal posted in a market room is locked the moment it is posted, then
   resolved from the live price — never from the author's word:

     pending  -> price has not reached the entry yet (expires after 24h)
     active   -> entry touched; now watching TP and SL
     won      -> TP reached first   (+POINTS_WIN, notification)
     lost     -> SL reached first   (counted, notification)
     expired  -> entry never reached within 24h (not counted either way)

   Stage 2: the server runs this against the Deriv tick stream, awards the
   points and evaluates badge criteria (room_signals_won, room_signal_points,
   room_signal_win_rate). This client copy mirrors it for the prototype.
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  var KEY = 'mb.signals.mine';
  var NKEY = 'mb.notifs.local';
  var POINTS_WIN = 10;
  var EXPIRY_MS = 24 * 60 * 60 * 1000;
  var MAX_ENTRY_GAP = 0.02;    /* entry within 2% of the live price */
  var MIN_REWARD_RISK = 0.5;   /* a 1-pip TP with a wide SL cannot farm points */

  var listeners = [];
  var watching = {};

  function read(k, d) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  function all() { return read(KEY, []); }
  function saveAll(list) { write(KEY, list); }
  function emit(sig) { listeners.forEach(function (fn) { try { fn(sig); } catch (e) {} }); }

  function isOpen(s) { return s.status === 'pending' || s.status === 'active'; }

  /* Returns an error message, or null when the signal is acceptable. */
  function validate(d, live) {
    var e = Number(d.entry), tp = Number(d.tp), sl = Number(d.sl);
    if (!isFinite(e) || e <= 0) { return 'Enter an entry price'; }
    if (!isFinite(tp) || tp <= 0) { return 'Enter a take profit'; }
    if (!isFinite(sl) || sl <= 0) { return 'Enter a stop loss'; }
    if (d.direction === 'BUY') {
      if (!(tp > e)) { return 'For a BUY, take profit must be above the entry'; }
      if (!(sl < e)) { return 'For a BUY, stop loss must be below the entry'; }
    } else {
      if (!(tp < e)) { return 'For a SELL, take profit must be below the entry'; }
      if (!(sl > e)) { return 'For a SELL, stop loss must be above the entry'; }
    }
    if (live && Math.abs(e - live) / live > MAX_ENTRY_GAP) {
      return 'Entry must be within 2% of the current price (' + MB.fmt.price(live, d.dp) + ')';
    }
    if (Math.abs(tp - e) / Math.abs(e - sl) < MIN_REWARD_RISK) {
      return 'Take profit is too close compared with the stop loss (minimum 1:0.5 reward/risk)';
    }
    return null;
  }

  function notify(s) {
    var won = s.status === 'won';
    var title = won
      ? 'Your ' + s.pair + ' ' + s.direction + ' signal hit TP · +' + s.points + ' points'
      : 'Your ' + s.pair + ' ' + s.direction + ' signal hit SL';
    var list = read(NKEY, []);
    list.unshift({
      id: 'loc_' + s.id, type: 'signal_result', title: title,
      body: 'Entry ' + MB.fmt.price(s.entry, s.dp) + ' · closed at ' + MB.fmt.price(s.exit, s.dp) +
            ' · record ' + stats().won + 'W / ' + stats().lost + 'L',
      deep_link: 'community/room.html?room=' + encodeURIComponent(s.room_id),
      created_at: s.resolved_at, read_at: null
    });
    write(NKEY, list.slice(0, 50));
    if (MB.toast) { MB.toast(title); }
  }

  function update(id, patch) {
    var list = all();
    var s = null;
    list.forEach(function (x) { if (x.id === id) { Object.keys(patch).forEach(function (k) { x[k] = patch[k]; }); s = x; } });
    saveAll(list);
    return s;
  }

  function evaluate(s, t) {
    if (!isOpen(s)) { return; }
    var p = t.price;
    var prev = t.prev === undefined ? p : t.prev;
    var lo = Math.min(p, prev), hi = Math.max(p, prev);
    var now = Date.now();

    if (s.status === 'pending') {
      if (now - new Date(s.posted_at).getTime() > EXPIRY_MS) {
        emit(update(s.id, { status: 'expired', resolved_at: new Date().toISOString() }));
        return;
      }
      if (lo <= s.entry && s.entry <= hi) {
        s = update(s.id, { status: 'active', activated_at: new Date().toISOString() });
        emit(s);
      } else { return; }
    }

    var buy = s.direction === 'BUY';
    var hitTP = buy ? hi >= s.tp : lo <= s.tp;
    var hitSL = buy ? lo <= s.sl : hi >= s.sl;
    if (!hitTP && !hitSL) { return; }
    /* Both inside one tick: the stop is assumed first. Never resolve in the author's favour on ambiguity. */
    var won = hitTP && !hitSL;
    var res = update(s.id, {
      status: won ? 'won' : 'lost',
      exit: won ? s.tp : s.sl,
      points: won ? POINTS_WIN : 0,
      resolved_at: new Date().toISOString()
    });
    notify(res);
    emit(res);
  }

  function watch(s) {
    if (!isOpen(s) || watching[s.symbol] || !MB.ws) { return; }
    if (s.seed_price) { MB.ws.seed(s.symbol, s.seed_price, s.dp); }
    watching[s.symbol] = MB.ws.on('tick:' + s.symbol, function (t) {
      all().filter(function (x) { return x.symbol === s.symbol && isOpen(x); })
        .forEach(function (x) { evaluate(x, t); });
    });
    MB.ws.subscribe(s.symbol);
  }

  function stats(filter) {
    var list = all().filter(filter || function () { return true; });
    var won = list.filter(function (s) { return s.status === 'won'; }).length;
    var lost = list.filter(function (s) { return s.status === 'lost'; }).length;
    return {
      won: won, lost: lost,
      open: list.filter(isOpen).length,
      points: list.reduce(function (n, s) { return n + (s.points || 0); }, 0),
      win_rate: won + lost ? Math.round(won / (won + lost) * 100) : null
    };
  }

  MB.signalTracker = {
    POINTS_WIN: POINTS_WIN,
    validate: validate,
    add: function (d) {
      var live = MB.ws && MB.ws.last(d.symbol) ? MB.ws.last(d.symbol).price : null;
      var s = {
        id: 'sig_' + Date.now().toString(36),
        msg_id: d.msg_id, room_id: d.room_id, room_name: d.room_name,
        symbol: d.symbol, pair: d.pair, dp: d.dp, seed_price: d.seed_price,
        direction: d.direction, entry: Number(d.entry), tp: Number(d.tp), sl: Number(d.sl),
        posted_at: new Date().toISOString(),
        status: live && Math.abs(live - d.entry) / live <= 0.0005 ? 'active' : 'pending',
        points: 0
      };
      if (s.status === 'active') { s.activated_at = s.posted_at; }
      var list = all(); list.push(s); saveAll(list);
      watch(s);
      return s;
    },
    get: function (id) { return all().filter(function (s) { return s.id === id; })[0] || null; },
    list: function (filter) { return all().filter(filter || function () { return true; }); },
    stats: stats,
    on: function (fn) { listeners.push(fn); },
    notifications: function () { return read(NKEY, []); },
    start: function () { all().filter(isOpen).forEach(watch); }
  };

  if (MB.ready) { MB.ready(function () { MB.signalTracker.start(); }); }
})(window);
