/* ==========================================================================
   KonfluenX — ACHIEVEMENT BADGES

   Badge tile (2-column grid), round badge row (profile strip) and the
   detail sheet. A badge is unlocked, in progress or locked; how it is
   earned is never shown — only what it is and what it unlocks.

   Stage 2: <x-achievement.tile :badge="$badge" />
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};
  var C = MB.card = MB.card || {};

  var TONES = ['gold', 'red', 'green', 'purple', 'blue', 'teal'];

  function statusOf(b) {
    if (b.status) { return b.status; }
    if (b.earned) { return 'unlocked'; }
    return b.progress > 0 ? 'in_progress' : 'locked';
  }
  function toneOf(b) { return TONES.indexOf(b.tone) > -1 ? b.tone : 'green'; }
  function nameOf(b) { return b.label || b.name; }

  var STATUS = {
    unlocked:    { label: 'Unlocked',    icon: null },
    in_progress: { label: 'In Progress', icon: null },
    locked:      { label: 'Locked',      icon: 'lock' }
  };

  /* Medallion: tinted disc with the badge icon in its tone colour. */
  function medal(b, size) {
    var st = statusOf(b);
    return '<span class="ach-medal tone-' + toneOf(b) + (st === 'locked' ? ' is-locked' : '') + '">' +
      MB.icon(st === 'locked' ? 'lock' : (b.icon || 'star'), size || 22) + '</span>';
  }

  /* 2-column grid tile */
  C.achievement = function (b) {
    var st = statusOf(b);
    var s = STATUS[st] || STATUS.locked;
    return '<button type="button" class="ach-tile is-' + st + '" data-badge="' + MB.esc(b.id) + '">' +
      medal(b, 24) +
      '<span class="ach-n">' + MB.esc(nameOf(b)) + '</span>' +
      '<span class="ach-d">' + MB.esc(b.description || '') + '</span>' +
      (st === 'in_progress'
        ? '<span class="ach-prog" aria-label="' + (b.progress || 0) + '% complete"><i style="width:' + Math.min(100, b.progress || 0) + '%"></i></span>'
        : '') +
      '<span class="ach-st">' + (s.icon ? MB.icon(s.icon, 11) : '<i class="dot"></i>') + s.label + '</span>' +
    '</button>';
  };

  /* Round badge row for a profile: earned first, locked greyed. */
  C.achievementBadges = function (badges, opts) {
    var o = opts || {};
    var list = (badges || []).slice().sort(function (a, b) {
      var r = { unlocked: 0, in_progress: 1, locked: 2 };
      return r[statusOf(a)] - r[statusOf(b)];
    });
    if (o.limit) { list = list.slice(0, o.limit); }
    return list.map(function (b) {
      var st = statusOf(b);
      return '<a class="ach-round is-' + st + '" href="' + (o.href || 'achievements.html') + '" title="' + MB.esc(nameOf(b)) + '">' +
        medal(b, 20) +
        '<span class="ach-round-n">' + MB.esc(nameOf(b)) + '</span>' +
      '</a>';
    }).join('');
  };

  /* The highest-standing earned badge, for the chip under a profile name. */
  C.topBadge = function (badges) {
    var earned = (badges || []).filter(function (b) { return statusOf(b) === 'unlocked'; });
    var order = ['top_signal_provider', 'founding_member', 'founding_institution', 'konfluenx_partner',
                 'market_specialist', 'consistent_trader', 'consistent_performer'];
    earned.sort(function (a, b) {
      var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    var b = earned[0];
    if (!b) { return ''; }
    /* The award chip is always gold — it is a standing, not a category colour. */
    return '<span class="ach-chip tone-gold">' + MB.icon(b.icon || 'star', 12) + MB.esc(nameOf(b)) + '</span>';
  };

  /* Detail sheet: what it is, where you stand, what it unlocks. Never the criteria. */
  C.achievementSheet = function (b, extra) {
    var st = statusOf(b);
    var s = STATUS[st] || STATUS.locked;
    var x = extra || {};
    var rows = [];
    if (b.kind) { rows.push(['Type', b.kind]); }
    if (b.applies && b.applies.length) {
      rows.push(['Applies to', b.applies.map(function (a) { return a === 'individual' ? 'Individual' : 'Institution'; }).join(' · ')]);
    }
    if (st === 'unlocked' && b.earned_at) { rows.push(['Earned', MB.fmt.date(new Date(b.earned_at))]); }
    if (b.holders) { rows.push(['Holders', MB.fmt.compact(b.holders)]); }
    return '<div class="ach-sheet">' +
      '<div class="ach-sheet-head">' + medal(b, 30) +
        '<div class="grow"><div class="t-h3 w-bold">' + MB.esc(nameOf(b)) + '</div>' +
        '<div class="ach-st is-' + st + '">' + (s.icon ? MB.icon(s.icon, 11) : '<i class="dot"></i>') + s.label +
          (st === 'in_progress' ? ' · ' + (b.progress || 0) + '%' : '') + '</div></div>' +
      '</div>' +
      '<p class="t-sm c-2 mt3">' + MB.esc(b.description || '') + '</p>' +
      (st === 'in_progress' ? '<span class="ach-prog mt3"><i style="width:' + (b.progress || 0) + '%"></i></span>' : '') +
      (x.unlocks ? '<div class="mt3">' + x.unlocks + '</div>' : '') +
      '<div class="ach-rows mt3">' + rows.map(function (r) {
        return '<div class="ach-row"><span class="k">' + MB.esc(r[0]) + '</span><span class="v">' + MB.esc(r[1]) + '</span></div>';
      }).join('') + '</div>' +
      '<p class="t-xs c-3 mt3">How badges are earned is kept private so they cannot be gamed. Badges are reviewed automatically.</p>' +
    '</div>';
  };

  C.achievementStatus = statusOf;
})(window);
