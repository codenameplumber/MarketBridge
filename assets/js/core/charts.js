/* ==========================================================================
   KonfluenX — CHARTS
   Sparklines, area charts and candlesticks as inline SVG. No library.

   Two things matter for legibility, and both are handled here:
   1. Strokes are sized in viewBox units and the viewBox is chosen to match
      the rendered box, so a line is never stretched thin by the browser.
   2. Candle count adapts to the available width — a 340px chart draws far
      fewer, wider candles than a 900px one, instead of a grey smear.

   All colour comes from tokens, so every chart re-themes with the page.
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  /* Deterministic PRNG — a given seed always draws the same chart, so the
     prototype does not reshuffle on every reload. */
  function rng(seed) {
    var s = String(seed);
    var h = 1779033703 ^ s.length;
    for (var i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function series(seed, n, bias) {
    var r = rng(seed), out = [], v = 50;
    for (var i = 0; i < n; i++) {
      v += (r() - 0.5) * 12 + (bias || 0);
      v = Math.max(6, Math.min(94, v));
      out.push(v);
    }
    return out;
  }

  function pathFrom(vals, w, h, pad) {
    var p = pad === undefined ? 2 : pad;
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var span = (max - min) || 1;
    var step = (w - p * 2) / (vals.length - 1 || 1);
    return vals.map(function (v, i) {
      var x = p + i * step;
      var y = p + (h - p * 2) * (1 - (v - min) / span);
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
  }

  function uid(p) { return p + Math.random().toString(36).slice(2, 8); }

  /* ======================================================================
     SPARKLINE
     Drawn in its own coordinate space at the real pixel size, so the stroke
     lands at the weight asked for rather than being squashed by a stretch.
     ====================================================================== */
  MB.sparkline = function (opts) {
    var o = opts || {};
    var w = o.width || 120, h = o.height || 34;
    var dir = o.direction || 'up';
    var vals = o.values || series(o.seed || 'x', o.points || 24, dir === 'up' ? 1.1 : -1.1);
    var stroke = dir === 'up' ? 'var(--mb-green)' : 'var(--mb-sell)';
    var sw = o.strokeWidth || 2;
    var d = pathFrom(vals, w, h, sw);
    var id = uid('sg');
    var area = d + ' L ' + (w - sw) + ' ' + h + ' L ' + sw + ' ' + h + ' Z';

    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" ' +
           'preserveAspectRatio="none" width="100%" height="' + h + '" ' +
           'aria-hidden="true" vector-effect="non-scaling-stroke">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + stroke + '" stop-opacity=".30"/>' +
        '<stop offset="100%" stop-color="' + stroke + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      (o.fill === false ? '' : '<path d="' + area + '" fill="url(#' + id + ')"/>') +
      /* non-scaling-stroke keeps the line crisp however the box is stretched */
      '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" ' +
        'stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
    '</svg>';
  };

  /* ======================================================================
     AREA CHART
     ====================================================================== */
  MB.areaChart = function (opts) {
    var o = opts || {};
    var w = o.width || 360, h = o.height || 150;
    var vals = o.values || series(o.seed || 'pl', o.points || 20, 1.4);
    var stroke = o.color || 'var(--mb-green)';
    var pad = 8;
    var d = pathFrom(vals, w, h, pad);
    var id = uid('ag');
    var area = d + ' L ' + (w - pad) + ' ' + (h - pad) + ' L ' + pad + ' ' + (h - pad) + ' Z';

    var grid = '';
    for (var g = 1; g < 4; g++) {
      var gy = (h / 4) * g;
      grid += '<line x1="' + pad + '" y1="' + gy + '" x2="' + (w - pad) + '" y2="' + gy +
              '" stroke="var(--mb-border)" stroke-width="1" stroke-dasharray="3 5" ' +
              'vector-effect="non-scaling-stroke"/>';
    }

    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var span = (max - min) || 1;
    var lx = w - pad;
    var ly = pad + (h - pad * 2) * (1 - (vals[vals.length - 1] - min) / span);

    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" ' +
           'preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + stroke + '" stop-opacity=".32"/>' +
        '<stop offset="100%" stop-color="' + stroke + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' + grid +
      '<path d="' + area + '" fill="url(#' + id + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="2.4" ' +
        'stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="4" fill="' + stroke + '"/>' +
      '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="8" fill="' + stroke +
        '" opacity=".22"/>' +
    '</svg>';
  };

  /* ======================================================================
     CANDLESTICK
     Candle count follows the pixel width, so bodies stay wide enough to read.
     ====================================================================== */
  MB.candleChart = function (opts) {
    var o = opts || {};
    var w = o.width || 360, h = o.height || 170;

    /* ~13px per candle keeps bodies readable; never fewer than 12. */
    var padR = o.axis ? 64 : 8;
    var usable = w - 16 - padR;
    var n = o.candles || Math.max(12, Math.min(46, Math.round(usable / 13)));

    var r = rng(o.seed || 'c');
    var bias = o.direction === 'down' ? -0.9 : 0.9;

    var v = 50, bars = [];
    for (var i = 0; i < n; i++) {
      var open = v;
      var close = Math.max(8, Math.min(92, open + (r() - 0.5) * 9 + bias));
      bars.push({ o: open, c: close, h: Math.max(open, close) + r() * 4.5,
                  l: Math.min(open, close) - r() * 4.5 });
      v = close;
    }

    var all = bars.reduce(function (a, b) { return a.concat([b.h, b.l]); }, []);
    var min = Math.min.apply(null, all), max = Math.max.apply(null, all);
    var span = (max - min) || 1;
    var padT = 10, padB = 10;
    var cw = usable / n;
    var bw = Math.max(3, cw * 0.62);
    var wick = Math.max(1.2, bw * 0.16);
    var y = function (val) { return padT + (h - padT - padB) * (1 - (val - min) / span); };

    var svg = '';

    /* faint grid, so the candles have something to sit against */
    for (var g = 1; g < 4; g++) {
      var gy = padT + ((h - padT - padB) / 4) * g;
      svg += '<line x1="8" y1="' + gy.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + gy.toFixed(1) +
             '" stroke="var(--mb-border)" stroke-width="1" stroke-dasharray="2 6" opacity=".7"/>';
    }

    bars.forEach(function (b, i) {
      var x = 8 + i * cw + cw / 2;
      var up = b.c >= b.o;
      var col = up ? 'var(--mb-green)' : 'var(--mb-sell)';
      var top = y(Math.max(b.o, b.c));
      var bot = y(Math.min(b.o, b.c));
      svg += '<line x1="' + x.toFixed(1) + '" y1="' + y(b.h).toFixed(1) +
             '" x2="' + x.toFixed(1) + '" y2="' + y(b.l).toFixed(1) +
             '" stroke="' + col + '" stroke-width="' + wick.toFixed(1) + '" stroke-linecap="round"/>' +
             '<rect x="' + (x - bw / 2).toFixed(1) + '" y="' + top.toFixed(1) +
             '" width="' + bw.toFixed(1) + '" height="' + Math.max(1.6, bot - top).toFixed(1) +
             '" fill="' + col + '" rx="' + Math.min(1.5, bw / 5).toFixed(1) + '"/>';
    });

    /* last close marker */
    var lastX = 8 + (n - 1) * cw + cw / 2;
    var lastY = y(bars[n - 1].c);
    svg += '<line x1="8" y1="' + lastY.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + lastY.toFixed(1) +
           '" stroke="var(--mb-text-3)" stroke-width="1" stroke-dasharray="3 4" opacity=".6"/>' +
           '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="3" fill="var(--mb-text)"/>';

    /* optional entry / SL / TP overlay for signal charts */
    if (o.levels) {
      var order = ['tp2', 'tp1', 'entry', 'sl'];
      var colours = { entry: 'var(--mb-text-2)', sl: 'var(--mb-sell)',
                      tp1: 'var(--mb-green)', tp2: 'var(--mb-green)' };
      var slots = { tp2: 0.14, tp1: 0.32, entry: 0.55, sl: 0.82 };
      order.forEach(function (k) {
        if (!o.levels[k]) { return; }
        var ly2 = padT + (h - padT - padB) * slots[k];
        svg += '<line x1="8" y1="' + ly2.toFixed(1) + '" x2="' + (w - padR - 24) +
               '" y2="' + ly2.toFixed(1) + '" stroke="' + colours[k] +
               '" stroke-width="1.4" stroke-dasharray="5 4" opacity=".9"/>' +
               '<rect x="' + (w - padR - 22) + '" y="' + (ly2 - 7).toFixed(1) +
               '" width="26" height="14" rx="3" fill="' + colours[k] + '" opacity=".18"/>' +
               '<text x="' + (w - padR - 9) + '" y="' + (ly2 + 3.6).toFixed(1) +
               '" font-size="8.5" font-weight="700" text-anchor="middle" fill="' + colours[k] + '">' +
               k.toUpperCase() + '</text>';
      });
    }

    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" ' +
           'preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + svg + '</svg>';
  };

  /* ======================================================================
     MINI HEATMAP — used as marketing art and on market overviews
     ====================================================================== */
  MB.heatGrid = function (opts) {
    var o = opts || {};
    var cols = o.cols || 12, rows = o.rows || 6;
    var r = rng(o.seed || 'heat');
    var cell = 100 / cols, out = '';
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var v = r();
        var up = v > 0.46;
        var alpha = (0.12 + Math.abs(v - 0.5) * 1.5).toFixed(2);
        out += '<rect x="' + (x * cell + 0.6).toFixed(2) + '" y="' + (y * cell + 0.6).toFixed(2) +
               '" width="' + (cell - 1.2).toFixed(2) + '" height="' + (cell - 1.2).toFixed(2) +
               '" rx="1.2" fill="var(--mb-' + (up ? 'green' : 'sell') + ')" opacity="' + alpha + '"/>';
      }
    }
    return '<svg viewBox="0 0 100 ' + (rows * cell).toFixed(2) + '" width="100%" ' +
           'preserveAspectRatio="none" aria-hidden="true" style="display:block">' + out + '</svg>';
  };

  /* ======================================================================
     DECLARATIVE MOUNTING
     Charts re-render on resize so the candle count always matches the width.
     ====================================================================== */
  function renderChartEl(el) {
    var kind = el.getAttribute('data-chart');
    var seed = el.getAttribute('data-seed') || 'seed';
    var dir = el.getAttribute('data-direction') || 'up';
    var box = el.getBoundingClientRect();
    var w = Math.max(240, Math.round(box.width || el.offsetWidth || 360));

    var h = Number(el.getAttribute('data-h')) || (kind === 'candle' ? 170 : 150);
    /* shorter charts on narrow screens, so they never dominate the view */
    var hMin = Number(el.getAttribute('data-h-min') || 0);
    if (hMin && w < 420) { h = hMin; }

    if (kind === 'candle') {
      var lv = el.getAttribute('data-levels');
      el.innerHTML = MB.candleChart({
        seed: seed, width: w, height: h, direction: dir,
        axis: el.hasAttribute('data-axis'),
        levels: lv ? JSON.parse(lv) : null
      });
    } else if (kind === 'heat') {
      el.innerHTML = MB.heatGrid({ seed: seed, cols: Number(el.getAttribute('data-cols')) || 12,
                                   rows: Number(el.getAttribute('data-rows')) || 6 });
    } else {
      el.innerHTML = MB.areaChart({
        seed: seed, width: w, height: h,
        color: dir === 'down' ? 'var(--mb-sell)' : 'var(--mb-green)'
      });
    }
  }

  MB.mountCharts = function (root) {
    var scope = root || document;

    MB.$$('[data-spark]:not([data-chart-done])', scope).forEach(function (el) {
      el.setAttribute('data-chart-done', '1');
      var wrap = document.createElement('span');
      wrap.style.display = 'block';
      wrap.className = el.className;
      wrap.style.cssText += el.getAttribute('style') || '';
      wrap.innerHTML = MB.sparkline({
        direction: el.getAttribute('data-spark') || 'up',
        seed: el.getAttribute('data-seed') || Math.random(),
        height: Number(el.getAttribute('data-h')) || 34,
        strokeWidth: Number(el.getAttribute('data-sw')) || 2,
        fill: el.getAttribute('data-fill') !== 'false'
      });
      el.replaceWith(wrap.firstChild);
    });

    MB.$$('[data-chart]:not([data-chart-done])', scope).forEach(function (el) {
      el.setAttribute('data-chart-done', '1');
      renderChartEl(el);
    });
  };

  /* Redraw on resize (debounced) so candle density tracks the viewport. */
  var rt;
  global.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      MB.$$('[data-chart][data-chart-done]').forEach(renderChartEl);
    }, 220);
  });
})(window);
