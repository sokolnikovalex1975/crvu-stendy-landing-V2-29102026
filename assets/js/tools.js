/*!
 * ЦРВУ — инструменты: калькулятор-ориентир и планировщик сроков.
 * Данные и коэффициенты берутся из CRVU_DATA (assets/js/data.js).
 */
(function (w, d) {
  'use strict';

  var CRVU = w.CRVU, D = w.CRVU_DATA;
  var $ = CRVU.$, $$ = CRVU.$$;
  var nb = CRVU.nb, esc = CRVU.esc;
  if (!D) { return; }

  var PHONE = '+7 (495) 106-70-22';
  var ARROW = '<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg>';

  /* ================================================================== калькулятор (вариант V1-29102026)
     Модель «Стандарт» по данным заказчика: стенд от 900 000 ₽; ~50 000 ₽/м² при 50 м²; ~45 000 ₽/м² при 100 м².
     Формула: база = fixed + perM2 × S × kType; не меньше minTotal. Верхняя граница = база × (1 + spread).
     «Эксклюзив», «Премиум» и надбавки — предварительные, ждут подтверждения ЦРВУ. */
  (function calc() {
    var form = $('#calcForm');
    if (!form) { return; }
    var C = D.calculator;
    var area = $('#cArea'), range = $('#cAreaRange'), led = $('#cLed'), ledWrap = $('#cLedWrap'), ledOut = $('#cLedQty');
    var empty = $('#calcEmpty'), out = $('#calcOut'), val = $('#calcVal'), sub = $('#calcSub'), rows = $('#calcRows'), svcBox = $('#calcSvc');
    var fail = $('#calcFail'), toQuiz = $('#calcToQuiz'), pdfBtn = $('#calcPdfBtn');
    var floor2 = form.querySelector('[name=cfloor2]'), floorWrap = $('#cFloorWrap'), floorArea = $('#cFloorArea');
    var qty = 1, last = null;

    CRVU.autoClear(form);

    function radio(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }
    function on(name) { var c = form.querySelector('input[name="' + name + '"]'); return !!(c && c.checked); }
    function parseArea(v) {
      var s = String(v).replace(/\s/g, '').replace(',', '.');
      if (!/^\d+(\.\d+)?$/.test(s)) { return NaN; }
      return parseFloat(s);
    }
    function rnd(n) { return Math.round(n / C.round) * C.round; }
    function money(n) { return CRVU.fmtNum(n) + '\u00a0₽'; }
    function services() { return $$('input[name="csvc"]:checked', form).map(function (i) { return i.value; }); }

    function read(showErrors) {
      var S = parseArea(area.value), msg = '';
      if (!area.value.trim()) { msg = ''; S = NaN; }
      else if (!isFinite(S) || S <= 0) { msg = 'Введите площадь стенда в м², например 36.'; }
      else if (S < C.areaMin) { msg = 'Минимальная площадь для расчёта — ' + C.areaMin + ' м².'; }
      else if (S > C.areaMax) { msg = 'Для стендов больше ' + C.areaMax + ' м² считаем индивидуально — пришлите план площадки.'; }
      if (msg) { if (showErrors) { CRVU.showErr(area, msg); } return null; }
      CRVU.clearErr(area);
      if (!isFinite(S)) { return null; }
      var F = 0;
      if (on('cfloor2')) {
        F = parseArea(floorArea.value);
        if (!floorArea.value.trim()) { F = 0; CRVU.clearErr(floorArea); }
        else if (!isFinite(F) || F <= 0 || F > S) { if (showErrors) { CRVU.showErr(floorArea, 'Площадь второго этажа: больше 0 и не больше площади стенда.'); } F = 0; }
        else { CRVU.clearErr(floorArea); }
      }
      return { S: S, level: radio('clevel') || 'standard', type: radio('ctype') || 'linear', floor2: on('cfloor2'), floorArea: F, susp: on('csusp'), urgent: on('curgent'), led: led.checked ? qty : 0, svc: services() };
    }

    function compute(s) {
      var lv = C.levels[s.level], kT = C.types[s.type].k;
      var base = Math.max(C.minTotal, lv.fixed + lv.perM2 * s.S * kT);
      var lo = base, hi = base * (1 + lv.spread), parts = [];
      parts.push(['Стенд ' + CRVU.fmtArea(s.S) + ' м² · ' + lv.label, rnd(lo), rnd(hi)]);
      if (s.floor2) {
        var F = s.floorArea || Math.round(s.S * C.floor2.assumeShare);
        var fLo = F * lv.perM2 * C.floor2.min, fHi = F * lv.perM2 * C.floor2.max;
        lo += fLo; hi += fHi; parts.push(['Второй этаж' + (s.floorArea ? ', ' + CRVU.fmtArea(F) + ' м²' : ' (≈' + CRVU.fmtArea(F) + ' м²)'), rnd(fLo), rnd(fHi)]);
      }
      if (s.susp) { lo += base * C.suspended.min; hi += base * C.suspended.max; parts.push(['Подвесные конструкции', rnd(base * C.suspended.min), rnd(base * C.suspended.max)]); }
      if (s.led) { lo += s.led * C.ledPrice; hi += s.led * C.ledPriceMax; parts.push(['LED-экраны × ' + s.led, s.led * C.ledPrice, s.led * C.ledPriceMax]); }
      if (s.urgent) { lo += base * C.urgency.min; hi += base * C.urgency.max; parts.push(['Срочное производство', rnd(base * C.urgency.min), rnd(base * C.urgency.max)]); }
      lo = rnd(lo); hi = rnd(hi);
      if (!isFinite(lo) || !isFinite(hi) || lo <= 0 || hi < lo) { throw new Error('calc'); }
      return { lo: lo, hi: lv.openEnded ? null : hi, perLo: Math.round(lo / s.S / 1000) * 1000, perHi: Math.round(hi / s.S / 1000) * 1000, parts: parts };
    }

    function render(s, r) {
      val.innerHTML = r.hi === null
        ? 'от ' + esc(money(r.lo)) + '<small>верхняя граница — по проекту</small>'
        : esc(money(r.lo)) + ' — ' + esc(money(r.hi)) + '<small>≈ ' + esc(CRVU.fmtNum(r.perLo)) + (r.perHi !== r.perLo ? '–' + esc(CRVU.fmtNum(r.perHi)) : '') + '\u00a0₽ за м²</small>';
      sub.textContent = nb(C.types[s.type].label + ' стенд, ' + CRVU.fmtArea(s.S) + ' м², уровень «' + C.levels[s.level].label + '»');
      rows.innerHTML = r.parts.map(function (p) {
        return '<div><dt>' + esc(nb(p[0])) + '</dt><dd>' + (p[1] === p[2] ? esc(money(p[1])) : esc(CRVU.fmtNum(p[1]) + ' – ' + money(p[2]))) + '</dd></div>';
      }).join('');
      svcBox.hidden = !s.svc.length;
      svcBox.textContent = s.svc.length ? nb('Посчитаем отдельно: ' + s.svc.join(', ').toLowerCase() + '.') : '';
      empty.hidden = true;
      out.hidden = false;
    }

    function labels(s) {
      var x = [];
      if (s.floor2) { x.push('Второй этаж'); }
      if (s.susp) { x.push('Подвесные конструкции'); }
      if (s.led) { x.push('LED-экраны'); }
      if (s.urgent) { x.push('Срочно'); }
      return x.concat(s.svc);
    }

    function run(showErrors, silent) {
      fail.hidden = true;
      var s = read(showErrors);
      if (!s) { empty.hidden = false; out.hidden = true; last = null; CRVU.calcState = null; syncBtns(); return; }
      try {
        var r = compute(s);
        render(s, r);
        last = { S: s.S, type: s.type, level: s.level, extras: labels(s), ledCount: s.led, floorArea: s.floorArea, lo: r.lo, hi: r.hi,
          typeLabel: C.types[s.type].label, levelLabel: C.levels[s.level].label, demonstration: !(w.CRVU_CONFIG || {}).pricingVerified };
        CRVU.calcState = last;
        if (!silent) { CRVU.trackOnce('calc_result'); }
      } catch (err) {
        fail.textContent = nb('Не удалось показать ориентир. Пришлите план площадки — посчитаем вручную.');
        fail.hidden = false;
      }
      syncBtns();
    }
    function syncBtns() { toQuiz.disabled = false; pdfBtn.disabled = !last; }

    /* площадь: поле ↔ ползунок ↔ быстрые кнопки */
    function paintRange() {
      var p = (range.value - range.min) / (range.max - range.min) * 100;
      range.style.setProperty('--p', p + '%');
      $$('.qchip', form).forEach(function (b) { b.classList.toggle('is-on', String(parseArea(area.value)) === b.getAttribute('data-area')); });
    }
    area.addEventListener('input', function () {
      var S = parseArea(area.value);
      if (isFinite(S)) { range.value = Math.max(+range.min, Math.min(+range.max, Math.round(S))); }
      paintRange(); run(false);
    });
    area.addEventListener('blur', function () { run(true); });
    range.addEventListener('input', function () { area.value = range.value; CRVU.clearErr(area); paintRange(); run(false); });
    form.addEventListener('click', function (e) {
      var b = e.target.closest('.qchip');
      if (!b) { return; }
      area.value = b.getAttribute('data-area'); range.value = area.value; CRVU.clearErr(area); paintRange(); run(false);
    });
    form.addEventListener('change', function (e) { if (e.target !== area) { run(false); } });
    form.addEventListener('submit', function (e) { e.preventDefault(); run(true); });
    ['input', 'change', 'focusin'].forEach(function (ev) { form.addEventListener(ev, function () { CRVU.trackOnce('calc_start'); }); });

    /* второй этаж и LED */
    function syncFloor() { floorWrap.hidden = !floor2.checked; }
    floor2.addEventListener('change', syncFloor);
    floorArea.addEventListener('input', function () { run(false); });
    function syncLed() { ledWrap.hidden = !led.checked; ledOut.textContent = String(qty); }
    led.addEventListener('change', syncLed);
    ledWrap.addEventListener('click', function (e) {
      var b = e.target.closest('[data-step]');
      if (!b) { return; }
      qty = Math.max(1, Math.min(C.ledMax, qty + parseInt(b.getAttribute('data-step'), 10)));
      syncLed(); run(false);
    });

    /* переход к заявке с параметрами расчёта */
    toQuiz.addEventListener('click', function () {
      if (!last) { CRVU.openQuiz({}, 'calculator'); return; }
      CRVU.openQuiz({ area: last.S, type: last.type, calc: last }, 'calculator');
    });
    pdfBtn.addEventListener('click', function () { if (!last) { return; } w.open('calculation.html#' + encodeURIComponent(JSON.stringify(last)), '_blank', 'noopener'); });

    syncFloor(); syncLed(); paintRange(); syncBtns();
    if (area.value.trim()) { run(false, true); }
  })();

  /* ================================================================== планировщик сроков */
  var Planner = (CRVU.planner = {});

  function iso(s) { return s ? CRVU.parseISO(s) : null; }
  function period(e) { return String(e.dates).replace(/\s*\(.*?\)\s*/g, '').trim(); }
  function expoById(id) { for (var i = 0; i < D.expos.length; i++) { if (D.expos[i].id === id) { return D.expos[i]; } } return null; }

  /* Модель сроков (см. README): комфортный старт = открытие − 3 месяца; стандартный = первый день монтажа − 6 недель;
     подача документов = монтаж − N рабочих дней (Крокус Экспо 14, Тимирязев Центр 15, иначе не показываем);
     последний старт без наценки = подача документов − 5 рабочих дней; предел экспресса = открытие − 13 дней.
     Праздничные и перенесённые дни не учитываются. */
  function model(open, venueKey, setupISO) {
    var M = D.model, V = D.venues[venueKey] || D.venues.other;
    var assumed = !setupISO;
    var first = setupISO ? iso(setupISO) : CRVU.addDays(open, -M.setupOffsetDays);
    var docs = V.docBdays ? CRVU.subBdays(first, V.docBdays) : null;
    return {
      open: open, first: first, assumed: assumed, rule: V.docBdays || null, venueLabel: V.label,
      comfortable: CRVU.addMonths(open, -M.comfortableMonths),
      standard: CRVU.addDays(first, -M.standardWeeks * 7),
      docs: docs,
      latest: docs ? CRVU.subBdays(docs, M.latestMinusBdays) : null,
      express: CRVU.addDays(open, -(M.expressDays + 1))
    };
  }

  /* даты выставки из списка: берём предрассчитанные значения из data.js; для остальных — модель */
  Planner.get = function (id) {
    var e = expoById(id);
    if (!e || !e.planner || !e.open) { return null; }
    var p=e.planner||{},setup=/^допущение/.test(p.first_setup_day_basis||'')?null:p.first_setup_day;var result=model(iso(e.open),e.venueKey,setup);result.expo=e;result.close=iso(e.close);result.venueLabel=e.venue;return result;
  };
  Planner.model = model;

  /* статус относительно сегодняшней даты: { kind: ok | warn | hot | late | call | gone, text } */
  Planner.status = function (P, today) {
    var t = today.getTime(), fd = CRVU.fmtDateLong;
    if (t > (P.close || P.open).getTime()) { return { kind: 'gone', text: 'Эта выставка уже прошла. Выберите следующую в списке.' }; }
    if (t >= P.open.getTime()) { return { kind: 'gone', text: 'Выставка уже открыта. Выберите следующую или позвоните: ' + PHONE + '.' }; }
    if (t > P.express.getTime()) { return { kind: 'call', text: 'До открытия меньше 12 дней. Позвоните: ' + PHONE + '. Рассмотрим подключение в экстренном порядке.' }; }
    if (P.latest) {
      if (t > P.latest.getTime()) { return { kind: 'late', text: (P.docs&&t<=P.docs.getTime()?'Рекомендуемый срок брифа прошёл; подготовку документов планируем до '+fd(P.docs)+'. Менеджер проверит возможность успеть.':'Рекомендуемый срок подготовки документов прошёл. Это не нормативный дедлайн площадки: уточним условия по руководству участника.') }; }
      if (t > P.standard.getTime()) {
        var n = CRVU.dayDiff(new Date(t), P.latest);
        if (n === 0) { return { kind: 'hot', text: 'Сегодня рекомендуемый день старта: ' + fd(P.latest) + '. Пришлите план площадки сейчас.' }; }
        return { kind: 'hot', text: 'До рекомендуемого старта осталось ' + n + ' ' + CRVU.plural(n, ['день', 'дня', 'дней']) + ': ' + fd(P.latest) + '. Пришлите план площадки сегодня.' };
      }
    } else if (t > P.standard.getTime()) {
      return { kind: 'late', text: 'Стандартный срок прошёл. Возможен экспресс-режим: пришлите план площадки, и мы проверим, успеваем ли.' };
    }
    if (t > P.comfortable.getTime()) {
      var m = CRVU.dayDiff(new Date(t), P.standard);
      if (m === 0) { return { kind: 'warn', text: 'Комфортный срок прошёл. Сегодня последний день стандартного старта: ' + fd(P.standard) + '.' }; }
      return { kind: 'warn', text: 'Комфортный срок прошёл. Стандартный старт: до ' + fd(P.standard) + '. Осталось ' + m + ' ' + CRVU.plural(m, ['день', 'дня', 'дней']) + '.' };
    }
    return { kind: 'ok', text: 'Время есть. Лучше начать до ' + fd(P.comfortable) + ': так остаётся запас на согласование проекта.' };
  };

  Planner.hint = function (id) {
    var P = Planner.get(id);
    if (!P) {
      var e = expoById(id);
      if (e && !e.open) { return { kind: 'wait', text: 'Организатор пока указал только ' + period(e) + '. Покажем сроки, когда он опубликует точные даты.' }; }
      return null;
    }
    return Planner.status(P, CRVU.todayUTC());
  };

  function timeline(P, today) {
    var T = today.getTime(), items = [];
    function add(key, date, end, title, sub, cls) { items.push({ key: key, date: date, end: end || null, title: title, sub: sub, cls: cls || '' }); }
    add('comfort', P.comfortable, null, 'Комфортный старт', 'За 3 месяца до открытия. Остаётся запас на согласование проекта.', 'is-key');
    add('standard', P.standard, null, 'Стандартный старт', 'За 6 недель до первого дня монтажа.');
    if (P.latest) { add('latest', P.latest, null, 'Рекомендуемый день брифа', 'Оставляем 5 рабочих дней на согласование 3D и чертежей до рекомендованной даты документов.', 'is-key'); }
    if (P.docs) { add('docs', P.docs, null, 'Рекомендуемая готовность документов', 'Плановый запас '+P.rule+' рабочих дней до монтажа. Не норматив площадки; требование сверяется по руководству участника.'); }
    if (P.docs) {
      var ps = CRVU.addDays(P.docs, 1), pe = CRVU.addDays(P.first, -1);
      if (ps.getTime() <= pe.getTime()) { add('prod', ps, pe, 'Производство и логистика', 'Конструкции делаем в цеху и доставляем на площадку к монтажу.'); }
    }
    var setupEnd = CRVU.addDays(P.open, -2);
    add('setup', P.first, setupEnd.getTime() > P.first.getTime() ? setupEnd : null, 'Монтаж на площадке', 'Сам монтаж занимает 2–3 дня. Дата первого дня монтажа ' + (P.assumed ? 'принята ориентировочно.' : 'указана организатором.'));
    add('handover', CRVU.addDays(P.open, -1), null, 'Сдача стенда', 'Сдаём накануне открытия и передаём фото- и видеоотчёт.', 'is-key');
    add('open', P.open, null, 'Открытие выставки', (P.expo?'Выставка работает '+P.expo.dates+'.':'Дата открытия указана вами; длительность выставки уточняется отдельно.'), 'is-open');
    add('express', P.express, null, 'Проверка срочного режима', 'Срочный режим возможен не для любого проекта. Проверяем объём и готовность допуска; это не обещание даты сдачи.', 'is-dash');
    items.sort(function (a, b) { return a.date.getTime() - b.date.getTime(); });

    var nextSet = false, html = '', todayDone = false;
    function todayRow() {
      return '<li class="tl__i tl__i--today"><div class="tl__d">' + CRVU.fmtDate(today) + '<small>сегодня</small></div><div class="tl__n" aria-hidden="true"></div><div class="tl__b"><span class="tl__t">Сегодня</span></div></li>';
    }
    items.forEach(function (it) {
      var dt = it.date.getTime(), endT = (it.end || it.date).getTime();
      var past = endT < T, cls = it.cls;
      if (!todayDone && dt >= T) { html += todayRow(); todayDone = true; }
      if (past) { cls += ' is-past'; }
      else if (!nextSet && it.key !== 'express') { cls += ' is-next'; nextSet = true; }
      var n = CRVU.dayDiff(today, it.date);
      var chip = past ? 'прошло' : (dt <= T ? 'идёт сейчас' : 'через ' + n + ' ' + CRVU.plural(n, ['день', 'дня', 'дней']));
      var small = it.end ? 'по ' + CRVU.fmtDate(it.end).slice(0, 5) : CRVU.weekday(it.date);
      html += '<li class="tl__i ' + cls + '"><div class="tl__d">' + CRVU.fmtDate(it.date) + '<small>' + small + '</small></div>' +
        '<div class="tl__n" aria-hidden="true"></div><div class="tl__b"><span class="tl__t">' + esc(it.title) + '</span>' +
        '<span class="tl__s">' + esc(it.sub) + '</span><span class="tl__c">' + chip + '</span></div></li>';
    });
    if (!todayDone) { html += todayRow(); }
    return { items: items, html: html };
  }

  function ics(P, name, id, items, today) {
    var CR = '\r\n', stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    function esc2(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
    function fold(line) {
      var out = '', cur = '', bytes = 0;
      for (var i = 0; i < line.length; i++) {
        var ch = line.charAt(i), b = unescape(encodeURIComponent(ch)).length;
        if (bytes + b > 72) { out += cur + CR + ' '; cur = ''; bytes = 1; }
        cur += ch; bytes += b;
      }
      return out + cur;
    }
    var keep = { comfort: 1, standard: 1, latest: 1, docs: 1, setup: 1, open: 1 };
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CRVU//Planner//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    items.forEach(function (it) {
      if (!keep[it.key]) { return; }
      if ((it.end || it.date).getTime() < today.getTime()) { return; }
      var endEx = CRVU.addDays(it.end || it.date, 1);
      lines.push('BEGIN:VEVENT', 'UID:' + id + '-' + it.key + '@stendy.crvu.ru', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + CRVU.toICS(it.date), 'DTEND;VALUE=DATE:' + CRVU.toICS(endEx),
        'SUMMARY:' + esc2(name + ': ' + it.title),
        'DESCRIPTION:' + esc2(it.sub + ' Ориентировочный расчёт ЦРВУ. Телефон ' + PHONE + ', manager@crvu.ru.'),
        'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.map(fold).join(CR) + CR;
  }

  (function planner() {
    var form = $('#planForm');
    if (!form) { return; }
    var sel = $('#pExpo'), custom = $('#pCustom'), dateInp = $('#pDate'), vWrap = $('#pVenueWrap'), vSel = $('#pVenue');
    var empty = $('#planEmpty'), out = $('#planOut');
    var current = null;

    D.expos.forEach(function (e) {
      var o = d.createElement('option');
      o.value = e.id;
      o.textContent = e.name + ' — ' + e.dates + ' · ' + e.venue;
      sel.appendChild(o);
    });
    var other = d.createElement('option');
    other.value = 'other';
    other.textContent = 'Другая выставка';
    sel.appendChild(other);

    CRVU.autoClear(form);
    var today0 = CRVU.todayUTC();
    dateInp.min = today0.getUTCFullYear() + '-' + ('0' + (today0.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + today0.getUTCDate()).slice(-2);

    function show(html) { empty.hidden = true; out.innerHTML = html; out.hidden = false; }
    function clear() { out.hidden = true; out.innerHTML = ''; empty.hidden = false; current = null; }

    function build(P, name, metaTop, badge, st, notes, today) {
      var tl = timeline(P, today);
      var daysTo = CRVU.dayDiff(today, P.open);
      var meta = metaTop + (daysTo > 0 ? ' До открытия ' + daysTo + ' ' + CRVU.plural(daysTo, ['день', 'дня', 'дней']) + '.' : '');
      var badgeHtml = badge ? '<span class="badge badge--ok">Даты подтверждены</span>' : '<span class="badge badge--wait">Даты уточняются</span>';
      var note = P.expo
        ? 'Даты выставок взяты с сайтов организаторов, проверены ' + CRVU.fmtDate(CRVU.parseISO(D.asOf)) + '. Организаторы могут менять даты и площадки. Правила подачи документов уточняйте в руководстве участника вашей выставки.'
        : 'Расчёт построен по указанной вами дате открытия. Организаторы могут менять даты и площадки. Правила подачи документов уточняйте в руководстве участника вашей выставки.';
      return '<div class="plan__head"><div><h3 class="plan__name">' + esc(name) + '</h3><p class="plan__meta">' + esc(meta) + '</p></div>' + badgeHtml + '</div>' +
        '<div class="plan__status' + (st.kind === 'hot' || st.kind === 'call' ? ' plan__status--hot' : '') + '" role="status"><p class="mono">Статус на ' + CRVU.fmtDate(today) + '</p><p>' + esc(st.text) + '</p></div>' +
        '<ol class="tl" aria-label="Ключевые даты">' + tl.html + '</ol>' +
        (notes.length ? '<p class="plan__ass">' + notes.map(esc).join(' ') + '</p>' : '') +
        '<p class="plan__note">' + esc(note) + '</p>' +
        '<div class="plan__act"><button class="btn btn--line" type="button" data-plan-ics><svg class="ico" aria-hidden="true"><use href="#i-cal"/></svg> Добавить даты в календарь (.ics)</button>' +
        '<button class="btn btn--accent" type="button" data-plan-quote>Запросить смету к этой выставке ' + ARROW + '</button></div>';
    }

    function run(byUser) {
      var id = sel.value, today = CRVU.todayUTC();
      custom.hidden = vWrap.hidden = id !== 'other';
      if (!id) { clear(); return; }
      var P, name, metaTop, confirmed, notes = [], st;
      if (id === 'other') {
        var v = dateInp.value;
        if (!v) { clear(); if (byUser === 'submit') { CRVU.showErr(dateInp, 'Укажите дату открытия выставки.'); dateInp.focus(); } return; }
        var open = CRVU.parseISO(v);
        if (open.getTime() <= today.getTime()) { clear(); CRVU.showErr(dateInp, 'Укажите будущую дату открытия выставки.'); return; }
        CRVU.clearErr(dateInp);
        P = model(open, vSel.value, null);
        P.expo = null; P.close = null;
        name = sel.dataset.customName || 'Другая выставка';
        metaTop = 'Открытие ' + CRVU.fmtDateLong(open) + ' · ' + P.venueLabel + '.';
        confirmed = false;
        notes.push('Дату открытия вы указали сами: проверьте её на сайте организатора.');
        current = { id: 'other-' + v, name: sel.dataset.customName || 'Выставка', P: P, tl: null, qp: { expo: 'other', expoName: sel.dataset.customName || '', date: v, venueLabel: P.venueLabel === 'Другая площадка' ? '' : P.venueLabel } };
      } else {
        var e = expoById(id);
        P = Planner.get(id);
        if (!P) {
          /* даты не опубликованы организатором */
          show('<div class="plan__head"><div><h3 class="plan__name">' + esc(e.name) + '</h3><p class="plan__meta">' + esc(e.dates + ' · ' + e.venue) + '</p></div><span class="badge badge--wait">Даты уточняются</span></div>' +
            '<div class="plan__status" role="status"><p class="mono">Статус на ' + CRVU.fmtDate(today) + '</p><p>' + esc('Организатор пока указал только ' + period(e) + '. Покажем сроки, когда он опубликует точные даты.') + '</p></div>' +
            '<div class="plan__act"><button class="btn btn--accent" type="button" data-plan-quote>Запросить смету к этой выставке ' + ARROW + '</button></div>');
          current = { id: id, name: e.name, P: null, tl: null, qp: { expo: id, venueLabel: e.venue } };
          if (byUser) { CRVU.track('planner_select', { expo: id }); }
          return;
        }
        name = e.name;
        metaTop = e.dates + ' · ' + e.venue + (e.pavilion ? ', ' + e.pavilion : '') + '.';
        confirmed = e.confirmed;
        current = { id: id, name: e.name, P: P, qp: { expo: id, venueLabel: e.venue } };
      }
      if (P.assumed) { notes.push('Первый день монтажа организатор пока не публикует: считаем ориентировочно за ' + D.model.setupOffsetDays + ' дней до открытия.'); }
      if (!P.docs) { notes.push('Нормативный срок документов зависит от руководства участника. Показанные даты являются рекомендациями, а не гарантией отсутствия наценки.'); }
      st = Planner.status(P, today);
      if (st.kind === 'gone') {
        show('<div class="plan__head"><div><h3 class="plan__name">' + esc(name) + '</h3><p class="plan__meta">' + esc(metaTop) + '</p></div></div><div class="plan__status" role="status"><p>' + esc(st.text) + '</p></div>');
        current = null;
        return;
      }
      show(build(P, name, metaTop, confirmed, st, notes, today));
      current.tl = timeline(P, today);
      if (byUser) { CRVU.track('planner_select', { expo: id }); }
    }

    sel.addEventListener('change', function () {
      CRVU.clearErr(dateInp);
      run(true);
    });
    dateInp.addEventListener('change', function () { run(true); });
    vSel.addEventListener('change', function () { run(false); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (CRVU.cbxCommit) { CRVU.cbxCommit(sel); }
      if (!sel.value) { if (CRVU.cbxFocus) { CRVU.cbxFocus(sel); } else { sel.focus(); } return; }
      run('submit');
    });

    out.addEventListener('click', function (e) {
      if (!current) { return; }
      if (e.target.closest('[data-plan-quote]')) {
        var q = current.qp || {};
        var c = 'Нужна смета к выставке: ' + (current.P && current.P.expo ? current.P.expo.name + ' (' + current.P.expo.dates + ')' : current.name) + '.';
        if (current.P && !current.P.expo) { c = 'Нужна смета к выставке ' + (q.expoName ? '«' + q.expoName + '» ' : '') + 'с датой открытия ' + CRVU.fmtDateLong(current.P.open) + '.'; }
        CRVU.openQuiz({ expo: q.expo, expoName: q.expoName, date: q.date, venueLabel: q.venueLabel, comment: c }, 'planner');
        return;
      }
      if (e.target.closest('[data-plan-ics]') && current.P && current.tl) {
        var text = ics(current.P, current.P.expo ? current.name : (current.name || 'Выставка'), current.id, current.tl.items, CRVU.todayUTC());
        var blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
        var url = URL.createObjectURL(blob), a = d.createElement('a');
        a.href = url; a.download = 'crvu-srok-' + current.id + '.ics';
        d.body.appendChild(a); a.click(); d.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        CRVU.track('planner_ics', { expo: current.id });
      }
    });
  })();
})(window, document);
