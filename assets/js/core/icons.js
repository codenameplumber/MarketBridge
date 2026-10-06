/* ==========================================================================
   KonfluenX — ICONS
   Inline SVG strings. Inlined rather than sprited so the app renders
   correctly from file://, from the network, and from the service-worker
   cache with no extra request.

   Usage:  <span data-icon="home"></span>   -> hydrated by mountIcons()
           MB.icon('home', 20)              -> returns an SVG string
   ========================================================================== */

(function (global) {
  'use strict';

  var P = 'stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

  var PATHS = {
    /* --- navigation ---------------------------------------------------- */
    home:      '<path ' + P + ' d="M3 10.5 12 3l9 7.5"/><path ' + P + ' d="M5 9.5V20a1 1 0 0 0 1 1h3.5v-6h5v6H18a1 1 0 0 0 1-1V9.5"/>',
    markets:   '<path ' + P + ' d="M4 20V10M9 20V4M14 20v-7M19 20V7"/>',
    trade:     '<path ' + P + ' d="M6 21V10M6 6V3M18 21v-3M18 14V3"/><rect ' + P + ' x="3.5" y="6" width="5" height="4" rx="1"/><rect ' + P + ' x="15.5" y="14" width="5" height="4" rx="1"/>',
    signals:   '<circle ' + P + ' cx="12" cy="12" r="9"/><circle ' + P + ' cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
    community: '<path ' + P + ' d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 5 18.5V20"/><circle ' + P + ' cx="10.5" cy="8" r="3.2"/><path ' + P + ' d="M19 20v-1.4a3.4 3.4 0 0 0-2.6-3.3M15.5 5.2a3.2 3.2 0 0 1 0 5.6"/>',
    more:      '<circle cx="5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="19" cy="12" r="1.9" fill="currentColor"/>',
    grid:      '<rect ' + P + ' x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect ' + P + ' x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect ' + P + ' x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect ' + P + ' x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',

    /* --- product areas -------------------------------------------------- */
    results:   '<path ' + P + ' d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path ' + P + ' d="M17 5h2.5a2.5 2.5 0 0 1-2.5 4M7 5H4.5A2.5 2.5 0 0 0 7 9"/><path ' + P + ' d="M12 13v4M8.5 21h7l-.8-3h-5.4l-.8 3Z"/>',
    resources: '<path ' + P + ' d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.6 1.6 0 0 0-1.6-1.6H5.5A1.5 1.5 0 0 1 4 15.9V5.5Z"/><path ' + P + ' d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.6 1.6 0 0 1 1.6-1.6h4.9a1.5 1.5 0 0 0 1.5-1.5V5.5Z"/>',
    wallet:    '<path ' + P + ' d="M3.5 8.5A2.5 2.5 0 0 1 6 6h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2.5 2.5 0 0 1-2.5-2.5v-8Z"/><path ' + P + ' d="M3.5 9.5h13a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-13"/><circle cx="16" cy="12" r="1.1" fill="currentColor"/>',

    /* --- contract families ---------------------------------------------- */
    accumulator: '<path ' + P + ' d="M4 19V13M9 19V9M14 19v-8M19 19V5"/>',
    risefall:    '<path ' + P + ' d="M8 20V5M8 5 4.5 8.5M8 5l3.5 3.5"/><path ' + P + ' d="M16 4v15M16 19l3.5-3.5M16 19l-3.5-3.5"/>',
    digits:      '<circle ' + P + ' cx="12" cy="12" r="8.5"/><path ' + P + ' d="M12 7v5l3 2"/>',
    multipliers: '<path ' + P + ' d="M7 7l10 10M17 7 7 17"/><circle ' + P + ' cx="12" cy="12" r="9"/>',
    bot:         '<rect ' + P + ' x="4" y="8" width="16" height="12" rx="3"/><path ' + P + ' d="M12 8V4.5M9 4.5h6"/><circle cx="9" cy="14" r="1.4" fill="currentColor"/><circle cx="15" cy="14" r="1.4" fill="currentColor"/>',

    /* --- actions --------------------------------------------------------- */
    plus:      '<path ' + P + ' d="M12 5v14M5 12h14"/>',
    minus:     '<path ' + P + ' d="M5 12h14"/>',
    check:     '<path ' + P + ' d="M4 12.5 9 17.5 20 6.5"/>',
    close:     '<path ' + P + ' d="M6 6l12 12M18 6 6 18"/>',
    search:    '<circle ' + P + ' cx="11" cy="11" r="7"/><path ' + P + ' d="m20 20-3.5-3.5"/>',
    filter:    '<path ' + P + ' d="M4 6h16M7 12h10M10 18h4"/>',
    bell:      '<path ' + P + ' d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z"/><path ' + P + ' d="M13.7 19a2 2 0 0 1-3.4 0"/>',
    settings:  '<circle ' + P + ' cx="12" cy="12" r="3"/><path ' + P + ' d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
    edit:      '<path ' + P + ' d="M12 20h9"/><path ' + P + ' d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash:     '<path ' + P + ' d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    eye:       '<path ' + P + ' d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle ' + P + ' cx="12" cy="12" r="3"/>',
    eyeoff:    '<path ' + P + ' d="M10.6 5.3A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.6-1.1"/><path ' + P + ' d="M9.9 9.9a3 3 0 1 0 4.2 4.2M3 3l18 18"/>',
    copy:      '<rect ' + P + ' x="9" y="9" width="11" height="11" rx="2"/><path ' + P + ' d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    share:     '<path ' + P + ' d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path ' + P + ' d="M12 3v13M12 3 8 7M12 3l4 4"/>',
    download:  '<path ' + P + ' d="M12 3v12M12 15l-4-4M12 15l4-4"/><path ' + P + ' d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    upload:    '<path ' + P + ' d="M12 16V4M12 4 8 8M12 4l4 4"/><path ' + P + ' d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    image:     '<rect ' + P + ' x="3" y="4" width="18" height="16" rx="2"/><circle ' + P + ' cx="8.5" cy="9.5" r="1.8"/><path ' + P + ' d="m3.5 17 5-5 4 4 3-2.5 5 4.5"/>',
    logout:    '<path ' + P + ' d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/><path ' + P + ' d="M16 17l5-5-5-5M21 12H9"/>',
    refresh:   '<path ' + P + ' d="M20 11a8 8 0 1 0-1.5 5.5"/><path ' + P + ' d="M20 5v6h-6"/>',
    external:  '<path ' + P + ' d="M14 4h6v6"/><path ' + P + ' d="M20 4 11 13"/><path ' + P + ' d="M18 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5"/>',
    menu:      '<path ' + P + ' d="M4 6h16M4 12h16M4 18h16"/>',

    /* --- social ---------------------------------------------------------- */
    heart:     '<path ' + P + ' d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.5 3c0 4.9-7.5 9.6-7.5 9.6Z"/>',
    heartfill: '<path fill="currentColor" d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.5 3c0 4.9-7.5 9.6-7.5 9.6Z"/>',
    comment:   '<path ' + P + ' d="M20 11.5a7.5 7.5 0 0 1-10.8 6.7L4 20l1.8-5A7.5 7.5 0 1 1 20 11.5Z"/>',
    bookmark:  '<path ' + P + ' d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z"/>',
    bookmarkfill: '<path fill="currentColor" d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z"/>',
    thumbsup:  '<path ' + P + ' d="M7 21V10l4.5-7A2 2 0 0 1 14 4.7L13 9h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17 20H7Z"/><path ' + P + ' d="M7 10H4v11h3"/>',
    star:      '<path ' + P + ' d="m12 3.5 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5Z"/>',
    starfill:  '<path fill="currentColor" d="m12 3.5 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5Z"/>',
    users:     '<circle ' + P + ' cx="9" cy="8" r="3.4"/><path ' + P + ' d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3A4.5 4.5 0 0 1 15 18.5V20"/><path ' + P + ' d="M17 20v-1.5a4.4 4.4 0 0 0-2.6-4M15.5 5.2a3.4 3.4 0 0 1 0 5.6"/>',
    userplus:  '<circle ' + P + ' cx="9" cy="8" r="3.4"/><path ' + P + ' d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20"/><path ' + P + ' d="M18 8v6M21 11h-6"/>',
    send:      '<path ' + P + ' d="M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4L21 3Z"/>',

    /* --- indicators / status --------------------------------------------- */
    up:        '<path ' + P + ' d="M12 19V5M12 5l-6 6M12 5l6 6"/>',
    down:      '<path ' + P + ' d="M12 5v14M12 19l-6-6M12 19l6-6"/>',
    trendup:   '<path ' + P + ' d="m3 17 5.5-5.5 3.5 3.5L21 6"/><path ' + P + ' d="M15 6h6v6"/>',
    trenddown: '<path ' + P + ' d="m3 7 5.5 5.5L12 9l9 9"/><path ' + P + ' d="M15 18h6v-6"/>',
    chevright: '<path ' + P + ' d="m9 5 7 7-7 7"/>',
    chevleft:  '<path ' + P + ' d="m15 5-7 7 7 7"/>',
    chevdown:  '<path ' + P + ' d="m6 9 6 6 6-6"/>',
    back:      '<path ' + P + ' d="M20 12H4M4 12l6-6M4 12l6 6"/>',
    info:      '<circle ' + P + ' cx="12" cy="12" r="9"/><path ' + P + ' d="M12 11v5"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor"/>',
    warning:   '<path ' + P + ' d="M12 3.5 22 20H2L12 3.5Z"/><path ' + P + ' d="M12 10v4"/><circle cx="12" cy="17" r="1.1" fill="currentColor"/>',
    shield:    '<path ' + P + ' d="M12 3l7.5 3v6c0 4.5-3 8-7.5 9.5C7.5 20 4.5 16.5 4.5 12V6L12 3Z"/><path ' + P + ' d="m9 12 2.2 2.2L15.5 10"/>',
    lock:      '<rect ' + P + ' x="4.5" y="10" width="15" height="11" rx="2"/><path ' + P + ' d="M8 10V7a4 4 0 1 1 8 0v3"/>',
    clock:     '<circle ' + P + ' cx="12" cy="12" r="9"/><path ' + P + ' d="M12 7v5.2l3.4 2"/>',
    calendar:  '<rect ' + P + ' x="3.5" y="5" width="17" height="16" rx="2"/><path ' + P + ' d="M3.5 10h17M8 3v4M16 3v4"/>',
    flame:     '<path ' + P + ' d="M12 21c3.6 0 6-2.4 6-5.6 0-3.9-4-5.4-3.2-9.9C12 6.8 9.5 9 9.5 11.6c0 .9.3 1.6.3 1.6s-1.3-.6-1.7-2.2C6.7 12.4 6 14 6 15.4 6 18.6 8.4 21 12 21Z"/>',
    play:      '<path fill="currentColor" d="M8 5.5 19 12 8 18.5v-13Z"/>',
    file:      '<path ' + P + ' d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path ' + P + ' d="M14 3v5h5"/>',
    flag:      '<path ' + P + ' d="M5 21V4M5 4h11l-2 3.5L16 11H5"/>',
    ban:       '<circle ' + P + ' cx="12" cy="12" r="9"/><path ' + P + ' d="m5.6 5.6 12.8 12.8"/>',
    link:      '<path ' + P + ' d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.1"/><path ' + P + ' d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.1"/>',
    sun:       '<circle ' + P + ' cx="12" cy="12" r="4.2"/><path ' + P + ' d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"/>',
    moon:      '<path ' + P + ' d="M20.5 14.5A8.6 8.6 0 0 1 9.5 3.5a8.6 8.6 0 1 0 11 11Z"/>',
    phone:     '<rect ' + P + ' x="6" y="2.5" width="12" height="19" rx="2.5"/><path ' + P + ' d="M10.5 5.5h3"/>',
    mail:      '<rect ' + P + ' x="3" y="5" width="18" height="14" rx="2"/><path ' + P + ' d="m3.5 6.5 8.5 6 8.5-6"/>',
    chat:      '<path ' + P + ' d="M20 11.5a7.5 7.5 0 0 1-10.8 6.7L4 20l1.8-5A7.5 7.5 0 1 1 20 11.5Z"/><circle cx="9" cy="11.5" r="1" fill="currentColor"/><circle cx="12" cy="11.5" r="1" fill="currentColor"/><circle cx="15" cy="11.5" r="1" fill="currentColor"/>',
    globe:     '<circle ' + P + ' cx="12" cy="12" r="9"/><path ' + P + ' d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
    book:      '<path ' + P + ' d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path ' + P + ' d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5Z"/>',
    chart:     '<path ' + P + ' d="M4 20h16"/><rect ' + P + ' x="5" y="12" width="3.5" height="6" rx="1"/><rect ' + P + ' x="10.2" y="7" width="3.5" height="11" rx="1"/><rect ' + P + ' x="15.5" y="9.5" width="3.5" height="8.5" rx="1"/>',
    layers:    '<path ' + P + ' d="m12 3 9 5-9 5-9-5 9-5Z"/><path ' + P + ' d="m3 13 9 5 9-5"/>',
    activity:  '<path ' + P + ' d="M3 12h4l3-8 4 16 3-8h4"/>',
    briefcase: '<rect ' + P + ' x="3" y="7" width="18" height="13" rx="2"/><path ' + P + ' d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7"/>',
    megaphone: '<path ' + P + ' d="M4 10v4a2 2 0 0 0 2 2h2l8 4V4L8 8H6a2 2 0 0 0-2 2Z"/><path ' + P + ' d="M19 9a3.5 3.5 0 0 1 0 6"/>',
    key:       '<circle ' + P + ' cx="8" cy="15" r="4"/><path ' + P + ' d="m11 12 8-8M17 6l2 2M15 8l2 2"/>',
    scale:     '<path ' + P + ' d="M12 3v18M7 21h10M5 8h14M5 8 2.5 14h5L5 8ZM19 8l-2.5 6h5L19 8Z"/>',
    reply:     '<path ' + P + ' d="M10 8 5 12l5 4"/><path ' + P + ' d="M5 12h9a5 5 0 0 1 5 5v1"/>',
    xsocial:   '<path ' + P + ' d="M4 4l16 16M20 4l-6.6 7.2M10.6 12.8 4 20"/>',
    telegram:  '<path ' + P + ' d="M21 4 3 11l6 2.2M21 4l-3 16-8.9-6.8M21 4 9.1 13.2V19l3-3.5"/>',
    instagram: '<rect ' + P + ' x="3.5" y="3.5" width="17" height="17" rx="5"/><circle ' + P + ' cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1" fill="currentColor"/>',
    youtube:   '<rect ' + P + ' x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor"/>'
  };

  function icon(name, size) {
    var d = PATHS[name];
    if (!d) { d = PATHS.info; }
    var s = size || 24;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s +
           '" aria-hidden="true" focusable="false">' + d + '</svg>';
  }

  /* Replace every <… data-icon="name"> with its SVG. Idempotent. */
  function mountIcons(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-icon]:not([data-icon-done])');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      el.innerHTML = icon(el.getAttribute('data-icon'), el.getAttribute('data-icon-size'));
      el.setAttribute('data-icon-done', '1');
    }
  }

  global.MB = global.MB || {};
  global.MB.icon = icon;
  global.MB.mountIcons = mountIcons;
  global.MB.ICON_NAMES = Object.keys(PATHS);
})(window);
