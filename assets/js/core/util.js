/* ==========================================================================
   KonfluenX — UTILITIES
   theme · formatting · dom helpers · toasts · tiny store
   Ports to Laravel as: theme stays client-side, format becomes Blade
   helpers / Carbon, store is absorbed by Livewire public properties.
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  /* ======================================================================
     PATH — resolves asset and page URLs from any folder depth.
     Every page sets <body data-root="../"> (or "" at the site root).
     ====================================================================== */
  MB.root = function () {
    var b = document.body;
    return (b && b.getAttribute('data-root')) || '';
  };
  MB.url = function (path) {
    return MB.root() + String(path).replace(/^\//, '');
  };

  /* ======================================================================
     THEME
     Dark is the default ground: with nothing stored we render dark, whatever
     the OS prefers. A stored choice always wins, and 'system' is available as
     an explicit opt-in from Settings.
     ====================================================================== */
  var THEME_KEY = 'mb.theme';

  /* ?theme=dark|light|system overrides for one page load — used for QA,
     screenshots and sharing a link in a specific theme. Not persisted. */
  var urlTheme = (function () {
    var m = /[?&]theme=(dark|light|system)\b/.exec(location.search);
    return m ? m[1] : null;
  })();

  MB.theme = {
    get: function () {
      if (urlTheme) { return urlTheme; }
      try { return localStorage.getItem(THEME_KEY) || 'dark'; }
      catch (e) { return 'dark'; }
    },
    set: function (mode) {
      try {
        /* 'system' is a real stored choice now, because the unstored
           default is dark rather than "follow the OS". */
        localStorage.setItem(THEME_KEY, mode);
      } catch (e) { /* private mode — apply for this page only */ }
      MB.theme.apply();
    },
    /** Resolves 'system' to the OS preference. */
    resolved: function () {
      var m = MB.theme.get();
      if (m !== 'system') { return m; }
      return global.matchMedia && global.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light' : 'dark';
    },
    apply: function () {
      var m = MB.theme.get();
      var el = document.documentElement;
      if (m === 'system') { el.removeAttribute('data-theme'); }
      else { el.setAttribute('data-theme', m); }
      document.dispatchEvent(new CustomEvent('mb:theme', { detail: { mode: m } }));
    },
    toggle: function () {
      MB.theme.set(MB.theme.resolved() === 'dark' ? 'light' : 'dark');
    }
  };
  /* Applied immediately — before first paint where the script is in <head>. */
  MB.theme.apply();

  /* ======================================================================
     FORMAT
     ====================================================================== */
  /* Groups the integer part only. Applying the separator to the whole
     string turns a 5-decimal forex price into nonsense. */
  function group(str) {
    var parts = String(str).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  MB.fmt = {
    /** 2450.8 -> "$2,450.80" */
    money: function (n, cur, dp) {
      var d = (dp === undefined) ? 2 : dp;
      var v = Number(n || 0);
      var s = group(Math.abs(v).toFixed(d));
      var sym = cur === 'USD' || !cur ? '$' : '';
      return (v < 0 ? '-' : '') + sym + s + (sym ? '' : ' ' + cur);
    },
    /** Signed money, for P/L. 220.5 -> "+$220.50" */
    signed: function (n, cur) {
      var v = Number(n || 0);
      return (v >= 0 ? '+' : '') + MB.fmt.money(v, cur);
    },
    /** Price with market-appropriate precision. */
    price: function (n, dp) {
      var d = (dp === undefined) ? 2 : dp;
      return group(Number(n || 0).toFixed(d));
    },
    /** 1.28 -> "+1.28%" */
    pct: function (n, dp) {
      var d = (dp === undefined) ? 2 : dp;
      var v = Number(n || 0);
      return (v >= 0 ? '+' : '') + v.toFixed(d) + '%';
    },
    /** 1200 -> "1.2K" */
    compact: function (n) {
      var v = Number(n || 0);
      if (v >= 1e9) { return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'; }
      if (v >= 1e6) { return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; }
      if (v >= 1e3) { return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'; }
      return String(v);
    },
    /** ISO -> "3m ago" */
    ago: function (iso) {
      var t = new Date(iso).getTime();
      if (isNaN(t)) { return ''; }
      var s = Math.floor((Date.now() - t) / 1000);
      if (s < 45)     { return 'just now'; }
      if (s < 3600)   { return Math.floor(s / 60) + 'm ago'; }
      if (s < 86400)  { return Math.floor(s / 3600) + 'h ago'; }
      if (s < 604800) { return Math.floor(s / 86400) + 'd ago'; }
      return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    },
    /** ISO -> "May 24, 2026" */
    date: function (iso) {
      var d = new Date(iso);
      if (isNaN(d.getTime())) { return ''; }
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    },
    /** 2730 -> "45:30" */
    duration: function (sec) {
      var s = Number(sec || 0);
      var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
      var pad = function (x) { return x < 10 ? '0' + x : String(x); };
      return h > 0 ? h + ':' + pad(m) + ':' + pad(r) : m + ':' + pad(r);
    },
    /** Direction class helper: returns 'c-up' or 'c-down'. */
    dirClass: function (n) { return Number(n) >= 0 ? 'c-up' : 'c-down'; },
    /** Initials fallback for avatars without an image. */
    initials: function (name) {
      return String(name || '?').replace(/[^A-Za-z0-9 _]/g, '')
        .split(/[ _]+/).filter(Boolean).slice(0, 2)
        .map(function (w) { return w[0].toUpperCase(); }).join('') || '?';
    }
  };

  /* Deterministic avatar colour from a username — no image needed. */
  MB.avatarColor = function (seed) {
    var s = String(seed || ''), h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) % 360; }
    return 'hsl(' + h + ' 58% 42%)';
  };

  MB.avatar = function (user, cls) {
    var u = user || {};
    var k = cls || '';
    if (u.avatar_url) {
      return '<span class="avatar ' + k + '" style="background-image:url(' + u.avatar_url + ')" aria-hidden="true"></span>';
    }
    return '<span class="avatar ' + k + '" style="background:' + MB.avatarColor(u.username || u.name) +
           '" aria-hidden="true">' + MB.fmt.initials(u.display_name || u.username || u.name) + '</span>';
  };

  /* ======================================================================
     DOM
     ====================================================================== */
  MB.$  = function (sel, root) { return (root || document).querySelector(sel); };
  MB.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  MB.el = function (tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') { n.className = attrs[k]; }
        else { n.setAttribute(k, attrs[k]); }
      });
    }
    if (html != null) { n.innerHTML = html; }
    return n;
  };
  /** Escapes user-supplied text before it goes into innerHTML. */
  MB.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ======================================================================
     TOAST
     ====================================================================== */
  MB.toast = function (msg, kind, ms) {
    var host = MB.$('.toast-host');
    if (!host) {
      host = MB.el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(host);
    }
    var k = kind || 'ok';
    var t = MB.el('div', { class: 'toast is-' + k },
      MB.icon(k === 'err' ? 'warning' : 'check', 17) + '<span>' + MB.esc(msg) + '</span>');
    host.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s, transform .25s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      setTimeout(function () { t.remove(); }, 260);
    }, ms || 2600);
  };

  /* ======================================================================
     STORE — tiny pub/sub.
     In Laravel this role is taken over by Livewire public properties;
     ws.js keeps using it for tick fan-out, which stays client-side.
     ====================================================================== */
  MB.store = (function () {
    var state = {}, subs = {};
    return {
      get: function (k) { return state[k]; },
      set: function (k, v) {
        state[k] = v;
        (subs[k] || []).forEach(function (fn) { fn(v, k); });
      },
      on: function (k, fn) {
        (subs[k] = subs[k] || []).push(fn);
        return function off() { subs[k] = subs[k].filter(function (f) { return f !== fn; }); };
      }
    };
  })();

  /* ======================================================================
     SHEET — bottom sheet open/close
     ====================================================================== */
  MB.sheet = {
    open: function (id) {
      var s = document.getElementById(id);
      if (s) { s.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
    },
    close: function (id) {
      var s = id ? document.getElementById(id) : MB.$('.sheet-backdrop.is-open');
      if (s) { s.classList.remove('is-open'); document.body.style.overflow = ''; }
    }
  };
  /* ----------------------------------------------------------------------
     CONFIRM — a promise-returning sheet for destructive actions.
     Resolves true on confirm, false on cancel, backdrop click or Escape.
     Never use window.confirm: it cannot be styled and blocks the thread.
     ---------------------------------------------------------------------- */
  /**
   * Bind a handler to an element that may legitimately not exist — a control
   * removed by the permission pass, or a page that omits it. Returns whether
   * the binding happened, so callers can branch if they need to.
   *
   *   MB.on('#btnBoost', 'click', boost);
   */
  MB.on = function (target, event, handler) {
    var el = typeof target === 'string'
      ? (target.charAt(0) === '#' ? document.getElementById(target.slice(1)) : MB.$(target))
      : target;
    if (!el) { return false; }
    el.addEventListener(event, handler);
    return true;
  };

  /* ----------------------------------------------------------------------
     MODAL — a dialog with a body you supply and buttons you name.

     MB.confirm is the yes/no case; this is everything else: a form, a search,
     a role picker. Returns a handle so the caller can close it from inside.

       var m = MB.modal({
         title: 'Invite staff',
         sub:   'They get an email with a one-time link',
         body:  '<div class="field">…</div>',
         wide:  true,
         actions: [
           { label: 'Cancel', kind: 'ghost', close: true },
           { label: 'Send invite', kind: 'brand', onClick: function (m) { … } }
         ],
         onOpen: function (root, m) { … wire the body … }
       });
     ---------------------------------------------------------------------- */
  MB.modal = function (opts) {
    var o = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'sheet-backdrop';

    var buttons = (o.actions || []).map(function (a, i) {
      var kind = { ghost: 'btn-ghost', brand: 'btn-brand', trade: 'btn-trade',
                   sell: 'btn-sell' }[a.kind] || 'btn-ghost';
      return '<button class="btn ' + kind + ' grow" data-act="' + i + '"' +
        (a.disabled ? ' disabled' : '') + '>' + MB.esc(a.label) + '</button>';
    }).join('');

    wrap.innerHTML =
      '<div class="sheet' + (o.wide ? ' sheet-wide' : '') +
        '" role="dialog" aria-modal="true" aria-label="' + MB.esc(o.title || 'Dialog') + '">' +
        '<div class="sheet-grip"></div>' +
        '<div class="sheet-head">' +
          '<div class="grow">' +
            '<h3 class="t-h2 w-bold">' + MB.esc(o.title || '') + '</h3>' +
            (o.sub ? '<p class="t-xs c-3 mt2">' + MB.esc(o.sub) + '</p>' : '') +
          '</div>' +
          '<button class="icon-btn" data-x aria-label="Close">' + MB.icon('close', 18) + '</button>' +
        '</div>' +
        '<div class="sheet-body">' + (o.body || '') + '</div>' +
        (buttons ? '<div class="sheet-foot">' + buttons + '</div>' : '') +
      '</div>';

    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';

    var handle = {
      root: wrap,
      $: function (sel) { return wrap.querySelector(sel); },
      $$: function (sel) { return Array.prototype.slice.call(wrap.querySelectorAll(sel)); },
      close: function () {
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = '';
        wrap.classList.remove('is-open');
        setTimeout(function () { wrap.remove(); }, 220);
        if (o.onClose) { o.onClose(); }
      },
      /* Lets a form enable its submit only once it is valid. */
      setAction: function (i, patch) {
        var b = wrap.querySelector('[data-act="' + i + '"]');
        if (!b) { return; }
        if (patch.disabled !== undefined) { b.disabled = !!patch.disabled; }
        if (patch.label !== undefined) { b.textContent = patch.label; }
      }
    };

    function onKey(e) { if (e.key === 'Escape') { handle.close(); } }
    document.addEventListener('keydown', onKey);
    wrap.querySelector('[data-x]').addEventListener('click', handle.close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) { handle.close(); } });

    (o.actions || []).forEach(function (a, i) {
      var b = wrap.querySelector('[data-act="' + i + '"]');
      if (!b) { return; }
      b.addEventListener('click', function () {
        if (a.onClick) { a.onClick(handle); }
        if (a.close) { handle.close(); }
      });
    });

    MB.mountIcons(wrap);
    requestAnimationFrame(function () { wrap.classList.add('is-open'); });
    if (o.onOpen) { o.onOpen(wrap, handle); }
    return handle;
  };

  MB.confirm = function (opts) {
    var o = opts || {};
    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.className = 'sheet-backdrop';
      wrap.innerHTML =
        '<div class="sheet" role="dialog" aria-modal="true">' +
          '<div class="sheet-grip"></div>' +
          '<h3 class="t-h2 w-bold">' + MB.esc(o.title || 'Are you sure?') + '</h3>' +
          (o.body ? '<p class="t-sm c-2 mt2">' + MB.esc(o.body) + '</p>' : '') +
          '<div class="row g2 mt5">' +
            '<button class="btn btn-ghost grow" data-no>' +
              MB.esc(o.cancel || 'Cancel') + '</button>' +
            '<button class="btn ' + (o.danger ? 'btn-sell' : 'btn-trade') +
              ' grow" data-yes>' + MB.esc(o.confirm || 'Confirm') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(wrap);
      document.body.style.overflow = 'hidden';

      function done(answer) {
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = '';
        wrap.classList.remove('is-open');
        setTimeout(function () { wrap.remove(); }, 220);
        resolve(answer);
      }
      function onKey(e) { if (e.key === 'Escape') { done(false); } }

      wrap.querySelector('[data-yes]').addEventListener('click', function () { done(true); });
      wrap.querySelector('[data-no]').addEventListener('click', function () { done(false); });
      wrap.addEventListener('click', function (e) { if (e.target === wrap) { done(false); } });
      document.addEventListener('keydown', onKey);

      requestAnimationFrame(function () {
        wrap.classList.add('is-open');
        wrap.querySelector('[data-yes]').focus();
      });
    });
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sheet-open]');
    if (b) { MB.sheet.open(b.getAttribute('data-sheet-open')); return; }
    if (e.target.closest('[data-sheet-close]')) { MB.sheet.close(); return; }
    if (e.target.classList && e.target.classList.contains('sheet-backdrop')) { MB.sheet.close(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { MB.sheet.close(); }
  });

  /* ======================================================================
     GENERIC UI BEHAVIOURS — chips, tabs, password reveal
     Declarative, so pages stay markup-only.
     ====================================================================== */
  document.addEventListener('click', function (e) {
    /* Chip / tab groups: one active per [data-group] container */
    var chip = e.target.closest('.chip, .tab, .segment button');
    if (chip) {
      var group = chip.closest('[data-group]');
      if (group) {
        MB.$$('.chip, .tab, button', group).forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        group.dispatchEvent(new CustomEvent('mb:change', {
          bubbles: true,
          detail: { value: chip.getAttribute('data-value'), el: chip }
        }));
      }
    }

    /* Password reveal */
    var rev = e.target.closest('[data-reveal]');
    if (rev) {
      var input = document.getElementById(rev.getAttribute('data-reveal'));
      if (input) {
        var showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        rev.innerHTML = MB.icon(showing ? 'eye' : 'eyeoff', 18);
      }
    }

    /* Copy to clipboard. The value is literal text, or "#id" to copy what
       that element currently holds — needed when the text arrives at runtime. */
    var cp = e.target.closest('[data-copy]');
    if (cp) {
      var raw = cp.getAttribute('data-copy');
      var text = raw;
      if (raw.charAt(0) === '#') {
        var src = document.getElementById(raw.slice(1));
        if (src) { text = src.value !== undefined ? src.value : src.textContent; }
      }
      if (navigator.clipboard && text) {
        navigator.clipboard.writeText(text).then(function () { MB.toast('Copied'); });
      }
    }

    /* Stepper: data-step="inputId:delta" */
    var step = e.target.closest('[data-step]');
    if (step) {
      var parts = step.getAttribute('data-step').split(':');
      var target = document.getElementById(parts[0]);
      if (target) {
        var min = target.min !== '' ? Number(target.min) : -Infinity;
        var next = Math.max(min, Number(target.value || 0) + Number(parts[1]));
        target.value = String(Number(next.toFixed(2)));
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    /* Optimistic like / save toggles */
    var tog = e.target.closest('[data-toggle-icon]');
    if (tog) {
      var pair = tog.getAttribute('data-toggle-icon').split(',');
      var on = tog.classList.toggle(tog.getAttribute('data-toggle-class') || 'is-liked');
      var lbl = tog.querySelector('[data-count]');
      tog.querySelector('svg').outerHTML = MB.icon(on ? pair[1] : pair[0], 16);
      if (lbl) { lbl.textContent = String(Number(lbl.textContent || 0) + (on ? 1 : -1)); }
    }
  });

  /* ======================================================================
     BOOT
     ====================================================================== */
  MB.ready = function (fn) {
    if (document.readyState !== 'loading') { fn(); }
    else { document.addEventListener('DOMContentLoaded', fn); }
  };
})(window);
