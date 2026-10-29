/*!
 * ЦРВУ — поиск выставки по вводу (комбобокс) для select[data-combobox].
 * Нативный select остаётся в форме и хранит значение; поле ввода показывает подсказки
 * по названию, отрасли, площадке и месяцу. Если выставки нет в списке, можно выбрать
 * «Другая выставка» — введённое название сохраняется в select.dataset.customName.
 * Инициализация — после всех defer-скриптов (DOMContentLoaded), когда списки уже заполнены.
 */
(function (w, d) {
  'use strict';
  var CRVU = w.CRVU = w.CRVU || {};
  var D = w.CRVU_DATA || {};
  var MONTHS = ['январь января', 'февраль февраля', 'март марта', 'апрель апреля', 'май мая', 'июнь июня', 'июль июля', 'август августа', 'сентябрь сентября', 'октябрь октября', 'ноябрь ноября', 'декабрь декабря'];
  /* русские и английские варианты написания, чтобы находилось и «фармтех», и «pharmtech» */
  var AKA = {
    'pharmtech-2026': 'фармтех фармтек pharmtech ингредиенты фармацевтика фарма',
    'zdravoohranenie-2026': 'здравоохранение healthcare zdravoohranenie медицина медтехника',
    'upakexpo-2027': 'упакэкспо упак upakexpo упаковка пластик',
    'aquaflame-2027': 'аквафлейм аквафлэйм aquaflame акватерм aquatherm отопление водоснабжение бассейны',
    'prodexpo-2027': 'продэкспо prodexpo продукты питание напитки еда',
    'transrussia-2027': 'трансраша трансрашa transrussia складтех skladtech логистика транспорт склад',
    'modern-bakery-2027': 'модерн бейкери modern bakery конфекс confex хлеб выпечка кондитер',
    'mosbuild-2027': 'мосбилд mosbuild стройка строительство отделка интерьер',
    'expoelectronica-2027': 'экспоэлектроника expoelectronica электроника компоненты',
    'metalworking-2027': 'металлообработка metalloobrabotka metalworking станки металл',
    'ctt-expo-2027': 'стт ctt ctt expo строительная техника спецтехника дорожная',
    'rosupack-2027': 'росупак rosupack упаковка',
    'mims-2027': 'мимс mims automobility автомобили автозапчасти автосервис автобизнес',
    'worldfood-2027': 'ворлдфуд ворлд фуд worldfood world food продукты питание напитки',
    'agroprodmash-2027': 'агропродмаш agroprodmash пищевое оборудование переработка',
    'provoloka-2027': 'проволока provoloka метизы крепёж крепеж кабель'
  };

  function norm(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"'.,:;()\/\\\-–—&+№!?]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function expoById(id) {
    var list = D.expos || [];
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return null;
  }
  function monthWords(e) {
    var m = /^\d{4}-(\d{2})/.exec(e.open || '');
    return m ? MONTHS[parseInt(m[1], 10) - 1] : '';
  }
  /* подсветка совпадений в названии: длина строки при lowerCase и ё→е не меняется */
  function highlight(text, tokens) {
    var low = text.toLowerCase().replace(/ё/g, 'е'), marks = [];
    tokens.forEach(function (t) {
      var i = low.indexOf(t);
      if (i >= 0) { marks.push([i, i + t.length]); }
    });
    if (!marks.length) { return esc(text); }
    marks.sort(function (a, b) { return a[0] - b[0]; });
    var out = '', pos = 0;
    marks.forEach(function (m) {
      if (m[0] < pos) { return; }
      out += esc(text.slice(pos, m[0])) + '<mark>' + esc(text.slice(m[0], m[1])) + '</mark>';
      pos = m[1];
    });
    return out + esc(text.slice(pos));
  }

  var uid = 0;

  function enhance(sel) {
    if (sel._cbx) { return; }
    var id = sel.id || ('cbx' + (++uid));
    var wrap = d.createElement('div');
    var input = d.createElement('input');
    var btn = d.createElement('button');
    var list = d.createElement('ul');
    var live = d.createElement('span');
    var items = [], shown = [], active = -1, open = false;

    wrap.className = 'cbx';
    input.type = 'text';
    input.className = 'input cbx__input';
    input.id = id + 'Input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', id + 'List');
    input.placeholder = sel.getAttribute('data-placeholder') || 'Начните вводить название';
    if (sel.getAttribute('aria-describedby')) { input.setAttribute('aria-describedby', sel.getAttribute('aria-describedby')); }

    btn.type = 'button';
    btn.className = 'cbx__toggle';
    btn.tabIndex = -1;
    btn.setAttribute('aria-label', 'Показать все выставки');
    btn.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-chev"></use></svg>';

    list.className = 'cbx__list';
    list.id = id + 'List';
    list.hidden = true;
    list.setAttribute('role', 'listbox');

    live.className = 'sr-only';
    live.setAttribute('role', 'status');

    var label = d.querySelector('label[for="' + id + '"]');
    if (label) { label.htmlFor = input.id; list.setAttribute('aria-label', label.textContent.trim()); }

    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(input);
    wrap.appendChild(btn);
    wrap.appendChild(list);
    wrap.appendChild(live);
    wrap.appendChild(sel);
    sel.classList.add('cbx-native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    sel._cbx = { input: input, sync: sync, commit: commit, open: function () { show(''); input.focus(); } };

    /* варианты: из option, обогащённые данными выставки */
    function build() {
      items = [];
      Array.prototype.forEach.call(sel.options, function (o) {
        if (!o.value) { return; }
        var e = expoById(o.value);
        if (e) {
          items.push({
            value: o.value, name: e.name, label: e.name,
            meta: [e.dates, e.venue].filter(Boolean).join(' · '),
            hay: norm([e.name, e.industry, e.venue, e.dates, monthWords(e), AKA[e.id] || ''].join(' ')),
            nameHay: norm(e.name)
          });
        } else {
          items.push({ value: o.value, name: o.textContent.trim(), label: o.textContent.trim(), meta: '', hay: norm(o.textContent), nameHay: norm(o.textContent), alt: true });
        }
      });
    }
    function item(value) {
      for (var i = 0; i < items.length; i++) { if (items[i].value === value) { return items[i]; } }
      return null;
    }
    function labelOf(value) {
      if (!value) { return ''; }
      if (value === 'other' && sel.dataset.customName) { return sel.dataset.customName; }
      var it = item(value);
      return it ? it.label : '';
    }
    function sync() {
      if (sel.value !== 'other') { delete sel.dataset.customName; }
      input.value = labelOf(sel.value);
    }
    function search(q) {
      var tokens = norm(q).split(' ').filter(Boolean);
      var regular = items.filter(function (it) { return !it.alt; });
      if (!tokens.length) { return { tokens: [], list: regular }; }
      var found = regular.filter(function (it) {
        return tokens.every(function (t) { return it.hay.indexOf(t) >= 0; });
      });
      var first = tokens[0];
      function rank(it) {
        if (it.nameHay.indexOf(first) === 0) { return 0; }
        if (it.nameHay.indexOf(' ' + first) >= 0) { return 1; }
        if (it.nameHay.indexOf(first) >= 0) { return 2; }
        return 3;
      }
      found = found.map(function (it, i) { return { it: it, r: rank(it), i: i }; })
        .sort(function (a, b) { return a.r - b.r || a.i - b.i; })
        .map(function (x) { return x.it; });
      return { tokens: tokens, list: found };
    }

    function render(q) {
      if (items.length !== sel.querySelectorAll('option[value]:not([value=""])').length) { build(); }
      var res = search(q), html = '', other = item('other'), unknown = item('unknown');
      var text = q.trim();
      shown = res.list.slice();
      if (other) {
        if (text && !res.list.length) {
          shown.push({ value: 'other', alt: true, custom: text, name: '«' + text + '» — нет в списке', meta: 'Укажу дату открытия вручную' });
        } else {
          shown.push({ value: 'other', alt: true, custom: '', name: 'Другая выставка', meta: 'Нет в списке — укажу дату вручную' });
        }
      }
      if (unknown && !text) { shown.push({ value: 'unknown', alt: true, name: unknown.name, meta: 'Подберём выставку вместе' }); }
      if (!res.list.length && text) {
        html += '<li class="cbx__empty" role="presentation">Ничего не нашли по запросу «' + esc(text) + '».</li>';
      }
      shown.forEach(function (it, i) {
        var nm = it.alt ? esc(it.name) : highlight(it.name, res.tokens);
        html += '<li class="cbx__opt' + (it.alt ? ' cbx__opt--alt' : '') + '" role="option" id="' + id + 'Opt' + i + '" data-i="' + i + '" aria-selected="false"><b>' + nm + '</b>' + (it.meta ? '<span>' + esc(it.meta) + '</span>' : '') + '</li>';
      });
      list.innerHTML = html;
      live.textContent = text ? (res.list.length ? 'Найдено вариантов: ' + res.list.length + '.' : 'Совпадений нет. Можно указать другую выставку.') : '';
      var cur = -1;
      if (!text && sel.value) {
        shown.forEach(function (it, i) { if (cur < 0 && it.value === sel.value && !it.custom) { cur = i; } });
      }
      setActive(text && res.list.length ? 0 : cur, true);
    }
    function setActive(i, noScroll) {
      active = i;
      Array.prototype.forEach.call(list.querySelectorAll('.cbx__opt'), function (li) {
        var on = +li.getAttribute('data-i') === i;
        li.setAttribute('aria-selected', String(on));
        if (on && !noScroll && li.scrollIntoView) { li.scrollIntoView({ block: 'nearest' }); }
        if (on && noScroll) { list.scrollTop = Math.max(0, li.offsetTop - 6); }
      });
      if (i >= 0) { input.setAttribute('aria-activedescendant', id + 'Opt' + i); } else { input.removeAttribute('aria-activedescendant'); list.scrollTop = 0; }
    }
    function show(q) {
      render(q);
      list.hidden = false;
      open = true;
      wrap.classList.add('is-open');
      input.setAttribute('aria-expanded', 'true');
    }
    function hide() {
      list.hidden = true;
      open = false;
      wrap.classList.remove('is-open');
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
    function choose(it) {
      var prev = sel.value, prevName = sel.dataset.customName || '';
      if (it.value === 'other' && it.custom) { sel.dataset.customName = it.custom; } else { delete sel.dataset.customName; }
      sel.value = it.value;
      input.value = labelOf(it.value);
      hide();
      if (sel.value !== prev || (sel.dataset.customName || '') !== prevName) {
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    function clear() {
      var prev = sel.value;
      delete sel.dataset.customName;
      sel.value = '';
      if (prev) { sel.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    /* фиксирует введённый текст: точное или единственное совпадение — выбираем; ничего не нашли — «Другая выставка» */
    function commit() {
      var text = input.value.trim();
      if (!text) { clear(); return !!sel.value; }
      if (text === labelOf(sel.value)) { return true; }
      var res = search(text), t = norm(text);
      var exact = res.list.filter(function (it) { return it.nameHay === t; });
      if (exact.length === 1) { choose(exact[0]); return true; }
      if (res.list.length === 1) { choose(res.list[0]); return true; }
      if (!res.list.length && item('other')) { choose({ value: 'other', custom: text }); return true; }
      clear();
      return false;
    }

    build();
    sync();

    input.addEventListener('input', function () { show(input.value); });
    input.addEventListener('focus', function () {
      if (input.value && input.value === labelOf(sel.value)) {
        w.requestAnimationFrame(function () { try { input.select(); } catch (e) { /* noop */ } });
      }
    });
    input.addEventListener('click', function () {
      if (!open) { show(input.value === labelOf(sel.value) ? '' : input.value); }
    });
    input.addEventListener('keydown', function (e) {
      var n = shown.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!open) { show(input.value === labelOf(sel.value) ? '' : input.value); return; }
        if (n) { setActive((active + 1) % n); }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!open) { show(input.value === labelOf(sel.value) ? '' : input.value); return; }
        if (n) { setActive(active <= 0 ? n - 1 : active - 1); }
      } else if (e.key === 'Enter') {
        if (open && active >= 0 && shown[active]) { e.preventDefault(); choose(shown[active]); }
        else if (open) { e.preventDefault(); commit(); hide(); }
        else { commit(); }
      } else if (e.key === 'Escape') {
        if (open) { e.preventDefault(); e.stopPropagation(); hide(); input.value = labelOf(sel.value) || input.value; }
      } else if (e.key === 'Tab') {
        hide();
      }
    });
    input.addEventListener('blur', function () {
      w.setTimeout(function () {
        if (wrap.contains(d.activeElement)) { return; }
        hide();
        commit();
      }, 120);
    });
    /* mousedown не уводит фокус из поля — клик по варианту успевает сработать */
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('.cbx__opt');
      if (!li) { return; }
      choose(shown[+li.getAttribute('data-i')]);
      input.focus();
    });
    list.addEventListener('mousemove', function (e) {
      var li = e.target.closest('.cbx__opt');
      if (li && +li.getAttribute('data-i') !== active) { setActive(+li.getAttribute('data-i'), true); }
    });
    btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    btn.addEventListener('click', function () {
      if (open) { hide(); } else { show(''); }
      input.focus();
    });
    sel.addEventListener('change', function () { if (d.activeElement !== input) { sync(); } });
    d.addEventListener('click', function (e) { if (open && !wrap.contains(e.target)) { hide(); } });
  }

  /* публичные помощники для tools.js и quiz.js */
  CRVU.cbxSync = function (sel) { if (sel && sel._cbx) { sel._cbx.sync(); } };
  CRVU.cbxCommit = function (sel) { return sel && sel._cbx ? sel._cbx.commit() : !!(sel && sel.value); };
  CRVU.cbxFocus = function (sel) {
    if (!sel) { return; }
    if (sel._cbx) { sel._cbx.open(); } else { sel.focus(); }
  };
  CRVU.expoName = function (sel) {
    if (!sel || !sel.value) { return ''; }
    if (sel.value === 'other') { return sel.dataset.customName || ''; }
    var e = expoById(sel.value);
    return e ? e.name : '';
  };

  /* defer-скрипты выполняются при readyState === 'interactive', поэтому ждём DOMContentLoaded:
     к этому моменту tools.js и quiz.js уже заполнили списки выставок */
  var inited = false;
  function init() {
    if (inited) { return; }
    inited = true;
    Array.prototype.forEach.call(d.querySelectorAll('select[data-combobox]'), enhance);
  }
  if (d.readyState === 'complete') { init(); } else { d.addEventListener('DOMContentLoaded', init); w.addEventListener('load', init); }
})(window, document);
