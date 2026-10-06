/* ==========================================================================
   KonfluenX — PWA
   Registers the service worker, captures the install prompt, and drives
   every [data-install] button on the site.

   "Downloadable web app" in practice:
     Android / Chrome / Edge -> beforeinstallprompt, one tap
     iOS Safari              -> no API; we show the Share -> Add to Home Screen steps
     Desktop Chrome / Edge   -> install icon in the omnibox, or our button
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  var deferredPrompt = null;

  /* ======================================================================
     PLATFORM DETECTION
     ====================================================================== */
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isStandalone = global.matchMedia('(display-mode: standalone)').matches ||
                     global.navigator.standalone === true;

  MB.pwa = {
    isIOS: isIOS,
    isInstalled: function () { return isStandalone; },
    canPrompt: function () { return !!deferredPrompt; },

    /** Triggers the native install flow, or the iOS instruction sheet. */
    install: function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        return deferredPrompt.userChoice.then(function (choice) {
          deferredPrompt = null;
          hideBar();
          if (choice.outcome === 'accepted') {
            MB.toast('Installing KonfluenX…');
          }
          return choice.outcome;
        });
      }
      if (isIOS) { MB.sheet.open('iosInstall'); return Promise.resolve('ios-instructions'); }
      MB.toast('Use your browser menu, then "Install app"', 'ok', 3600);
      return Promise.resolve('unavailable');
    }
  };

  /* ======================================================================
     SERVICE WORKER
     ====================================================================== */
  function registerSW() {
    if (!('serviceWorker' in navigator)) { return; }
    /* Service workers require a secure context — https or localhost. */
    if (location.protocol === 'file:') {
      if (global.console) {
        console.info('[MB] Serve over HTTP to enable offline support and install.');
      }
      return;
    }
    var swUrl = MB.url('sw.js');
    navigator.serviceWorker.register(swUrl, { scope: MB.url('') })
      .then(function (reg) {
        /* Tell the user when a new version is ready rather than swapping silently. */
        reg.addEventListener('updatefound', function () {
          var sw = reg.installing;
          if (!sw) { return; }
          sw.addEventListener('statechange', function () {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              MB.toast('Update ready — reopen to apply', 'ok', 4000);
            }
          });
        });
      })
      .catch(function (err) {
        if (global.console) { console.warn('[MB] SW registration failed', err); }
      });
  }

  /* ======================================================================
     INSTALL BAR
     ====================================================================== */
  var DISMISS_KEY = 'mb.install.dismissed';

  function dismissed() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }
  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    hideBar();
  }
  function hideBar() {
    var bar = document.getElementById('mbInstallBar');
    if (bar) { bar.classList.remove('is-shown'); }
  }

  function showBar() {
    if (isStandalone || dismissed()) { return; }
    if (document.body.getAttribute('data-shell') !== 'app') { return; }

    var bar = document.getElementById('mbInstallBar');
    if (!bar) {
      bar = MB.el('div', { class: 'install-bar', id: 'mbInstallBar' },
        '<span class="ib-icon">' + MB.icon('download', 20) + '</span>' +
        '<span class="grow"><span class="ib-title">Install KonfluenX</span>' +
        '<span class="ib-sub" style="display:block">Full screen, works offline</span></span>' +
        '<button class="btn btn-primary btn-sm" data-install>Install</button>' +
        '<button class="icon-btn" id="mbInstallX" aria-label="Dismiss" ' +
        'style="width:30px;height:30px">' + MB.icon('close', 17) + '</button>');
      document.body.appendChild(bar);
      document.getElementById('mbInstallX').addEventListener('click', dismiss);
    }
    requestAnimationFrame(function () { bar.classList.add('is-shown'); });
  }

  /* ======================================================================
     iOS INSTRUCTION SHEET — Safari exposes no install API
     ====================================================================== */
  function buildIOSSheet() {
    if (document.getElementById('iosInstall')) { return; }
    var sheet = MB.el('div', { class: 'sheet-backdrop', id: 'iosInstall' },
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="Install on iPhone">' +
        '<div class="sheet-grip"></div>' +
        '<h2 class="t-h2">Add to Home Screen</h2>' +
        '<p class="t-sm c-2 mt2">Safari installs web apps from the Share menu. ' +
        'Three taps and KonfluenX behaves like any other app on your phone.</p>' +
        '<div class="stack g3 mt6">' +
          '<div class="row g3"><span class="po-num">1</span>' +
          '<span class="t-sm">Tap the <b>Share</b> button in the Safari toolbar</span></div>' +
          '<div class="row g3"><span class="po-num">2</span>' +
          '<span class="t-sm">Scroll and choose <b>Add to Home Screen</b></span></div>' +
          '<div class="row g3"><span class="po-num">3</span>' +
          '<span class="t-sm">Tap <b>Add</b> — KonfluenX appears on your home screen</span></div>' +
        '</div>' +
        '<button class="btn btn-primary btn-block mt6" data-sheet-close>Got it</button>' +
      '</div>');
    document.body.appendChild(sheet);
    MB.mountIcons(sheet);
  }

  /* ======================================================================
     EVENTS
     ====================================================================== */
  global.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    MB.$$('[data-install]').forEach(function (b) { b.classList.remove('hide'); });
    setTimeout(showBar, 2500);
  });

  global.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    isStandalone = true;
    hideBar();
    MB.toast('KonfluenX installed');
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-install]');
    if (btn) { e.preventDefault(); MB.pwa.install(); }
  });

  MB.ready(function () {
    registerSW();
    if (isIOS && !isStandalone) { buildIOSSheet(); }

    /* Standalone gets no install affordance — it is already installed. */
    if (isStandalone) {
      MB.$$('[data-install-block]').forEach(function (el) { el.classList.add('hide'); });
      document.body.classList.add('is-standalone');
    }

    /* iOS never fires beforeinstallprompt, so offer the sheet on a delay. */
    if (isIOS && !isStandalone) { setTimeout(showBar, 3500); }
  });
})(window);
