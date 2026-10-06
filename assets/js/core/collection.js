/* ==========================================================================
   KonfluenX — COLLECTION
   One controller for every filtered, paginated list in the customer app.

   Ports to Laravel as a Livewire component using WithPagination: the filter
   object becomes public properties, `page` becomes the paginator, and the
   template becomes the Blade partial rendered inside the loop.

     var c = MB.collection({
       from: 'signals',
       into: '#feed',
       template: MB.card.signal,
       perPage: 8,
       mode: 'pages',              // 'pages' | 'more'
       filters: {                  // each returns true to keep the row
         category: function (row, v) { return v === 'all' || row.market.category === v; }
       }
     });
     c.set('category', 'forex');   // re-filters, resets to page 1
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  MB.collection = function (opts) {
    var o = opts || {};
    var host = typeof o.into === 'string' ? MB.$(o.into) : o.into;
    if (!host) { return null; }

    var all = [];
    var view = [];
    var state = Object.assign({}, o.initial || {});
    var page = 1;
    var perPage = o.perPage || 10;
    var mode = o.mode || 'pages';
    var shown = perPage;              /* used by 'more' mode */
    var pagerHost = null;
    var pagerWatch = null;
    var countHost = o.countInto ? MB.$(o.countInto) : null;

    /* ------------------------------------------------------------------ */
    function applyFilters() {
      view = all.slice();
      Object.keys(o.filters || {}).forEach(function (key) {
        var v = state[key];
        if (v === undefined || v === null || v === '') { return; }
        view = view.filter(function (row) { return o.filters[key](row, v); });
      });
      if (o.sort) { view.sort(o.sort); }
    }

    function ensurePager() {
      if (pagerHost && pagerHost.isConnected) { return pagerHost; }
      pagerHost = MB.el('div', { class: mode === 'more' ? 'load-more-wrap' : 'pager-wrap' });
      host.insertAdjacentElement('afterend', pagerHost);

      /* The pager is a SIBLING of its list, so hiding the list — a tab pane,
         say — leaves the pager on screen. Two panes then show their footers
         at once under a third tab. Mirror the host's hidden state onto it. */
      syncPagerVisibility();
      if (global.MutationObserver && !pagerWatch) {
        pagerWatch = new global.MutationObserver(syncPagerVisibility);
        pagerWatch.observe(host, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
      }
      return pagerHost;
    }

    function syncPagerVisibility() {
      if (!pagerHost) { return; }
      var hidden = host.classList.contains('hide') || host.hidden ||
                   host.style.display === 'none';
      pagerHost.classList.toggle('hide', hidden);
    }

    function renderPager() {
      var p = ensurePager();
      var total = view.length;

      if (mode === 'more') {
        if (shown >= total) {
          /* Only worth saying once the list was actually longer than a page —
             "4 of 4 shown" under four rows is noise. */
          p.innerHTML = total > perPage
            ? '<div class="list-end">' + total + ' of ' + total + ' shown</div>' : '';
          return;
        }
        p.innerHTML =
          '<button class="btn btn-ghost btn-block" data-more>' +
            MB.icon('refresh', 17) + ' Load more <span class="c-3">(' +
            (total - shown) + ' more)</span></button>';
        MB.$('[data-more]', p).addEventListener('click', function () {
          shown += perPage;
          render();
        });
        return;
      }

      var pages = Math.max(1, Math.ceil(total / perPage));
      if (pages <= 1) {
        p.innerHTML = total ? '<div class="list-end">' + total + ' result' + (total === 1 ? '' : 's') + '</div>' : '';
        return;
      }

      var from = (page - 1) * perPage + 1;
      var to = Math.min(total, page * perPage);
      p.innerHTML =
        '<div class="pager">' +
          '<button class="pg-nav" data-pg="prev"' + (page === 1 ? ' disabled' : '') +
            ' aria-label="Previous page">' + MB.icon('chevleft', 16) + '</button>' +
          pageButtons(page, pages) +
          '<button class="pg-nav" data-pg="next"' + (page === pages ? ' disabled' : '') +
            ' aria-label="Next page">' + MB.icon('chevright', 16) + '</button>' +
        '</div>' +
        '<div class="pager-count">Showing ' + from + '&ndash;' + to + ' of ' + total + '</div>';

      MB.$$('[data-pg]', p).forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.getAttribute('data-pg');
          if (v === 'prev') { page = Math.max(1, page - 1); }
          else if (v === 'next') { page = Math.min(pages, page + 1); }
          else { page = Number(v); }
          render(true);
        });
      });
    }

    /* Compact window: 1 … 4 [5] 6 … 20 */
    function pageButtons(cur, total) {
      var out = [], i;
      var add = function (n) {
        out.push('<button class="pg-num' + (n === cur ? ' is-active' : '') +
          '" data-pg="' + n + '"' + (n === cur ? ' aria-current="page"' : '') + '>' + n + '</button>');
      };
      var gap = '<span class="pg-gap">&hellip;</span>';

      if (total <= 7) { for (i = 1; i <= total; i++) { add(i); } return out.join(''); }
      add(1);
      if (cur > 3) { out.push(gap); }
      for (i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) { add(i); }
      if (cur < total - 2) { out.push(gap); }
      add(total);
      return out.join('');
    }

    /* ------------------------------------------------------------------ */
    function render(scroll) {
      applyFilters();

      var rows = mode === 'more'
        ? view.slice(0, shown)
        : view.slice((page - 1) * perPage, page * perPage);

      if (countHost) {
        countHost.textContent = view.length;
      }

      if (!view.length) {
        host.innerHTML =
          '<div class="empty">' + MB.icon(o.emptyIcon || 'search', 46) +
          '<h3>' + MB.esc(o.emptyTitle || 'Nothing found') + '</h3>' +
          '<p>' + MB.esc(o.emptyText || 'Try a different filter.') + '</p></div>';
        MB.mountIcons(host);
      if (MB.applyPermissions) { MB.applyPermissions(host); }
        renderPager();
        /* done() reports every render, empty included, so headers that
           summarise the filtered set do not go stale. */
        if (o.done) { o.done([], view, host); }
        return;
      }

      host.innerHTML = rows.map(o.template).join('');
      MB.mountIcons(host);
      if (MB.applyPermissions) { MB.applyPermissions(host); }
      if (MB.mountCharts) { MB.mountCharts(host); }
      if (MB.mountTicks) { MB.mountTicks(host); }
      renderPager();
      if (o.done) { o.done(rows, view, host); }

      if (scroll && host.getBoundingClientRect().top < 0) {
        host.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    /* ------------------------------------------------------------------ */
    var api = {
      set: function (key, value) {
        state[key] = value;
        page = 1;
        shown = perPage;
        render();
        return api;
      },
      get: function (key) { return state[key]; },
      state: function () { return Object.assign({}, state); },
      rows: function () { return view.slice(); },
      all: function () { return all.slice(); },
      refresh: function () { render(); return api; },
      /** Swap the underlying rows, keeping filters and resetting to page 1. */
      replace: function (rows) {
        all = rows || [];
        if (o.prepare) { all = o.prepare(all); }
        page = 1;
        shown = perPage;
        render();
        return api;
      },
      /* Bind a [data-group] chip/tab row straight to a filter key */
      bind: function (selector, key) {
        var el = typeof selector === 'string' ? MB.$(selector) : selector;
        if (el) {
          el.addEventListener('mb:change', function (e) { api.set(key, e.detail.value); });
        }
        return api;
      },
      /* Bind a text input to a filter key, debounced */
      bindInput: function (selector, key) {
        var el = typeof selector === 'string' ? MB.$(selector) : selector;
        if (el) {
          var t;
          el.addEventListener('input', function () {
            clearTimeout(t);
            t = setTimeout(function () { api.set(key, el.value.trim().toLowerCase()); }, 180);
          });
        }
        return api;
      },
      /* Bind a <select> to a filter key */
      bindSelect: function (selector, key) {
        var el = typeof selector === 'string' ? MB.$(selector) : selector;
        if (el) { el.addEventListener('change', function () { api.set(key, el.value); }); }
        return api;
      }
    };

    /* skeleton while the fixture loads */
    var sk = '';
    for (var i = 0; i < (o.skeletonCount || 3); i++) {
      sk += '<div class="card"><div class="skeleton sk-line w40"></div>' +
            '<div class="skeleton sk-line w80"></div><div class="skeleton sk-line w60"></div></div>';
    }
    if (o.skeleton !== false) { host.innerHTML = sk; }

    (o.data ? Promise.resolve(o.data) : MB.api.list(o.from)).then(function (rows) {
      all = rows || [];
      if (o.prepare) { all = o.prepare(all); }
      render();
      if (o.ready) { o.ready(api); }
    }).catch(function (err) {
      host.innerHTML =
        '<div class="empty">' + MB.icon('warning', 46) +
        '<h3>Could not load</h3><p>' +
        (MB.api.stage === 'mock'
          ? 'Serve this folder over HTTP so the mock data can load.'
          : 'Something went wrong. Try again shortly.') + '</p></div>';
      MB.mountIcons(host);
      if (MB.applyPermissions) { MB.applyPermissions(host); }
      if (global.console) { console.warn('[MB.collection]', o.from, err); }
    });

    return api;
  };
})(window);
