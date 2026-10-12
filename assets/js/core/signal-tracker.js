/* ==========================================================================
   KonfluenX — SIGNAL ENGINE (publish · lock · verify · score · dispute)

   One engine for every signal, whether it was posted from the Signals tab or
   from a room. A signal is resolved from the price feed — never from the
   author's word.

   LIFECYCLE (directive §6)
     Published -> Waiting for Entry -> Entry Hit / Active -> TP/SL Monitoring -> Result

     pending   price has not reached the entry yet (expires after 24h)
     active    entry touched; watching TP1 and SL
     won       TP1 reached before SL. PERMANENT — a later return to SL never
               changes it. Monitoring continues for TP2…TP5 (`monitoring:true`)
               and every further hit is recorded and adds performance points.
     lost      SL reached before TP1
     expired   entry never reached within 24h (not counted either way)

   AMBIGUITY: when one tick spans both the stop and the target, the stop is
   assumed first. The engine never resolves in the author's favour on doubt.

   PERFORMANCE POINTS (directive §7) are NOT KX Points:
     forex      1 point = 1 pip (0.01 on JPY-quoted pairs, 0.0001 otherwise)
     metals     1 point = 1 pip, see PIP_METALS below
     all others 1 point = a 0.01 % move from entry (one basis point), so V75,
                Boom/Crash, crypto and indices are comparable with each other.

   KX POINTS (directive §11–12, via MB.kx when it is loaded):
     posting costs MB.kx.points.cost('signal_post'), refunded if the signal
     fails validation; a WIN awards 'quality_signal'. Every call is guarded so
     the engine works before kx.js exists.

   Stage 2: the server runs `step()` against the Deriv tick stream, owns the
   lock, the version history, the points and the dispute queue. This client
   copy mirrors it so the prototype behaves end to end.

   PUBLIC API — see the bottom of the file.
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  var KEY = 'mb.signals.mine';          /* signals this browser published   */
  var NKEY = 'mb.notifs.local';         /* local notifications              */
  var FKEY = 'mb.signals.feedback';     /* agree / dispute on any signal    */

  var EXPIRY_MS = 24 * 60 * 60 * 1000;  /* entry must be reached within 24h */
  var MONITOR_MS = 7 * 24 * 60 * 60 * 1000; /* TP2+ watched up to 7 days after the win */
  var MAX_ENTRY_GAP = 0.02;             /* entry within 2% of the live price */
  var MIN_REWARD_RISK = 0.5;            /* a 1-pip TP1 with a wide SL cannot farm a win */
  var MAX_TPS = 5;
  var ANALYSIS_MAX = 500;
  var DISPUTE_MIN = 15;                 /* characters in a dispute reason   */
  var CORRECTION_MIN = 10;              /* characters in a correction reason */

  /* Deprecated: the flat 10-point win placeholder. Kept so older callers do
     not break; real scoring is MB.signalTracker.points(sig). */
  var POINTS_WIN = 10;

  /* Metals pip sizes. Brokers disagree on gold; KonfluenX uses the most
     common retail convention so a 1-dollar move in gold = 10 pips:
       XAU (gold) 0.10 · XAG (silver) 0.01 · XPT / XPD (platinum, palladium) 0.10
     Oil (WTI) is a commodity but NOT a metal, so it uses the 0.01 % point. */
  var PIP_METALS = { XAU: 0.1, XAG: 0.01, XPT: 0.1, XPD: 0.1 };

  var STAGES = [
    { key: 'published',  label: 'Published' },
    { key: 'waiting',    label: 'Waiting for Entry' },
    { key: 'active',     label: 'Entry Hit · Active' },
    { key: 'monitoring', label: 'TP/SL Monitoring' },
    { key: 'result',     label: 'Result' }
  ];

  var listeners = [];
  var watching = {};

  /* ---------------------------------------------------------------------- */
  function read(k, d) {
    try { var v = global.localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  function write(k, v) {
    try { global.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  function all() { return read(KEY, []).map(upgrade); }
  function saveAll(list) { write(KEY, list); }
  function emit(sig) { listeners.forEach(function (fn) { try { fn(sig); } catch (e) {} }); }
  function iso(t) { return new Date(t === undefined ? Date.now() : t).toISOString(); }
  function num(v) { return v === '' || v === null || v === undefined ? NaN : Number(v); }
  function round1(n) { return Math.round(n * 10) / 10; }

  function isOpen(s) {
    return s.status === 'pending' || s.status === 'active' || (s.status === 'won' && !!s.monitoring);
  }

  /* Old records stored a single `tp`. A single tp is TP1. */
  function upgrade(s) {
    if (!s) { return s; }
    if (!s.tps) { s.tps = s.tp !== undefined ? [Number(s.tp)] : []; }
    s.tp = s.tps[0];
    if (!s.tp_hits) { s.tp_hits = s.status === 'won' ? [{ level: 1, price: s.tps[0], at: s.resolved_at }] : []; }
    if (!s.versions) {
      s.versions = [{ v: 1, entry: s.entry, sl: s.sl, tps: s.tps.slice(), at: s.posted_at, reason: null }];
      s.version = 1;
    }
    if (s.status === 'won' || s.status === 'lost') { s.points = points(s); }
    return s;
  }

  /* ======================================================================
     PERFORMANCE POINTS
     ====================================================================== */
  function quoteOf(m) {
    var pair = String(m.pair || '').replace(/[^A-Z]/gi, '').toUpperCase();
    if (pair.length >= 6) { return pair.slice(-3); }
    var sym = String(m.symbol || '').replace(/^frx/, '').toUpperCase();
    return sym.length >= 6 ? sym.slice(-3) : '';
  }

  /** Pip size for forex and metals; null for every point-based market. */
  function pipSize(m) {
    var sym = String(m.symbol || '');
    var metal = /^frx(XAU|XAG|XPT|XPD)/.exec(sym);
    if (metal) { return PIP_METALS[metal[1]]; }
    if (m.category === 'forex' || /^frx/.test(sym)) { return quoteOf(m) === 'JPY' ? 0.01 : 0.0001; }
    return null;
  }

  function unitOf(m) {
    var pip = pipSize(m);
    return {
      unit: pip ? 'pips' : 'pts',
      pip: pip,
      basis: pip ? '1 point = 1 pip (' + pip + ')' : '1 point = a 0.01% move from entry'
    };
  }

  /** Signed points for a move from `from` to `to` in the signal's direction. */
  function move(m, direction, from, to) {
    var sign = String(direction).toUpperCase() === 'SELL' ? -1 : 1;
    var pip = pipSize(m);
    var d = (Number(to) - Number(from)) * sign;
    return round1(pip ? d / pip : d / Number(from) * 10000);
  }

  /* Reads either a tracker record or a mock/API signal. */
  function levelsOf(s) {
    if (s.levels) {
      return { direction: String(s.direction).toUpperCase(), entry: s.levels.entry,
               sl: s.levels.sl, tps: s.levels.tps || [] };
    }
    if (s.analysis && !s.entry) {
      return { direction: String(s.direction).toUpperCase(), entry: s.analysis.entry_price,
               sl: s.analysis.stop_loss, tps: s.analysis.take_profits || [] };
    }
    return { direction: String(s.direction || 'BUY').toUpperCase(), entry: Number(s.entry),
             sl: Number(s.sl), tps: (s.tps || (s.tp !== undefined ? [s.tp] : [])).map(Number) };
  }
  function marketOf(s) {
    var m = s.market && typeof s.market === 'object' ? s.market : {};
    return { symbol: s.symbol || m.symbol, category: s.category || m.category,
             pair: s.pair_code || m.pair || s.pair || null,
             dp: s.dp !== undefined ? s.dp : m.decimal_places };
  }
  function stateOf(s) {
    var lc = s.lifecycle || {};
    var st = s.status;
    if (lc.stage) { st = lc.stage === 'waiting' ? 'pending' : lc.stage; }
    return { status: st, tp_hits: s.tp_hits || lc.tp_hits || [] };
  }

  /** Performance points earned: + to the highest TP hit, − to SL on a loss, 0 otherwise. */
  function points(s) {
    if (!s) { return 0; }
    var L = levelsOf(s), m = marketOf(s), st = stateOf(s);
    if (st.status === 'lost') { return move(m, L.direction, L.entry, L.sl); }
    if (st.status === 'won') {
      var hits = st.tp_hits.length || 1;
      return move(m, L.direction, L.entry, L.tps[Math.min(hits, L.tps.length) - 1]);
    }
    return 0;
  }

  /* ======================================================================
     VALIDATION
     ====================================================================== */
  /* Accepts {tps:[…]}, {tp1…tp5} or the legacy {tp}. Blank optional TPs drop out. */
  function draftLevels(d) {
    var raw = d.tps ? d.tps.slice()
      : (d.tp1 !== undefined ? [d.tp1, d.tp2, d.tp3, d.tp4, d.tp5] : [d.tp]);
    var tps = [], gap = false, seenBlank = false;
    raw.slice(0, MAX_TPS).forEach(function (v) {
      var n = num(v);
      if (isNaN(n)) { seenBlank = true; return; }
      if (seenBlank) { gap = true; }
      tps.push(n);
    });
    return {
      direction: String(d.direction || 'BUY').toUpperCase(),
      entry: num(d.entry), sl: num(d.sl), tps: tps, gap: gap
    };
  }

  /**
   * Full check. Returns { ok, errors:{field:msg}, first }.
   * opts.full also requires timeframe, tags, chart and analysis (§5).
   */
  function check(d, live, opts) {
    var o = opts || {};
    var E = {};
    var L = draftLevels(d);
    var buy = L.direction === 'BUY';

    if (o.full && !d.symbol) { E.market = 'Choose a market'; }
    if (!(L.entry > 0)) { E.entry = 'Enter an entry price'; }
    if (!(L.sl > 0)) { E.sl = 'Enter a stop loss'; }
    if (!(L.tps[0] > 0)) { E.tp1 = 'Enter Take profit 1 — it is the official win target'; }
    if (L.gap) { E.tp2 = 'Fill take profits in order — no gaps between TP levels'; }

    if (!E.entry && !E.sl) {
      if (buy && !(L.sl < L.entry)) { E.sl = 'For a BUY, stop loss must be below the entry'; }
      if (!buy && !(L.sl > L.entry)) { E.sl = 'For a SELL, stop loss must be above the entry'; }
    }
    if (!E.entry && !E.tp1) {
      var prev = L.entry;
      for (var i = 0; i < L.tps.length; i++) {
        var t = L.tps[i];
        var ok = buy ? t > prev : t < prev;
        if (!ok) {
          E['tp' + (i + 1)] = i === 0
            ? 'For a ' + L.direction + ', TP1 must be ' + (buy ? 'above' : 'below') + ' the entry'
            : 'TP' + (i + 1) + ' must be ' + (buy ? 'above' : 'below') + ' TP' + i;
          break;
        }
        prev = t;
      }
    }
    if (!E.entry && live && Math.abs(L.entry - live) / live > MAX_ENTRY_GAP) {
      E.entry = 'Entry must be within 2% of the current price (' +
        (MB.fmt ? MB.fmt.price(live, d.dp) : live) + ')';
    }
    if (!E.entry && !E.sl && !E.tp1 && Math.abs(L.tps[0] - L.entry) / Math.abs(L.entry - L.sl) < MIN_REWARD_RISK) {
      E.tp1 = 'TP1 is too close compared with the stop loss (minimum 1:0.5 reward/risk)';
    }

    if (o.full) {
      if (!d.timeframe) { E.timeframe = 'Choose a timeframe'; }
      if (!d.tags || !d.tags.length) { E.tags = 'Pick at least one strategy tag'; }
      if (!d.chart || !d.chart.length) { E.chart = 'Upload a chart image'; }
      var body = String(d.analysis || '').trim();
      if (!body) { E.analysis = 'Write your analysis for this signal'; }
      else if (body.length > ANALYSIS_MAX) { E.analysis = 'Analysis is limited to ' + ANALYSIS_MAX + ' characters'; }
    }

    var order = ['market', 'entry', 'sl', 'tp1', 'tp2', 'tp3', 'tp4', 'tp5', 'timeframe', 'tags', 'chart', 'analysis'];
    var first = null;
    order.some(function (k) { if (E[k]) { first = E[k]; return true; } return false; });
    return { ok: !first, errors: E, first: first };
  }

  /** Legacy surface: returns an error message, or null when acceptable. */
  function validate(d, live) { return check(d, live).first; }

  /* ======================================================================
     ENGINE — pure, so it can be replayed over history and unit-tested.
     step(record, tick, now) -> { patch, events }
     tick = { price, prev?, at? }. The move prev -> price is one segment.
     ====================================================================== */
  /* A tick is either a plain move prev -> price (the path between them is
     monotone), or an OHLC bar with high/low, where the path inside the bar is
     unknown — that is where a genuinely ambiguous "both levels in one tick"
     happens, and it is always resolved against the author. */
  function within(x, a, b) { return Math.min(a, b) <= x && x <= Math.max(a, b); }

  function step(s, t, now) {
    var out = { patch: {}, events: [] };
    var at = t.at !== undefined ? iso(t.at) : iso(now);
    var a = t.prev === undefined ? t.price : t.prev;
    var b = t.price;
    var ohlc = t.high !== undefined || t.low !== undefined;
    var lo = Math.min(a, b, ohlc && t.low !== undefined ? t.low : Infinity);
    var hi = Math.max(a, b, ohlc && t.high !== undefined ? t.high : -Infinity);
    var inR = function (x) { return lo <= x && x <= hi; };
    var buy = s.direction === 'BUY';
    var status = s.status;
    var hits = (s.tp_hits || []).slice();
    var deferTP = false;

    if (status === 'pending') {
      if (now - Date.parse(s.posted_at) > EXPIRY_MS) {
        out.patch = { status: 'expired', resolved_at: at };
        out.events.push({ type: 'expired', at: at });
        return out;
      }
      if (!inR(s.entry)) { return out; }
      status = 'active';
      out.patch.status = 'active';
      out.patch.activated_at = at;
      out.events.push({ type: 'entry', price: s.entry, at: at });
      if (!ohlc) {
        /* only the move after the entry counts */
        lo = Math.min(s.entry, b); hi = Math.max(s.entry, b);
      } else {
        /* Inside a bar the order is unknown. TP1 only counts on the entry bar
           when the bar CLOSED beyond it — then it must have been crossed after
           the entry. A wick to TP1 that closed back is not counted. */
        deferTP = buy ? b < s.tps[0] : b > s.tps[0];
      }
    }

    if (status === 'active') {
      var hitTP = inR(s.tps[0]) && !deferTP;
      var hitSL = inR(s.sl);
      if (!hitTP && !hitSL) { return out; }
      if (hitSL) {
        /* includes the ambiguous tick that spans both: resolved against the author */
        out.patch.status = 'lost';
        out.patch.exit = s.sl;
        out.patch.resolved_at = at;
        out.patch.ambiguous = inR(s.tps[0]);
        out.events.push({ type: 'sl', price: s.sl, at: at, ambiguous: inR(s.tps[0]) });
        return out;
      }
      hits = [{ level: 1, price: s.tps[0], at: at }];
      out.events.push({ type: 'tp', level: 1, price: s.tps[0], at: at });
      for (var i = 1; i < s.tps.length && inR(s.tps[i]); i++) {
        hits.push({ level: i + 1, price: s.tps[i], at: at });
        out.events.push({ type: 'tp', level: i + 1, price: s.tps[i], at: at });
      }
      out.patch.status = 'won';
      out.patch.won_at = at;
      out.patch.resolved_at = at;
      out.patch.tp_hits = hits;
      out.patch.exit = hits[hits.length - 1].price;
      out.patch.monitoring = hits.length < s.tps.length;
      if (!out.patch.monitoring) { out.patch.monitor_end = 'all_targets'; }
      return out;
    }

    if (status === 'won' && s.monitoring) {
      if (now - Date.parse(s.won_at || s.resolved_at) > MONITOR_MS) {
        out.patch = { monitoring: false, monitor_end: 'timeout' };
        return out;
      }
      var next = hits.length;
      var hitNext = next < s.tps.length && inR(s.tps[next]);
      if (inR(s.sl)) {
        /* Back at the stop after the win: monitoring ends, the WIN stands.
           A tick spanning the next TP and the SL does not count the TP. */
        out.patch = { monitoring: false, monitor_end: 'sl_return', sl_return_at: at };
        out.events.push({ type: 'sl_after_win', price: s.sl, at: at, ambiguous: hitNext });
        return out;
      }
      if (!hitNext) { return out; }
      while (next < s.tps.length && inR(s.tps[next])) {
        hits.push({ level: next + 1, price: s.tps[next], at: at });
        out.events.push({ type: 'tp', level: next + 1, price: s.tps[next], at: at });
        next++;
      }
      out.patch.tp_hits = hits;
      out.patch.exit = hits[hits.length - 1].price;
      if (next >= s.tps.length) { out.patch.monitoring = false; out.patch.monitor_end = 'all_targets'; }
    }
    return out;
  }

  /**
   * Replays a price series through the engine — used by the dispute review to
   * show the automated calculation. series = [{ t, p }] (t = ISO or ms).
   */
  function replay(sig, series) {
    var L = levelsOf(sig);
    var rec = {
      direction: L.direction, entry: L.entry, sl: L.sl, tps: L.tps.slice(),
      posted_at: sig.posted_at || sig.published_at || iso(series[0] ? series[0].t : undefined),
      status: 'pending', tp_hits: [], monitoring: false
    };
    var events = [], prev;
    (series || []).forEach(function (pt) {
      var t = typeof pt.t === 'number' ? pt.t : Date.parse(pt.t);
      var r = step(rec, { price: pt.p, prev: prev, high: pt.h, low: pt.l, at: t }, t);
      Object.keys(r.patch).forEach(function (k) { rec[k] = r.patch[k]; });
      events = events.concat(r.events);
      prev = pt.p;
    });
    rec.market = sig.market; rec.symbol = sig.symbol; rec.category = sig.category;
    rec.points = (rec.status === 'won' || rec.status === 'lost') ? points(rec) : 0;
    return { record: rec, events: events };
  }

  /* ======================================================================
     STORE + LIVE WATCH
     ====================================================================== */
  function update(id, patch) {
    var list = all();
    var s = null;
    list.forEach(function (x) {
      if (x.id === id) { Object.keys(patch).forEach(function (k) { x[k] = patch[k]; }); s = x; }
    });
    if (s && (s.status === 'won' || s.status === 'lost')) { s.points = points(s); }
    saveAll(list);
    return s;
  }

  function stats(filter) {
    var list = all().filter(filter || function () { return true; });
    var won = list.filter(function (s) { return s.status === 'won'; }).length;
    var lost = list.filter(function (s) { return s.status === 'lost'; }).length;
    return {
      won: won, lost: lost,
      open: list.filter(function (s) { return s.status === 'pending' || s.status === 'active'; }).length,
      points: round1(list.reduce(function (n, s) { return n + (s.points || 0); }, 0)),
      win_rate: won + lost ? Math.round(won / (won + lost) * 100) : null
    };
  }

  function notify(s, ev) {
    var pts = s.points ? (s.points > 0 ? '+' : '') + s.points + ' ' + unitOf(s).unit : '';
    var title;
    if (ev.type === 'tp' && ev.level === 1) {
      title = 'WIN — your ' + s.pair + ' ' + s.direction + ' signal hit TP1 · ' + pts;
    } else if (ev.type === 'tp') {
      title = s.pair + ' ' + s.direction + ': TP' + ev.level + ' HIT ✓ · now ' + pts;
    } else if (ev.type === 'sl') {
      title = 'LOSS — your ' + s.pair + ' ' + s.direction + ' signal hit SL first · ' + pts;
    } else if (ev.type === 'entry') {
      title = s.pair + ' ' + s.direction + ': entry hit — signal is active';
    } else if (ev.type === 'expired') {
      title = s.pair + ' ' + s.direction + ' signal expired — entry not reached in 24h';
    } else { return; }
    var list = read(NKEY, []);
    list.unshift({
      id: 'loc_' + s.id + '_' + ev.type + (ev.level || ''), type: 'signal_result', title: title,
      body: 'Entry ' + MB.fmt.price(s.entry, s.dp) +
            (s.exit !== undefined ? ' · ' + MB.fmt.price(s.exit, s.dp) : '') +
            ' · record ' + stats().won + 'W / ' + stats().lost + 'L',
      deep_link: s.room_id
        ? 'community/room.html?room=' + encodeURIComponent(s.room_id)
        : 'signals/detail-analysis.html?id=' + encodeURIComponent(s.id),
      created_at: iso(), read_at: null
    });
    write(NKEY, list.slice(0, 50));
    if (MB.toast && ev.type !== 'entry') { MB.toast(title); }
  }

  function kxAward(s) {
    if (s.kx_awarded) { return; }
    /* Stage 2: the server awards; anti-abuse lives inside MB.kx. */
    if (MB.kx && MB.kx.points && MB.kx.points.award) {
      try { MB.kx.points.award('quality_signal', { ref: s.id }); } catch (e) {}
    }
    update(s.id, { kx_awarded: true });
  }

  function evaluate(s, t) {
    if (!isOpen(s)) { return; }
    var r = step(s, t, Date.now());
    if (!Object.keys(r.patch).length) { return; }
    var res = update(s.id, r.patch);
    r.events.forEach(function (ev) {
      notify(res, ev);
      if (ev.type === 'tp' && ev.level === 1) { kxAward(res); }
    });
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

  function livePrice(symbol) {
    var l = MB.ws && symbol ? MB.ws.last(symbol) : null;
    return l ? l.price : null;
  }

  /** Locks a validated draft into the store and starts watching it. */
  function add(d) {
    var live = livePrice(d.symbol);
    var L = draftLevels(d);
    /* levels are stored at the market's precision */
    if (d.dp !== undefined && d.dp !== null) {
      var r = function (n) { return Number(Number(n).toFixed(d.dp)); };
      L.entry = r(L.entry); L.sl = r(L.sl); L.tps = L.tps.map(r);
    }
    var now = iso();
    var s = {
      id: d.id || 'sig_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      msg_id: d.msg_id, room_id: d.room_id, room_name: d.room_name, room_tier: d.room_tier || null,
      symbol: d.symbol, pair: d.pair, pair_code: d.pair_code || null, category: d.category || null,
      dp: d.dp, seed_price: d.seed_price,
      direction: L.direction, entry: L.entry, sl: L.sl, tps: L.tps, tp: L.tps[0],
      timeframe: d.timeframe || null, tags: d.tags || [], analysis: d.analysis || '',
      chart: d.chart || [], kind: d.kind || 'analysis',
      posted_at: now, locked: true,
      status: live && Math.abs(live - L.entry) / live <= 0.0005 ? 'active' : 'pending',
      tp_hits: [], monitoring: false, points: 0,
      version: 1,
      versions: [{ v: 1, entry: L.entry, sl: L.sl, tps: L.tps.slice(), at: now, reason: null }],
      kx_spent: !!d.kx_spent
    };
    if (s.status === 'active') { s.activated_at = s.posted_at; }
    var list = read(KEY, []); list.push(s); saveAll(list);
    watch(s);
    emit(s);
    return s;
  }

  /* ======================================================================
     PUBLISH — the one code path behind compose.html and the room sheet.
     Resolves { ok:true, sig } or { ok:false, error, errors?, privileges? }.
     ====================================================================== */
  /* Pass-through of MB.kx.privileges() (reasons, unlocked_by, eligible_badges,
     can_afford_signal, signal_cost…) with safe defaults when kx.js is absent. */
  function eligibility() {
    var base = { can_post_signals: true, reasons: [], unlocked_by: [], eligible_badges: [], kx: false };
    if (!(MB.kx && MB.kx.privileges)) { return base; }
    try {
      var p = MB.kx.privileges() || {};
      var out = {};
      Object.keys(p).forEach(function (k) { out[k] = p[k]; });
      out.can_post_signals = p.can_post_signals !== false;
      out.reasons = p.reasons || [];
      out.unlocked_by = p.unlocked_by || [];
      out.eligible_badges = p.eligible_badges || [];
      out.kx = true;
      return out;
    } catch (e) { return base; }
  }
  function kxReady() {
    return MB.kx && MB.kx.ready ? Promise.resolve(MB.kx.ready()).catch(function () {}) : Promise.resolve();
  }
  function postCost() {
    if (MB.kx && MB.kx.points && MB.kx.points.cost) {
      try { return Number(MB.kx.points.cost('signal_post')) || 0; } catch (e) {}
    }
    return null;
  }

  function publish(d) {
    var pre = check(d, livePrice(d.symbol), { full: true });
    if (!pre.ok) { return Promise.resolve({ ok: false, error: pre.first, errors: pre.errors }); }
    return kxReady().then(function () { return publishChecked(d); });
  }

  function publishChecked(d) {
    var priv = eligibility();
    if (!priv.can_post_signals) {
      return Promise.resolve({ ok: false, error: 'You cannot post signals yet', privileges: priv });
    }

    var ref = 'sig_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    var spent = Promise.resolve({ ok: true, skipped: true });
    if (MB.kx && MB.kx.points && MB.kx.points.spend) {
      try { spent = Promise.resolve(MB.kx.points.spend('signal_post', { ref: ref })); }
      catch (e) { spent = Promise.resolve({ ok: false, reason: e.message }); }
    }

    return spent.then(function (r) {
      if (r && r.ok === false) {
        var msg = r.reason === 'insufficient'
          ? 'Not enough KX Points to post a signal' + (r.cost ? ' (costs ' + r.cost + ', you have ' + r.balance + ')' : '')
          : r.reason === 'suspended' ? 'Your account is suspended — signals cannot be posted'
          : 'KX Points could not be spent (' + (r.reason || 'unknown') + ')';
        return { ok: false, error: msg, privileges: priv };
      }
      /* Server-side re-validation at the moment of publishing (the price may
         have moved while the form was open). Stage 2: Laravel does this. */
      var final = check(d, livePrice(d.symbol), { full: true });
      if (!final.ok) {
        if (!r.skipped && MB.kx && MB.kx.points && MB.kx.points.refund) {
          try { MB.kx.points.refund('signal_post', { ref: ref }); } catch (e) {}
        }
        return { ok: false, error: final.first + (r.skipped ? '' : ' — your KX Points were refunded'),
                 errors: final.errors };
      }
      var copy = {};
      Object.keys(d).forEach(function (k) { copy[k] = d[k]; });
      copy.id = ref; copy.kx_spent = !r.skipped;
      var sig = add(copy);
      /* Stage 2: POST /signals stores the locked version and starts the
         server-side tick evaluation. */
      if (MB.api) {
        MB.api.post('signals', { id: sig.id, symbol: sig.symbol, direction: sig.direction,
          entry: sig.entry, sl: sig.sl, tps: sig.tps, timeframe: sig.timeframe, tags: sig.tags,
          analysis: sig.analysis, room_id: sig.room_id || null });
      }
      return { ok: true, sig: sig };
    });
  }

  /* ======================================================================
     CORRECTIONS — the original stays in the audit history.
     Only while waiting for entry: once the entry is hit the levels are final.
     ====================================================================== */
  function correct(id, patch, reason) {
    var s = get(id);
    if (!s) { return { ok: false, error: 'Signal not found' }; }
    if (s.status !== 'pending') {
      return { ok: false, error: 'Levels are final once the entry is hit — corrections are only possible while waiting for entry' };
    }
    if (String(reason || '').trim().length < CORRECTION_MIN) {
      return { ok: false, error: 'Explain why the correction is necessary (at least ' + CORRECTION_MIN + ' characters)' };
    }
    var d = { direction: s.direction, dp: s.dp,
              entry: patch.entry !== undefined ? patch.entry : s.entry,
              sl: patch.sl !== undefined ? patch.sl : s.sl,
              tps: patch.tps || s.tps };
    var c = check(d, livePrice(s.symbol));
    if (!c.ok) { return { ok: false, error: c.first, errors: c.errors }; }
    var L = draftLevels(d);
    var v = (s.version || 1) + 1;
    var versions = (s.versions || []).concat([{ v: v, entry: L.entry, sl: L.sl, tps: L.tps.slice(),
      at: iso(), reason: String(reason).trim() }]);
    var res = update(id, { entry: L.entry, sl: L.sl, tps: L.tps, tp: L.tps[0], version: v, versions: versions });
    emit(res);
    return { ok: true, sig: res };
  }

  /* ======================================================================
     AGREE / DISPUTE (directive §8)
     Community opinion never overrides the system and outcomes are never
     voted on: an agree is private feedback; a dispute sends the result to a
     moderator, who can only uphold it or correct it with a written reason.
     Stage 2: POST /signals/{id}/disputes, moderated in the staff portal.
     ====================================================================== */
  function feedback(id) { return read(FKEY, {})[id] || null; }
  function setFeedback(id, rec) {
    var map = read(FKEY, {});
    map[id] = rec;
    write(FKEY, map);
    var s = get(id);
    if (s) { s = update(id, { dispute: rec.kind === 'dispute' ? rec : null }); emit(s); }
    return rec;
  }
  function agree(id) {
    var cur = feedback(id);
    if (cur && cur.kind === 'dispute') { return { ok: false, error: 'You have already disputed this result' }; }
    MB.api && MB.api.post('signals/' + id + '/agree', {});
    return { ok: true, feedback: setFeedback(id, { kind: 'agree', at: iso() }) };
  }
  function dispute(id, reason, extra) {
    var r = String(reason || '').trim();
    if (r.length < DISPUTE_MIN) {
      return { ok: false, error: 'Give a reason of at least ' + DISPUTE_MIN + ' characters' };
    }
    var cur = feedback(id);
    if (cur && cur.kind === 'dispute') { return { ok: false, error: 'This result is already under review' }; }
    var rec = { kind: 'dispute', status: 'open', reason: r, at: iso(),
                id: 'dsp_' + Date.now().toString(36), signal: extra || null };
    MB.api && MB.api.post('signals/' + id + '/disputes', { reason: r });
    return { ok: true, feedback: setFeedback(id, rec) };
  }
  /** Staff side, same browser: uphold or correct a local dispute. */
  function resolveDispute(id, action, reason, outcome) {
    var cur = feedback(id);
    if (!cur || cur.kind !== 'dispute') { return { ok: false, error: 'No open dispute' }; }
    cur.status = action === 'correct' ? 'corrected' : 'upheld';
    cur.resolution = { action: action, reason: reason, outcome: outcome || null, at: iso() };
    setFeedback(id, cur);
    return { ok: true, feedback: cur };
  }
  function localDisputes() {
    var map = read(FKEY, {});
    return Object.keys(map).filter(function (k) { return map[k].kind === 'dispute'; })
      .map(function (k) { var r = map[k]; r.signal_id = k; return r; });
  }

  /* ======================================================================
     VIEW MODELS
     ====================================================================== */
  /** Stage key for the lifecycle strip: published | waiting | active | monitoring | result. */
  function stage(s) {
    var st = stateOf(s).status;
    if (st === 'pending') { return 'waiting'; }
    if (st === 'active') { return 'monitoring'; }
    return 'result';
  }

  function get(id) { return all().filter(function (s) { return s.id === id; })[0] || null; }

  /** The shape MB.card.message renders inside a chat bubble. */
  function toMessageSignal(sig) {
    var s = sig || {};
    var L = levelsOf(s);
    var u = unitOf(marketOf(s));
    var fb = s.id ? feedback(s.id) : null;
    var st = stateOf(s);
    return {
      id: s.id, pair: s.pair || (s.market && s.market.short_name), direction: L.direction,
      dp: s.dp !== undefined ? s.dp : (s.market && s.market.decimal_places),
      entry: L.entry, sl: L.sl, tp: L.tps[0], tps: L.tps.slice(),
      tp_hits: (st.tp_hits || []).map(function (h) { return h.level; }),
      status: st.status, monitoring: !!(s.monitoring || (s.lifecycle && s.lifecycle.monitoring)),
      points: points(s), unit: u.unit, exit: s.exit,
      timeframe: s.timeframe || null, version: s.version || 1,
      ambiguous: !!s.ambiguous,
      matching: s.matching || null,
      dispute: fb && fb.kind === 'dispute' ? { status: fb.status } : (s.dispute || null),
      href: (MB.root ? MB.root() : '') + 'users/signals/detail-analysis.html?id=' + encodeURIComponent(s.id || '')
    };
  }

  /** A locally published record in the feed shape of mock/signals.json, so
      the same cards and detail page render it. Stage 2: the API returns this. */
  function toFeedSignal(rec, author) {
    var s = upgrade(JSON.parse(JSON.stringify(rec)));
    var u = unitOf(marketOf(s));
    var stageKey = s.status === 'pending' ? 'waiting' : s.status;
    return {
      id: s.id, kind: s.kind || 'analysis', status: s.status, instrument: 'analysis', local: true,
      author: author || { id: 'me', username: 'You', display_name: 'You', is_verified: false, is_pro: false, profile_type: 'individual' },
      market: { symbol: s.symbol, name: s.pair, short_name: s.pair, pair: s.pair_code || null,
                category: s.category || null, decimal_places: s.dp },
      direction: String(s.direction).toLowerCase(), tags: s.tags || [], body: s.analysis || '',
      media: s.chart || [], engagement: { views: 0, likes: 0, comments: 0, shares: 0 },
      boost: { is_boosted: false }, published_at: s.posted_at,
      result: s.status === 'won' || s.status === 'lost'
        ? { outcome: s.status, hit_level: s.status === 'won' ? 'tp' + s.tp_hits.length : 'sl',
            resolved_by: 'system_price_feed', verification_status: 'verified', resolved_at: s.resolved_at } : null,
      execution: null,
      analysis: { entry_price: s.entry, stop_loss: s.sl, take_profits: s.tps.slice(), timeframe: s.timeframe },
      levels: { entry: s.entry, sl: s.sl, tps: s.tps.slice() }, timeframe: s.timeframe,
      lifecycle: { stage: stageKey, entry_hit_at: s.activated_at || null,
        tp_hits: s.tp_hits || [], sl_hit_at: s.status === 'lost' ? s.resolved_at : null,
        monitoring: !!s.monitoring, monitor_end: s.monitor_end || null,
        resolved_at: s.resolved_at || null, ambiguous: !!s.ambiguous },
      performance: { points: points(s), unit: u.unit, basis: u.basis },
      room: s.room_id ? { id: s.room_id, name: s.room_name, tier: s.room_tier || null } : null,
      /* Stage 2: matching runs server-side against the provider's Deriv account */
      matching: null,
      versions: s.versions, version: s.version || 1, locked: true, dispute: null
    };
  }

  /* ======================================================================
     PUBLIC API
     ====================================================================== */
  MB.signalTracker = {
    /* constants */
    POINTS_WIN: POINTS_WIN,            /* deprecated placeholder, see points() */
    EXPIRY_MS: EXPIRY_MS, MAX_TPS: MAX_TPS, ANALYSIS_MAX: ANALYSIS_MAX,
    DISPUTE_MIN: DISPUTE_MIN, STAGES: STAGES,

    /* publishing */
    validate: validate,                /* (draft, live) -> message | null (legacy) */
    check: check,                      /* (draft, live, {full}) -> {ok, errors, first} */
    eligibility: eligibility,          /* -> MB.kx.privileges() + {kx}; permissive without kx.js */
    kxReady: kxReady,                  /* -> Promise, resolves once kx.js has its ledger */
    postCost: postCost,                /* -> KX Points per signal, or null without kx.js */
    publish: publish,                  /* (draft) -> Promise<{ok, sig | error}> */
    add: add,                          /* (draft) -> locked record (no KX, no full check) */
    correct: correct,                  /* (id, {entry,sl,tps}, reason) -> {ok, sig | error} */

    /* reading */
    get: get,
    list: function (filter) { return all().filter(filter || function () { return true; }); },
    stats: stats,
    on: function (fn) { listeners.push(fn); },
    notifications: function () { return read(NKEY, []); },
    start: function () { all().filter(isOpen).forEach(watch); },

    /* scoring + engine */
    points: points,                    /* (sig) -> signed performance points */
    unit: function (sig) { return unitOf(marketOf(sig)); },
    pipSize: pipSize,                  /* ({symbol, category, pair}) -> pip | null */
    move: move,                        /* (market, direction, from, to) -> points */
    step: step,                        /* pure engine step */
    replay: replay,                    /* (sig, [{t,p}]) -> {record, events} */
    stage: stage,
    levels: levelsOf,

    /* results feedback */
    feedback: feedback, agree: agree, dispute: dispute,
    resolveDispute: resolveDispute, disputes: localDisputes,

    /* views */
    toMessageSignal: toMessageSignal,
    toFeedSignal: toFeedSignal
  };

  if (MB.ready) { MB.ready(function () { MB.signalTracker.start(); }); }
})(typeof window !== 'undefined' ? window : global);
