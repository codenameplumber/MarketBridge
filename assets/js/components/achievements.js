/* ==========================================================================
   KonfluenX — ACHIEVEMENT BADGES

   Renders achievement/badge cards. Each badge has a tier (bronze, silver,
   gold, legendary), earned state, and progress for unearned badges.

   Stage 2: <livewire:achievement.card :badge="$badge" />
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};
  var C = MB.card = MB.card || {};

  var TIER_COLORS = {
    bronze:    'var(--mb-text-3)',
    silver:    'var(--mb-text-2)',
    gold:      '#FFD700',
    legendary: 'var(--vy-brand)'
  };

  C.achievement = function (b) {
    var earned = b.earned;
    var tierColor = TIER_COLORS[b.tier] || TIER_COLORS.silver;
    var cls = 'achv-card' + (earned ? ' achv-earned' : ' achv-locked');

    var progressBar = '';
    if (!earned && b.progress !== undefined && b.progress > 0) {
      progressBar =
        '<div class="achv-progress">' +
          '<div class="achv-progress-track">' +
            '<div class="achv-progress-fill" style="width:' + b.progress + '%"></div>' +
          '</div>' +
          '<span class="t-xs c-3">' + b.progress + '%</span>' +
        '</div>';
    }

    var earnedDate = '';
    if (earned && b.earned_at) {
      var d = new Date(b.earned_at);
      earnedDate = '<div class="t-xs c-3 mt1">Earned ' + MB.fmt.date(d) + '</div>';
    }

    return '<div class="' + cls + '">' +
      '<div class="achv-icon" style="color:' + tierColor + '">' +
        MB.icon(b.icon || 'star', 28) +
      '</div>' +
      '<div class="achv-body">' +
        '<div class="achv-name">' + MB.esc(b.name) + '</div>' +
        '<span class="achv-tier achv-tier-' + b.tier + '">' + b.tier + '</span>' +
        '<div class="t-xs c-3 mt1">' + MB.esc(b.description) + '</div>' +
        earnedDate +
        progressBar +
        '<div class="t-xs c-3 mt1">' + MB.icon('community', 11) + ' ' + (b.holders || 0) + ' holders</div>' +
      '</div>' +
    '</div>';
  };

  C.achievementBadges = function (badges) {
    if (!badges || !badges.length) { return ''; }
    return badges.filter(function (b) { return b.earned; }).slice(0, 3).map(function (b) {
      var tierColor = TIER_COLORS[b.tier] || TIER_COLORS.silver;
      return '<span class="badge achv-badge" style="border-color:' + tierColor + ';color:' + tierColor + '" title="' + MB.esc(b.name) + '">' +
        MB.icon(b.icon || 'star', 11) + MB.esc(b.name) +
      '</span>';
    }).join('');
  };
})(window);
