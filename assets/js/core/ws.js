/* ==========================================================================
   KonfluenX — DERIV SOCKET

   Architecture §09: price data goes browser-direct to Deriv, purchases go
   through the server. This module owns the browser-direct half.

   ONE socket per tab. Subscriptions are reference-counted, so N components
   watching V75 produce exactly one upstream subscription.

   In prototype mode there is no Deriv app_id, so it runs a local simulator
   that emits realistic synthetic-index ticks. The public surface —
   subscribe / unsubscribe / request / on — is identical either way, so
   nothing above this file changes when the real credentials arrive.
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  var CONFIG = {
    /* Set app_id to go live. Until then the simulator runs. */
    app_id: null,
    endpoint: 'wss://ws.derivws.com/websockets/v3',
    pingMs: 30000,
    maxBackoffMs: 30000,
    staleMs: 5000
  };

  /* Seeded so the prototype shows the same prices as the mockups. */
  var SEEDS = {
    '1HZ75V':  { price: 542893.42, vol: 140,   dp: 2, name: 'Volatility 75 (1s) Index' },
    'R_75':    { price: 542871.21, vol: 120,   dp: 2, name: 'Volatility 75 Index' },
    '1HZ100V': { price: 1247.84,   vol: 0.6,   dp: 2, name: 'Volatility 100 (1s) Index' },
    'R_100':   { price: 1245.10,   vol: 0.5,   dp: 2, name: 'Volatility 100 Index' },
    'R_50':    { price: 238.76,    vol: 0.12,  dp: 3, name: 'Volatility 50 Index' },
    'R_25':    { price: 95.21,     vol: 0.05,  dp: 3, name: 'Volatility 25 Index' },
    'R_10':    { price: 6842.30,   vol: 1.8,   dp: 3, name: 'Volatility 10 Index' },
    'BOOM1000':{ price: 8342.11,   vol: 2.2,   dp: 2, name: 'Boom 1000 Index', spike: 'up' },
    'BOOM500': { price: 9120.44,   vol: 2.6,   dp: 2, name: 'Boom 500 Index',  spike: 'up' },
    'CRASH1000':{price: 4820.15,   vol: 2.1,   dp: 2, name: 'Crash 1000 Index', spike: 'down' },
    'CRASH500':{ price: 4291.63,   vol: 2.4,   dp: 2, name: 'Crash 500 Index',  spike: 'down' },
    'stpRNG':  { price: 1602.45,   vol: 0.10,  dp: 2, name: 'Step Index' },
    'JD75':    { price: 14028.33,  vol: 5.0,   dp: 2, name: 'Jump 75 Index' },
    'JD100':   { price: 6210.90,   vol: 6.4,   dp: 2, name: 'Jump 100 Index' }
  };

  var socket = null;
  var connected = false;
  var reqId = 1;
  var pending = {};                 /* req_id -> resolve                    */
  var refs = {};                    /* symbol  -> subscriber count          */
  var handlers = {};                /* event   -> [fn]                      */
  var last = {};                    /* symbol  -> { price, at, dp }         */
  var backoff = 1000;
  var pingTimer = null;
  var simTimer = null;

  function emit(evt, payload) {
    (handlers[evt] || []).forEach(function (fn) {
      try { fn(payload); } catch (e) { if (global.console) { console.error(e); } }
    });
  }

  /* ======================================================================
     SIMULATOR — stands in for Deriv until app_id is set
     ====================================================================== */
  function simStep() {
    Object.keys(refs).forEach(function (sym) {
      if (!refs[sym]) { return; }
      var s = SEEDS[sym] || { price: 100, vol: 0.4, dp: 2 };
      var cur = last[sym] ? last[sym].price : s.price;
      var drift;

      if (s.spike === 'up') {
        /* Boom: many small down-ticks, occasional large up-spike */
        drift = Math.random() < 0.012 ? s.vol * 22 : -s.vol * (0.2 + Math.random() * 0.5);
      } else if (s.spike === 'down') {
        /* Crash: many small up-ticks, occasional large down-spike */
        drift = Math.random() < 0.012 ? -s.vol * 22 : s.vol * (0.2 + Math.random() * 0.5);
      } else {
        drift = (Math.random() - 0.5) * s.vol * 2;
      }

      var next = Math.max(0.001, cur + drift);
      publishTick(sym, next, s.dp);
    });
  }

  function publishTick(sym, price, dp) {
    var prev = last[sym] ? last[sym].price : price;
    last[sym] = { price: price, at: Date.now(), dp: dp === undefined ? 2 : dp, prev: prev };
    emit('tick', { symbol: sym, price: price, prev: prev, at: last[sym].at, dp: last[sym].dp });
    emit('tick:' + sym, last[sym]);
    MB.store.set('tick:' + sym, last[sym]);
  }

  function startSim() {
    if (simTimer) { return; }
    connected = true;
    emit('open', { simulated: true });
    simTimer = setInterval(simStep, 900);
  }

  /* ======================================================================
     REAL SOCKET
     ====================================================================== */
  function connect() {
    if (!CONFIG.app_id) { startSim(); return; }
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) { return; }

    socket = new WebSocket(CONFIG.endpoint + '?app_id=' + CONFIG.app_id);

    socket.onopen = function () {
      connected = true;
      backoff = 1000;
      emit('open', {});
      /* Resubscribe everything that had subscribers before the gap. */
      Object.keys(refs).forEach(function (sym) {
        if (refs[sym] > 0) { send({ ticks: sym, subscribe: 1 }); }
      });
      /* State across a connection gap is never trusted: callers listening
         for 'reopen' re-fetch open contracts from the server. */
      emit('reopen', {});
      pingTimer = setInterval(function () { send({ ping: 1 }); }, CONFIG.pingMs);
    };

    socket.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }

      if (msg.req_id && pending[msg.req_id]) {
        pending[msg.req_id](msg);
        delete pending[msg.req_id];
      }
      if (msg.tick) {
        publishTick(msg.tick.symbol, Number(msg.tick.quote), msg.tick.pip_size);
      }
      if (msg.error) { emit('error', msg.error); }
    };

    socket.onclose = function () {
      connected = false;
      clearInterval(pingTimer);
      emit('close', {});
      setTimeout(connect, backoff + Math.random() * 400);   /* jittered backoff */
      backoff = Math.min(backoff * 2, CONFIG.maxBackoffMs);
    };

    socket.onerror = function () { emit('error', { message: 'socket error' }); };
  }

  function send(payload) {
    if (!CONFIG.app_id) { return null; }
    if (!socket || socket.readyState !== 1) { return null; }
    socket.send(JSON.stringify(payload));
    return payload;
  }

  /* ======================================================================
     PUBLIC SURFACE
     ====================================================================== */
  MB.ws = {
    config: CONFIG,

    connect: connect,

    isConnected: function () { return connected; },

    /** Teach the simulator a real starting price for a symbol it does not
        know. Without this a forex or crypto pair would tick around 100. */
    seed: function (symbol, price, dp) {
      if (!symbol || SEEDS[symbol]) { return; }
      var p = Number(price);
      if (!isFinite(p) || p <= 0) { return; }
      SEEDS[symbol] = {
        price: p,
        /* volatility scaled to the instrument, so a 1.08 pair and a 542,000
           index both move believably */
        vol: Math.max(Math.pow(10, -(dp === undefined ? 2 : dp)) * 4, p * 0.0004),
        dp: dp === undefined ? 2 : dp,
        name: symbol
      };
    },

    /** Reference-counted. Returns an unsubscribe function. */
    subscribe: function (symbol) {
      if (!symbol) { return function () {}; }
      refs[symbol] = (refs[symbol] || 0) + 1;
      if (refs[symbol] === 1) {
        connect();
        if (CONFIG.app_id) { send({ ticks: symbol, subscribe: 1 }); }
        else if (SEEDS[symbol] && !last[symbol]) {
          publishTick(symbol, SEEDS[symbol].price, SEEDS[symbol].dp);
        }
      } else if (last[symbol]) {
        /* Late subscriber gets the current value immediately. */
        setTimeout(function () { emit('tick:' + symbol, last[symbol]); }, 0);
      }
      var done = false;
      return function unsubscribe() {
        if (done) { return; }
        done = true;
        refs[symbol] = Math.max(0, (refs[symbol] || 1) - 1);
        if (refs[symbol] === 0 && CONFIG.app_id) {
          send({ forget_all: 'ticks' });
        }
      };
    },

    /** Promise-based request with req_id correlation. */
    request: function (payload) {
      if (!CONFIG.app_id) {
        return Promise.resolve({ simulated: true, echo: payload });
      }
      var id = reqId++;
      payload.req_id = id;
      return new Promise(function (resolve, reject) {
        pending[id] = resolve;
        if (!send(payload)) { delete pending[id]; reject(new Error('socket not open')); }
        setTimeout(function () {
          if (pending[id]) { delete pending[id]; reject(new Error('timeout')); }
        }, 12000);
      });
    },

    on: function (evt, fn) {
      (handlers[evt] = handlers[evt] || []).push(fn);
      return function off() {
        handlers[evt] = handlers[evt].filter(function (f) { return f !== fn; });
      };
    },

    last: function (symbol) { return last[symbol] || null; },

    /** True when the newest tick is older than the staleness window. */
    isStale: function (symbol) {
      var l = last[symbol];
      return !l || (Date.now() - l.at) > CONFIG.staleMs;
    },

    seeds: SEEDS
  };

  /* ======================================================================
     LIVE PRICE BINDING
     <span data-tick="1HZ75V"></span>          -> price, tabular
     <span data-tick="1HZ75V" data-tick-flash> -> also flashes on change
     ====================================================================== */
  MB.mountTicks = function (root) {
    var scope = root || document;
    MB.$$('[data-tick]:not([data-tick-bound])', scope).forEach(function (el) {
      var sym = el.getAttribute('data-tick');
      var dp = el.getAttribute('data-tick-dp');
      el.setAttribute('data-tick-bound', '1');
      el.classList.add('num');

      /* The markup already carries the real price from the API — use it as
         the simulator's starting point rather than a generic default. */
      var shown = parseFloat((el.textContent || '').replace(/[^0-9.\-]/g, ''));
      MB.ws.seed(sym, shown, dp !== null ? Number(dp) : undefined);

      var paint = function (t) {
        if (!t) { return; }
        var d = dp !== null ? Number(dp) : t.dp;
        el.textContent = MB.fmt.price(t.price, d);
        if (el.hasAttribute('data-tick-flash') && t.prev !== undefined && t.price !== t.prev) {
          var up = t.price > t.prev;
          el.style.transition = 'none';
          el.style.color = up ? 'var(--mb-green)' : 'var(--mb-sell)';
          setTimeout(function () {
            el.style.transition = 'color .5s';
            el.style.color = '';
          }, 90);
        }
      };

      MB.ws.on('tick:' + sym, paint);
      MB.ws.subscribe(sym);
      if (MB.ws.last(sym)) { paint(MB.ws.last(sym)); }
    });
  };

  /* Suspend ticks while the tab is hidden — battery and quota. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (simTimer) { clearInterval(simTimer); simTimer = null; }
    } else if (!CONFIG.app_id && Object.keys(refs).length) {
      startSim();
    }
  });
})(window);
