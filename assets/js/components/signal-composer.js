/* ==========================================================================
   KonfluenX — SIGNAL COMPOSER (directive §5, image 07 "Post New Signal")

   One form, two hosts:
     MB.signalComposer.render(host, opts)  -> controller   (users/signals/compose.html)
     MB.signalComposer.open(opts)          -> sheet handle (rooms: a bottom sheet)

   opts = {
     market:       symbol string or market object. When given, the pair is
                   LOCKED — a V75 room can only post V75.
     room:         { id, name, tier|kind } or a room id, recorded on the signal
     allowExecutable: show the Analysis / Executable choice (compose page)
     onPublished:  function (sig) — sig is the MB.signalTracker record
     onCancel:     function ()
   }

   Required: Market · Direction · Entry · Stop loss · TP1 · Timeframe ·
   Strategy tags · Chart image · Analysis (max 500). Optional: TP2–TP5.
   TP1 is the official win target. Validation and publishing go through
   MB.signalTracker.check / .publish, so the page and the sheet can never
   disagree. Publishing spends KX Points (refunded if validation rejects).

   Load after signal-tracker.js and cards.js; uploads.js is used for the
   chart when present.
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  var TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
  var TAGS = ['SMC', 'ICT', 'Price Action', 'Scalping', 'Swing', 'Breakout', 'Supply & Demand', 'Liquidity Sweep'];
  var CATS = [
    { v: 'all', l: 'All categories' }, { v: 'synthetic_indices', l: 'Synthetics' },
    { v: 'derived', l: 'Derived' }, { v: 'forex', l: 'Forex' },
    { v: 'crypto', l: 'Crypto' }, { v: 'commodities', l: 'Commodities' },
    { v: 'stock_indices', l: 'Indices' }
  ];
  var seq = 0;
  var marketsP = null;

  function markets() {
    if (!marketsP) { marketsP = MB.api.list('markets').catch(function () { return []; }); }
    return marketsP;
  }
  function T() { return MB.signalTracker; }
  function ensureCss() { if (MB.card && MB.card.sx) { MB.card.sx.ensureCss(); } }

  /* normalise whatever the caller passes into the catalogue's market shape */
  function normMarket(m) {
    if (!m) { return null; }
    if (typeof m === 'string') { return { symbol: m, short_name: m, decimal_places: 2 }; }
    return {
      symbol: m.symbol, short_name: m.short_name || m.name || m.symbol, name: m.name || m.short_name,
      pair: m.pair || null, category: m.category || null,
      decimal_places: m.decimal_places !== undefined ? m.decimal_places : (m.dp !== undefined ? m.dp : 2),
      last_price: m.stats ? m.stats.last_price : m.last_price, contract_kinds: m.contract_kinds || []
    };
  }
  function normRoom(r) {
    if (!r) { return null; }
    if (typeof r === 'string') { return { id: r, name: r, tier: null }; }
    return { id: r.id, name: r.name, tier: r.tier || r.kind || null };
  }

  function req() { return ' <span class="sc-req" aria-hidden="true">*</span>'; }
  function opt() { return ' <span class="sc-opt">(optional)</span>'; }

  /* ======================================================================
     MARKUP
     ====================================================================== */
  function formHtml(p, o) {
    var tf = TIMEFRAMES.map(function (t) {
      return '<option value="' + t + '"' + (t === 'H1' ? ' selected' : '') + '>' + t + '</option>';
    }).join('');
    var tags = TAGS.map(function (t) {
      return '<button type="button" class="chip" data-tag="' + MB.esc(t) + '" aria-pressed="false">' + MB.esc(t) + '</button>';
    }).join('');
    var tpExtra = '';
    for (var i = 3; i <= 5; i++) {
      tpExtra += '<div class="field hide" data-tprow="' + i + '"><label for="' + p + 'TP' + i + '">Take profit ' + i + opt() + '</label>' +
        '<input class="input num" id="' + p + 'TP' + i + '" type="number" step="any" inputmode="decimal" placeholder="Optional">' +
        '<span class="sc-err" data-err="tp' + i + '"></span></div>';
    }

    return '<form class="sc" id="' + p + 'Form" novalidate>' +
      '<div class="alert alert-green sc-banner">' + MB.icon('megaphone', 20) +
        '<div class="t-sm"><strong>Please complete all required fields.</strong>' +
        '<div class="t-xs c-2">Accurate information helps others trade better.</div></div></div>' +

      '<div id="' + p + 'Gate"></div>' +

      /* market */
      '<div class="field" data-field="market">' +
        '<label>Market' + req() + '</label>' +
        (o.locked
          ? '<div class="sc-lock">' + MB.icon('lock', 15) + '<span class="grow truncate" id="' + p + 'MktName">—</span>' +
              '<span class="sc-live" id="' + p + 'Live"></span></div>' +
            '<span class="field-hint">This room only takes ' + '<span id="' + p + 'MktOnly">—</span> signals.</span>'
          : '<div class="sc-grid">' +
              '<select class="select" id="' + p + 'Cat" aria-label="Market category">' +
                CATS.map(function (c) { return '<option value="' + c.v + '">' + c.l + '</option>'; }).join('') + '</select>' +
              '<select class="select" id="' + p + 'Mkt" aria-label="Market"><option value="">Choose market…</option></select>' +
            '</div>' +
            '<span class="field-hint"><span id="' + p + 'MktHint">Pick the exact instrument this signal is for.</span> ' +
              '<span class="sc-live" id="' + p + 'Live"></span></span>') +
        '<span class="sc-err" data-err="market"></span>' +
      '</div>' +

      (o.allowExecutable
        ? '<div class="field hide" id="' + p + 'KindWrap"><label>Signal type</label>' +
            '<div class="segment segment-green" data-group id="' + p + 'Kind">' +
              '<button type="button" class="is-active" data-value="analysis">Analysis</button>' +
              '<button type="button" data-value="executable">Executable</button></div>' +
            '<span class="field-hint" id="' + p + 'KindHint">Price levels are required either way. Executable also opens a pre-filled Deriv ticket for followers.</span>' +
            '<select class="select hide mt2" id="' + p + 'Contract" aria-label="Deriv contract"></select></div>'
        : '') +

      /* direction */
      '<div class="field"><label>Direction' + req() + '</label>' +
        '<div class="dir-pair" id="' + p + 'Dir" role="radiogroup" aria-label="Direction">' +
          '<button type="button" class="dir-btn d-up is-active" data-dir="BUY" role="radio" aria-checked="true">' + MB.icon('up', 17) + ' BUY</button>' +
          '<button type="button" class="dir-btn d-down" data-dir="SELL" role="radio" aria-checked="false">' + MB.icon('down', 17) + ' SELL</button>' +
        '</div></div>' +

      /* levels */
      '<div class="sc-grid">' +
        '<div class="field"><label for="' + p + 'Entry">Entry price' + req() + '</label>' +
          '<input class="input num" id="' + p + 'Entry" type="number" step="any" inputmode="decimal" placeholder="0.00">' +
          '<span class="sc-err" data-err="entry"></span></div>' +
        '<div class="field"><label for="' + p + 'SL">Stop loss' + req() + '</label>' +
          '<input class="input num" id="' + p + 'SL" type="number" step="any" inputmode="decimal" placeholder="0.00">' +
          '<span class="sc-err" data-err="sl"></span></div>' +
        '<div class="field"><label for="' + p + 'TP1">Take profit 1' + req() + '</label>' +
          '<input class="input num" id="' + p + 'TP1" type="number" step="any" inputmode="decimal" placeholder="0.00">' +
          '<span class="sc-err" data-err="tp1"></span></div>' +
        '<div class="field"><label for="' + p + 'TP2">Take profit 2' + opt() + '</label>' +
          '<input class="input num" id="' + p + 'TP2" type="number" step="any" inputmode="decimal" placeholder="Optional">' +
          '<span class="sc-err" data-err="tp2"></span></div>' +
        tpExtra +
      '</div>' +
      '<div class="between g2"><button type="button" class="sc-more" id="' + p + 'AddTP">' + MB.icon('plus', 14) + ' Add TP3</button>' +
        '<span class="sc-rr" id="' + p + 'RR"></span></div>' +
      '<div class="t-xs c-3" style="margin-top:-8px">TP1 is the official win target. Further targets add Performance Points after the win.</div>' +

      /* timeframe */
      '<div class="field"><label for="' + p + 'TF">Timeframe' + req() + '</label>' +
        '<select class="select" id="' + p + 'TF">' + tf + '</select>' +
        '<span class="sc-err" data-err="timeframe"></span></div>' +

      /* tags */
      '<div class="field"><label>Strategy tags' + req() + '</label>' +
        '<div class="sc-tags" id="' + p + 'Tags">' + tags + '</div>' +
        '<span class="sc-err" data-err="tags"></span></div>' +

      /* chart */
      '<div class="field"><label>Chart' + req() + '</label>' +
        '<div id="' + p + 'Drop">' +
          '<button type="button" class="sc-drop" data-pick="' + p + 'File">' +
            '<span class="sc-drop-ic">' + MB.icon('image', 22) + '</span>' +
            '<span class="grow"><span class="sc-drop-t" style="display:block">Upload chart image</span>' +
            '<span class="sc-drop-s" style="display:block">Drag and drop an image here, or tap to browse</span></span>' +
          '</button>' +
          '<div class="composer-previews sc-previews" id="' + p + 'Prev"></div>' +
        '</div>' +
        '<input type="file" id="' + p + 'File" accept="image/*" hidden>' +
        '<span class="sc-err" data-err="chart"></span></div>' +

      /* analysis */
      '<div class="field"><label for="' + p + 'Body">Analysis' + req() + '</label>' +
        '<textarea class="textarea" id="' + p + 'Body" maxlength="500" placeholder="Write your analysis for this signal…"></textarea>' +
        '<div class="between"><span class="sc-err" data-err="analysis"></span><span class="grow"></span>' +
          '<span class="sc-count" id="' + p + 'Count">0/500</span></div></div>' +

      '<div class="alert alert-info">' + MB.icon('lock', 18) +
        '<div class="t-xs"><strong>Publishing locks this signal.</strong> Entry, stop loss and targets cannot be edited. ' +
        'If a correction is ever unavoidable it creates a new version with a reason, and the original stays visible in the history. ' +
        'The result is decided by the price feed: it becomes active when price reaches your entry, and expires if that does not happen within 24 hours.</div></div>' +

      '<div class="sc-err" id="' + p + 'FormErr" role="alert"></div>' +
      '<button type="submit" class="btn btn-primary btn-block btn-lg" id="' + p + 'Publish">' + MB.icon('send', 18) + ' Publish Signal</button>' +
      '<div class="sc-cost" id="' + p + 'Cost"></div>' +
    '</form>';
  }

  /* ======================================================================
     CONTROLLER
     ====================================================================== */
  function render(host, opts) {
    var o = opts || {};
    host = typeof host === 'string' ? MB.$(host) : host;
    if (!host) { return null; }
    ensureCss();

    var p = 'sc' + (++seq) + '_';
    var lockedMarket = normMarket(o.market);
    var room = normRoom(o.room);
    var st = {
      market: lockedMarket, dir: 'BUY', tags: [], kind: 'analysis', tpRows: 2,
      live: null, unsub: null, offTick: null, busy: false, caps: []
    };

    host.innerHTML = formHtml(p, { locked: !!lockedMarket, allowExecutable: !!o.allowExecutable });
    MB.mountIcons(host);
    var $ = function (id) { return document.getElementById(p + id); };
    var form = $('Form');
    /* error slot -> input id suffix (declared first: onMarket clears errors during render) */
    var FIELD_INPUT = { entry: 'Entry', sl: 'SL', tp1: 'TP1', tp2: 'TP2', tp3: 'TP3', tp4: 'TP4', tp5: 'TP5',
                        timeframe: 'TF', analysis: 'Body', market: 'Mkt' };

    /* ---- eligibility gate (§11–12) ------------------------------------ */
    function paintGate() {
      var tr = T();
      var priv = tr ? tr.eligibility() : { can_post_signals: true, kx: false };
      var gate = $('Gate');
      if (!gate) { return; }
      if (priv.can_post_signals && priv.can_afford_signal !== false) {
        gate.innerHTML = '';
      } else {
        var badges = (priv.eligible_badges || []).map(function (b) {
          return '<li>' + MB.esc(b.name) + (b.held ? ' — earned' : '') + '</li>';
        }).join('');
        gate.innerHTML = '<div class="alert alert-warn sc-gate">' + MB.icon('lock', 18) + '<div class="t-sm">' +
          '<strong>' + (priv.can_post_signals ? 'Not enough KX Points to post' : 'Signal posting is not unlocked yet') + '</strong>' +
          (priv.reasons && priv.reasons.length
            ? '<ul class="t-xs c-2">' + priv.reasons.map(function (r) { return '<li>' + MB.esc(r) + '</li>'; }).join('') + '</ul>' : '') +
          (!priv.can_post_signals && badges ? '<div class="t-xs c-2 mt2">Achievements that unlock signal access:</div><ul class="t-xs c-2">' + badges + '</ul>' : '') +
          '<div class="row g2 mt3 wrap">' +
            '<a class="btn btn-ghost btn-sm" href="' + MB.root() + 'users/profile/achievements.html">Achievements</a>' +
            '<a class="btn btn-ghost btn-sm" href="' + MB.root() + 'users/profile/rewards.html">KX Points</a>' +
          '</div></div></div>';
        MB.mountIcons(gate);
      }
      $('Publish').disabled = !(priv.can_post_signals && priv.can_afford_signal !== false);
      var cost = tr ? tr.postCost() : null;
      $('Cost').innerHTML = cost !== null && cost !== undefined
        ? 'Posting costs <strong>' + cost + ' KX Points</strong> · refunded if the signal is rejected · ' +
          'Performance Points are separate and are earned from results'
        : '';
    }
    paintGate();
    if (MB.kx && MB.kx.ready) { Promise.resolve(MB.kx.ready()).then(paintGate, function () {}); }
    var offKx = MB.kx && MB.kx.on ? MB.kx.on(paintGate) : null;

    /* ---- market -------------------------------------------------------- */
    function setLive(price) {
      st.live = price;
      var el = $('Live');
      if (el && st.market) {
        el.textContent = price ? 'Live ' + MB.fmt.price(price, st.market.decimal_places) : '';
      }
      paintRR();
    }
    function watchMarket() {
      if (st.offTick) { st.offTick(); st.offTick = null; }
      if (st.unsub) { st.unsub(); st.unsub = null; }
      if (!st.market || !MB.ws) { return; }
      if (st.market.last_price) { MB.ws.seed(st.market.symbol, st.market.last_price, st.market.decimal_places); }
      st.offTick = MB.ws.on('tick:' + st.market.symbol, function (t) { setLive(t.price); });
      st.unsub = MB.ws.subscribe(st.market.symbol);
      var l = MB.ws.last(st.market.symbol);
      setLive(l ? l.price : st.market.last_price || null);
    }
    function onMarket(m, prefill) {
      st.market = m;
      if (!m) { setLive(null); return; }
      var step = Math.pow(10, -(m.decimal_places || 0));
      ['Entry', 'SL', 'TP1', 'TP2', 'TP3', 'TP4', 'TP5'].forEach(function (k) { var el = $(k); if (el) { el.step = String(step); } });
      if ($('MktName')) {
        $('MktName').textContent = m.short_name + (m.category ? ' · ' + MB.catLabel(m.category) : '');
        $('MktOnly').textContent = m.short_name;
      }
      if ($('MktHint')) {
        $('MktHint').textContent = (m.name || m.short_name) + (m.category ? ' · ' + MB.catLabel(m.category) : '');
      }
      watchMarket();
      if (prefill && st.live && !$('Entry').value) { $('Entry').value = Number(st.live).toFixed(m.decimal_places); }
      paintKind();
      clearErr('market');
    }

    if (lockedMarket) {
      onMarket(lockedMarket, true);
      /* enrich from the catalogue (category, contract kinds) without unlocking */
      markets().then(function (rows) {
        var full = rows.filter(function (x) { return x.symbol === lockedMarket.symbol; })[0];
        if (full) {
          var nm = normMarket(full);
          if (!lockedMarket.last_price) { nm.last_price = full.stats.last_price; }
          onMarket(nm, true);
        }
      });
    } else {
      var catSel = $('Cat'), mktSel = $('Mkt');
      var all = [];
      var fill = function () {
        var cat = catSel.value;
        var rows = all.filter(function (m) { return cat === 'all' || m.category === cat; });
        mktSel.innerHTML = '<option value="">Choose market…</option>' + rows.map(function (m) {
          return '<option value="' + MB.esc(m.symbol) + '">' + MB.esc(m.short_name) + '</option>';
        }).join('');
      };
      markets().then(function (rows) {
        all = rows.filter(function (m) { return m.is_active !== false; });
        fill();
        var want = new URLSearchParams(global.location.search).get('symbol');
        if (want && all.some(function (m) { return m.symbol === want; })) {
          mktSel.value = want; mktSel.dispatchEvent(new Event('change'));
        }
      });
      catSel.addEventListener('change', function () { fill(); onMarket(null); });
      mktSel.addEventListener('change', function () {
        var m = all.filter(function (x) { return x.symbol === mktSel.value; })[0];
        $('Entry').value = '';
        onMarket(m ? normMarket(m) : null, true);
      });
    }

    /* ---- executable / analysis (compose page only) --------------------- */
    if (o.allowExecutable) {
      MB.api.list('capabilities').then(function (c) { st.caps = c || []; paintKind(); }, function () {});
      $('Kind').addEventListener('mb:change', function (e) { st.kind = e.detail.value; paintKind(); });
    }
    function nativeCaps() {
      if (!st.market) { return []; }
      return st.caps.filter(function (c) {
        return c.execution_mode === 'native' && c.is_enabled && (c.markets || []).indexOf(st.market.symbol) > -1;
      });
    }
    function paintKind() {
      if (!o.allowExecutable) { return; }
      var caps = nativeCaps();
      $('KindWrap').classList.toggle('hide', !caps.length);
      if (!caps.length && st.kind === 'executable') {
        st.kind = 'analysis';
        MB.$$('button', $('Kind')).forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-value') === 'analysis'); });
      }
      var sel = $('Contract');
      sel.classList.toggle('hide', st.kind !== 'executable');
      sel.innerHTML = caps.map(function (c) { return '<option value="' + MB.esc(c.id) + '">' + MB.esc(c.label) + '</option>'; }).join('');
    }

    /* ---- direction, tags, extra TPs, counter --------------------------- */
    $('Dir').addEventListener('click', function (e) {
      var b = e.target.closest('.dir-btn'); if (!b) { return; }
      MB.$$('.dir-btn', this).forEach(function (x) {
        x.classList.toggle('is-active', x === b);
        x.setAttribute('aria-checked', x === b ? 'true' : 'false');
      });
      st.dir = b.getAttribute('data-dir');
      paintRR();
    });
    $('Tags').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) { return; }
      var t = b.getAttribute('data-tag');
      var on = b.classList.toggle('is-active');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.innerHTML = (on ? MB.icon('check', 13) : '') + MB.esc(t);
      st.tags = on ? st.tags.concat([t]) : st.tags.filter(function (x) { return x !== t; });
      clearErr('tags');
    });
    $('AddTP').addEventListener('click', function () {
      if (st.tpRows >= 5) { return; }
      st.tpRows++;
      var row = host.querySelector('[data-tprow="' + st.tpRows + '"]');
      if (row) { row.classList.remove('hide'); $('TP' + st.tpRows).focus(); }
      if (st.tpRows >= 5) { this.classList.add('hide'); }
      else { this.innerHTML = MB.icon('plus', 14) + ' Add TP' + (st.tpRows + 1); }
    });
    $('Body').addEventListener('input', function () {
      var n = this.value.length;
      $('Count').textContent = n + '/500';
      $('Count').classList.toggle('is-over', n > 500);
      clearErr('analysis');
    });
    ['Entry', 'SL', 'TP1', 'TP2', 'TP3', 'TP4', 'TP5'].forEach(function (k) {
      $(k).addEventListener('input', function () {
        clearErr(k === 'SL' ? 'sl' : k.toLowerCase());
        paintRR();
      });
    });

    /* ---- chart upload --------------------------------------------------- */
    var dropKey = '#' + p + 'Drop';
    var localChart = [];
    if (MB.uploads) {
      MB.uploads.attach({ drop: dropKey, input: '#' + p + 'File', previews: '#' + p + 'Prev', accept: 'image' });
      $('File').addEventListener('change', function () { setTimeout(function () { clearErr('chart'); }, 0); });
      $('Drop').addEventListener('drop', function () { setTimeout(function () { clearErr('chart'); }, 0); });
    } else {
      $('Drop').querySelector('.sc-drop').addEventListener('click', function () { $('File').click(); });
      $('File').addEventListener('change', function () {
        localChart = Array.prototype.map.call(this.files, function (f) {
          return { type: 'image', name: f.name, url: URL.createObjectURL(f) };
        });
        $('Prev').innerHTML = localChart.map(function (f) {
          return '<div class="cp-item"><img src="' + f.url + '" alt="' + MB.esc(f.name) + '"></div>';
        }).join('');
        clearErr('chart');
      });
    }
    function chartList() { return MB.uploads ? MB.uploads.list(dropKey) : localChart; }

    /* ---- live reward/risk hint ----------------------------------------- */
    function paintRR() {
      var el = $('RR'); if (!el) { return; }
      var e = Number($('Entry').value), sl = Number($('SL').value), tp = Number($('TP1').value);
      if (!(e > 0 && sl > 0 && tp > 0) || e === sl || !st.market) { el.textContent = ''; return; }
      var rr = Math.abs(tp - e) / Math.abs(e - sl);
      var tr = T();
      var mk = { symbol: st.market.symbol, category: st.market.category, pair: st.market.pair };
      var pts = tr && MB.card && MB.card.sx ? ' · TP1 ' + MB.card.sx.fmtPts(tr.move(mk, st.dir, e, tp), tr.unit(mk).unit) : '';
      el.textContent = 'R/R 1:' + rr.toFixed(2) + pts;
    }

    /* ---- errors -------------------------------------------------------- */
    function clearErr(k) {
      var e = host.querySelector('[data-err="' + k + '"]');
      if (e) { e.textContent = ''; }
      var inp = FIELD_INPUT[k] ? $(FIELD_INPUT[k]) : null;
      if (inp) { inp.classList.remove('is-error'); inp.removeAttribute('aria-invalid'); }
      if (k === 'chart') { $('Drop').querySelector('.sc-drop').classList.remove('is-error'); }
      $('FormErr').textContent = '';
    }
    function showErrors(errs) {
      Object.keys(FIELD_INPUT).concat(['tags', 'chart']).forEach(clearErr);
      var first = null;
      Object.keys(errs || {}).forEach(function (k) {
        var slot = host.querySelector('[data-err="' + k + '"]');
        if (slot) { slot.textContent = errs[k]; }
        var inp = FIELD_INPUT[k] ? $(FIELD_INPUT[k]) : null;
        if (inp) { inp.classList.add('is-error'); inp.setAttribute('aria-invalid', 'true'); }
        if (k === 'chart') { $('Drop').querySelector('.sc-drop').classList.add('is-error'); }
        if (/^tp[3-5]$/.test(k)) {
          var row = host.querySelector('[data-tprow="' + k.slice(2) + '"]');
          if (row) { row.classList.remove('hide'); }
        }
        if (!first && (slot || inp)) { first = inp || slot; }
      });
      if (first && first.scrollIntoView) { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }

    /* ---- draft + publish ----------------------------------------------- */
    function draft() {
      var m = st.market || {};
      var tps = [];
      for (var i = 1; i <= 5; i++) { tps.push($('TP' + i).value); }
      var d = {
        symbol: m.symbol, pair: m.short_name, pair_code: m.pair || null, category: m.category || null,
        dp: m.decimal_places, seed_price: m.last_price || st.live,
        direction: st.dir, entry: $('Entry').value, sl: $('SL').value,
        tp1: tps[0], tp2: tps[1], tp3: tps[2], tp4: tps[3], tp5: tps[4],
        timeframe: $('TF').value, tags: st.tags.slice(), chart: chartList(),
        analysis: $('Body').value.trim(), kind: st.kind
      };
      if (st.kind === 'executable' && $('Contract')) { d.capability_id = $('Contract').value; }
      if (room) {
        d.room_id = room.id; d.room_name = room.name; d.room_tier = room.tier;
        d.msg_id = 'msg_' + Date.now().toString(36);
      }
      return d;
    }

    function publish() {
      var tr = T();
      if (!tr || st.busy) { return Promise.resolve({ ok: false }); }
      var d = draft();
      var pre = tr.check(d, st.live, { full: true });
      if (!pre.ok) {
        showErrors(pre.errors);
        $('FormErr').textContent = 'Check the highlighted fields — ' + pre.first;
        return Promise.resolve({ ok: false, errors: pre.errors });
      }
      st.busy = true;
      var btn = $('Publish');
      btn.disabled = true;
      btn.innerHTML = 'Publishing…';
      return tr.publish(d).then(function (r) {
        st.busy = false;
        btn.innerHTML = MB.icon('send', 18) + ' Publish Signal';
        btn.disabled = false;
        if (!r.ok) {
          if (r.errors) { showErrors(r.errors); }
          if (r.privileges) { paintGate(); }
          $('FormErr').textContent = r.error || 'The signal could not be published';
          return r;
        }
        MB.toast('Signal published and locked' + (r.sig.status === 'active' ? ' — entry hit, now monitoring' : ' — waiting for entry'));
        if (o.onPublished) { o.onPublished(r.sig); }
        return r;
      });
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); publish(); });

    return {
      el: form,
      publish: publish,
      draft: draft,
      destroy: function () {
        if (st.offTick) { st.offTick(); }
        if (st.unsub) { st.unsub(); }
        if (offKx) { offKx(); }
        if (MB.uploads) { MB.uploads.clear(dropKey); }
      }
    };
  }

  /* ======================================================================
     BOTTOM SHEET — rooms call this instead of keeping their own form
     ====================================================================== */
  function open(opts) {
    var o = opts || {};
    var ctl = null;
    var published = false;
    var m = MB.modal({
      title: 'Post New Signal',
      sub: o.market ? 'Locked to this room\'s market' : 'Entry, stop loss and targets lock on publish',
      wide: true,
      body: '<div class="sc-host"></div>',
      onOpen: function (root, handle) {
        root.classList.add('sc-sheet');
        ctl = render(root.querySelector('.sc-host'), {
          market: o.market, room: o.room, allowExecutable: false,
          onPublished: function (sig) {
            published = true;
            handle.close();
            if (o.onPublished) { o.onPublished(sig); }
          }
        });
      },
      onClose: function () {
        if (ctl) { ctl.destroy(); }
        if (!published && o.onCancel) { o.onCancel(); }
      }
    });
    return { close: m.close, controller: function () { return ctl; } };
  }

  MB.signalComposer = { render: render, open: open, TAGS: TAGS, TIMEFRAMES: TIMEFRAMES };
})(window);
