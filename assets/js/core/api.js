/* ==========================================================================
   KonfluenX — API CLIENT

   STAGE 1 (now):   BASE = '/mock'    — static JSON fixtures
   STAGE 2 (later): BASE = '/api/v1'  — Laravel routes

   The mock payloads in /mock are written in the EXACT shape the Laravel
   JsonResources will return, so flipping BASE below is the only edit
   required to move this prototype onto the real backend.
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  /* ----------------------------------------------------------------------
     THE ONE LINE THAT CHANGES AT PORT TIME
     ---------------------------------------------------------------------- */
  var STAGE = 'mock';                    // 'mock' | 'live'
  var BASE  = { mock: 'mock', live: 'api/v1' }[STAGE];
  var EXT   = STAGE === 'mock' ? '.json' : '';

  /* Mock mode can only do GET. Writes are simulated so the UI can be
     driven end to end without a backend — each returns what the real
     endpoint would return. */
  var WRITE_SIMULATED = STAGE === 'mock';

  function endpoint(path) {
    var clean = String(path).replace(/^\//, '').split('?')[0];
    return MB.url(BASE + '/' + clean + EXT);
  }

  function request(method, path, body) {
    if (method !== 'GET' && WRITE_SIMULATED) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve({ ok: true, simulated: true, echo: body || null });
        }, 260);
      });
    }
    var opts = {
      method: method,
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
      var csrf = document.querySelector('meta[name="csrf-token"]');
      if (csrf) { opts.headers['X-CSRF-TOKEN'] = csrf.content; }
    }
    return fetch(endpoint(path), opts).then(function (r) {
      if (!r.ok) {
        var err = new Error('HTTP ' + r.status);
        err.status = r.status;
        throw err;
      }
      return r.json();
    });
  }

  MB.api = {
    stage: STAGE,
    get:   function (p)    { return request('GET', p); },
    post:  function (p, b) { return request('POST', p, b || {}); },
    patch: function (p, b) { return request('PATCH', p, b || {}); },
    del:   function (p)    { return request('DELETE', p); },

    /* Convenience: unwrap { data: [...] } collections. */
    list: function (p) {
      return request('GET', p).then(function (r) {
        return (r && r.data) ? r.data : (Array.isArray(r) ? r : []);
      });
    }
  };

  /* ======================================================================
     RENDER HELPER
     Loads a fixture, renders each item through a template function,
     and handles the three states every list must have: skeleton,
     empty, error.
     ====================================================================== */
  MB.render = function (opts) {
    var host = typeof opts.into === 'string' ? MB.$(opts.into) : opts.into;
    if (!host) { return Promise.resolve([]); }

    if (opts.skeleton !== false) {
      var n = opts.skeletonCount || 3;
      var sk = '';
      for (var i = 0; i < n; i++) {
        sk += '<div class="card"><div class="skeleton sk-line w40"></div>' +
              '<div class="skeleton sk-line w80"></div>' +
              '<div class="skeleton sk-line w60"></div></div>';
      }
      host.innerHTML = sk;
    }

    return MB.api.list(opts.from).then(function (items) {
      var rows = items;
      if (opts.filter) { rows = rows.filter(opts.filter); }
      if (opts.limit)  { rows = rows.slice(0, opts.limit); }

      if (!rows.length) {
        host.innerHTML =
          '<div class="empty">' + MB.icon(opts.emptyIcon || 'search', 46) +
          '<h3>' + MB.esc(opts.emptyTitle || 'Nothing here yet') + '</h3>' +
          '<p>' + MB.esc(opts.emptyText || 'Check back shortly.') + '</p></div>';
        return rows;
      }

      host.innerHTML = rows.map(opts.template).join('');
      MB.mountIcons(host);
      if (MB.mountCharts) { MB.mountCharts(host); }
      if (opts.done) { opts.done(rows, host); }
      return rows;
    }).catch(function (err) {
      host.innerHTML =
        '<div class="empty">' + MB.icon('warning', 46) +
        '<h3>Could not load</h3><p>' +
        (MB.api.stage === 'mock'
          ? 'Serve this folder over HTTP so the mock data can load. Opening the file directly blocks fetch.'
          : 'Something went wrong. Pull to refresh, or try again shortly.') +
        '</p></div>';
      if (global.console) { console.warn('[MB.render]', opts.from, err); }
      return [];
    });
  };
})(window);
