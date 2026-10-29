/*!
 * ЦРВУ — карусель пар «рендер — фото готового стенда» поверх слайдера сравнения (widgets.js).
 * Пары — реальные проекты ЦРВУ: 3D-рендер и фото с выставки одного и того же стенда.
 */
(function (w, d) {
  'use strict';
  var CRVU = w.CRVU = w.CRVU || {};
  var PAIRS = [
    { slug: 'baikal', name: 'Legend of Baikal', cap: 'производство воды из Байкала · 2024' },
    { slug: 'nordic', name: 'NORDIC', cap: 'производитель хлопьев и каш · 2024' },
    { slug: 'derbent', name: 'Дербентский коньячный комбинат', cap: '2024' },
    { slug: 'umny-servis', name: 'Умный сервис', cap: 'автоматизация и роботизация · 2024' },
    { slug: 'bigbear', name: 'BigBear', cap: 'производство напитков · 2024' },
    { slug: 'tagras', name: 'Таграс', cap: 'нефтегазовый холдинг · 2024' }
  ];
  var BASE = 'assets/v3/pairs/';

  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  function src(p, kind, wdt) { return BASE + p.slug + '-' + kind + '-' + wdt + '.webp'; }
  function srcset(p, kind) { return src(p, kind, 960) + ' 960w, ' + src(p, kind, 1680) + ' 1680w'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function init() {
    var root = $('#compare');
    if (!root) { return; }
    var real = $('[data-pair-real]', root), render = $('[data-pair-render]', root);
    var stage = $('[data-cmp-stage]', root), cap = $('#pairCap'), count = $('#pairCount');
    var thumbs = $$('.pthumb[data-pair]', root), segs = $$('[data-cmp-show]', root);
    var idx = 0, token = 0;
    if (!real || !render) { return; }

    function load(url) {
      return new Promise(function (res) {
        var im = new Image();
        im.decoding = 'async';
        im.onload = im.onerror = function () { res(); };
        im.src = url;
      });
    }
    /* браузер сам выберет 960 или 1680 по srcset; заранее грузим тот же размер */
    function want() { return (w.innerWidth * (w.devicePixelRatio || 1)) > 1100 ? 1680 : 960; }

    function go(i, byUser) {
      var n = PAIRS.length;
      i = ((i % n) + n) % n;
      if (i === idx && byUser !== 'init') { return; }
      idx = i;
      var p = PAIRS[i], my = ++token, size = want();
      thumbs.forEach(function (t) { t.setAttribute('aria-pressed', String(+t.getAttribute('data-pair') === i)); });
      count.textContent = (i + 1) + '\u00a0/\u00a0' + n;
      if (stage) { stage.classList.add('is-swapping'); }
      Promise.all([load(src(p, 'real', size)), load(src(p, 'render', size))]).then(function () {
        if (my !== token) { return; }
        real.srcset = srcset(p, 'real');
        real.src = src(p, 'real', 1680);
        real.alt = 'Фото готового стенда ' + p.name + ' на выставке';
        render.srcset = srcset(p, 'render');
        render.src = src(p, 'render', 1680);
        render.alt = '3D-рендер стенда ' + p.name;
        cap.innerHTML = '<b>' + esc(p.name) + '</b><span>' + esc(p.cap) + '</span>';
        if (CRVU.cmpSet) { CRVU.cmpSet(50); }
        w.requestAnimationFrame(function () { if (stage) { stage.classList.remove('is-swapping'); } });
        /* следующую пару подгружаем заранее */
        var nx = PAIRS[(i + 1) % n];
        w.setTimeout(function () { load(src(nx, 'real', size)); load(src(nx, 'render', size)); }, 400);
      });
      if (CRVU.track && byUser === true) { CRVU.track('compare_pair', { pair: p.slug }); }
    }

    var prev = $('[data-pair-prev]', root), next = $('[data-pair-next]', root);
    if (prev) { prev.addEventListener('click', function () { go(idx - 1, true); }); }
    if (next) { next.addEventListener('click', function () { go(idx + 1, true); }); }
    thumbs.forEach(function (t) {
      t.addEventListener('click', function () { go(+t.getAttribute('data-pair'), true); });
    });

    /* «Рендер / 50 на 50 / Фото» */
    function syncSeg(pos) {
      segs.forEach(function (b) { b.setAttribute('aria-pressed', String(Math.round(pos) === +b.getAttribute('data-cmp-show'))); });
    }
    segs.forEach(function (b) {
      b.addEventListener('click', function () {
        var v = +b.getAttribute('data-cmp-show');
        if (CRVU.cmpSet) { CRVU.cmpSet(v); }
        syncSeg(v);
      });
    });
    var prevHook = CRVU.onCmpMove;
    CRVU.onCmpMove = function (pos, byUser) {
      syncSeg(pos);
      if (typeof prevHook === 'function') { prevHook(pos, byUser); }
    };

    /* свайп по миниатюрам на телефоне прокручивает ленту; стрелки клавиатуры — внутри ленты */
    var strip = $('#pairThumbs');
    if (strip) {
      strip.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') { return; }
        e.preventDefault();
        go(idx + (e.key === 'ArrowRight' ? 1 : -1), true);
        var t = thumbs[idx];
        if (t) { t.focus(); }
      });
    }
    count.textContent = '1\u00a0/\u00a0' + PAIRS.length;
  }

  var inited = false;
  function boot() { if (!inited) { inited = true; init(); } }
  if (d.readyState === 'complete') { boot(); } else { d.addEventListener('DOMContentLoaded', boot); w.addEventListener('load', boot); }
})(window, document);
