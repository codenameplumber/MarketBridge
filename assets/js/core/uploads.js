/* ==========================================================================
   KonfluenX — UPLOADS
   Image and file attachments for chat, posts and signal charts.

   Everything here is client-side: files are read as object URLs for preview
   and held in memory. In Stage 2 `MB.uploads.list()` is what gets POSTed as
   multipart to the media endpoint, and the returned storage keys replace the
   object URLs. The markup and the interaction do not change.

     MB.uploads.attach({
       drop: '#composer',       // container that accepts drag-and-drop
       input: '#fileInput',     // hidden <input type="file">
       previews: '#previews',   // where thumbnails render
       accept: 'any'            // 'image' | 'any'
     });
   ========================================================================== */

(function (global) {
  'use strict';
  var MB = global.MB = global.MB || {};

  var MAX_FILES = 6;
  var MAX_BYTES = 12 * 1024 * 1024;        /* 12 MB per file */
  var IMAGE_RE = /^image\//;
  var ALLOWED = /\.(png|jpe?g|gif|webp|avif|pdf|csv|txt|md|xlsx?|docx?|zip)$/i;

  var stores = {};                          /* dropSelector -> [file records] */

  function fmtSize(bytes) {
    if (bytes < 1024) { return bytes + ' B'; }
    if (bytes < 1048576) { return (bytes / 1024).toFixed(0) + ' KB'; }
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function renderPreviews(key, previewsEl) {
    var list = stores[key] || [];
    previewsEl.innerHTML = list.map(function (f, i) {
      var inner = f.isImage
        ? '<img src="' + f.url + '" alt="' + MB.esc(f.name) + '">'
        : '<span class="cp-file">' + MB.icon('file', 20) + '</span>';
      return '<div class="cp-item" title="' + MB.esc(f.name) + ' · ' + f.sizeLabel + '">' +
        inner +
        '<button class="cp-x" data-rm="' + i + '" aria-label="Remove ' + MB.esc(f.name) + '">' +
          MB.icon('close', 11) + '</button>' +
      '</div>';
    }).join('');
    MB.mountIcons(previewsEl);

    MB.$$('[data-rm]', previewsEl).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-rm'));
        var rec = stores[key][i];
        if (rec && rec.url) { URL.revokeObjectURL(rec.url); }
        stores[key].splice(i, 1);
        renderPreviews(key, previewsEl);
      });
    });
  }

  function addFiles(key, files, previewsEl, accept) {
    var list = stores[key] = stores[key] || [];
    var added = 0, rejected = 0;

    Array.prototype.forEach.call(files, function (file) {
      if (list.length >= MAX_FILES) { rejected++; return; }
      var isImage = IMAGE_RE.test(file.type);
      if (accept === 'image' && !isImage) { rejected++; return; }
      if (!isImage && !ALLOWED.test(file.name)) { rejected++; return; }
      if (file.size > MAX_BYTES) { rejected++; return; }

      list.push({
        file: file,
        name: file.name,
        type: file.type,
        size: file.size,
        sizeLabel: fmtSize(file.size),
        isImage: isImage,
        url: URL.createObjectURL(file)
      });
      added++;
    });

    renderPreviews(key, previewsEl);

    if (rejected) {
      MB.toast(
        list.length >= MAX_FILES
          ? 'Up to ' + MAX_FILES + ' files per message'
          : accept === 'image'
            ? 'Images only, up to ' + fmtSize(MAX_BYTES)
            : 'Unsupported file, or larger than ' + fmtSize(MAX_BYTES),
        'err', 3200);
    }
    return added;
  }

  MB.uploads = {
    maxFiles: MAX_FILES,
    maxBytes: MAX_BYTES,

    attach: function (opts) {
      var o = opts || {};
      var drop = typeof o.drop === 'string' ? MB.$(o.drop) : o.drop;
      var input = typeof o.input === 'string' ? MB.$(o.input) : o.input;
      var previews = typeof o.previews === 'string' ? MB.$(o.previews) : o.previews;
      if (!drop || !input || !previews) { return; }

      var key = o.drop;
      stores[key] = stores[key] || [];
      var accept = o.accept || 'any';

      /* browse */
      MB.$$('[data-pick]', drop).forEach(function (b) {
        b.addEventListener('click', function (e) { e.preventDefault(); input.click(); });
      });
      input.addEventListener('change', function () {
        addFiles(key, input.files, previews, accept);
        input.value = '';                   /* allow re-picking the same file */
      });

      /* drag and drop */
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault(); e.stopPropagation();
          drop.classList.add('is-drop');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault(); e.stopPropagation();
          if (ev === 'dragleave' && drop.contains(e.relatedTarget)) { return; }
          drop.classList.remove('is-drop');
        });
      });
      drop.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          addFiles(key, e.dataTransfer.files, previews, accept);
        }
      });

      /* paste an image straight into the composer */
      var field = drop.querySelector('textarea, input[type=text]');
      if (field) {
        field.addEventListener('paste', function (e) {
          var items = (e.clipboardData || {}).items || [];
          var files = [];
          Array.prototype.forEach.call(items, function (it) {
            if (it.kind === 'file') { var f = it.getAsFile(); if (f) { files.push(f); } }
          });
          if (files.length) { e.preventDefault(); addFiles(key, files, previews, accept); }
        });
      }
    },

    /** Current attachments for a target, in the shape the API expects. */
    list: function (key) {
      return (stores[key] || []).map(function (f) {
        return {
          type: f.isImage ? 'image' : 'file',
          name: f.name, size: f.sizeLabel, mime: f.type,
          url: f.url                      /* Stage 2: replaced by the storage key */
        };
      });
    },

    count: function (key) { return (stores[key] || []).length; },

    clear: function (key) {
      (stores[key] || []).forEach(function (f) { if (f.url) { URL.revokeObjectURL(f.url); } });
      stores[key] = [];
      var el = MB.$(key);
      if (el) {
        var p = el.querySelector('.composer-previews');
        if (p) { p.innerHTML = ''; }
      }
    }
  };
})(window);
