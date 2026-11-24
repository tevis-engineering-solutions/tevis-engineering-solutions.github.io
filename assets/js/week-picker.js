/*
 * Booking week grid, shared by book.html and portal/schedule.html.
 *
 * Shows free days as a calendar: one row per week, Monday first, no horizontal
 * scroll. Weekend columns appear only when a weekend day has times.
 *
 *   TESWeekPicker.days()  -> the `days=` to ask /slots for (through the end of the
 *                            week three weeks out, so whole rows always come back)
 *   TESWeekPicker.render(el, data, activeDay, onPick) -> the day key now selected
 *
 * `data` is the /slots reply ({ days:[{day,count,slots}], closed:[{day,reason}] }).
 */
(function () {
  'use strict';
  var TZ = 'America/New_York';
  var WEEKS = 3;
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  var CSS =
    '.wp{margin-bottom:1.2rem}' +
    '.wp-head{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;margin-bottom:0.7rem;font-family:"Montserrat",sans-serif}' +
    '.wp-month{font-size:0.95rem;font-weight:800;color:#e4ede5}' +
    '.wp-key{font-size:0.7rem;color:#8aa48d}' +
    '.wp-grid{display:grid;grid-template-columns:repeat(var(--wp-cols,5),minmax(0,1fr));gap:0.45rem}' +
    '.wp-dow{text-align:center;font:700 0.66rem "Montserrat",sans-serif;text-transform:uppercase;letter-spacing:0.08em;color:#8aa48d;padding-bottom:0.15rem}' +
    '.wp-cell{position:relative;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;min-height:68px;padding:0.55rem 0.6rem;border-radius:11px;border:1px solid #2c4232;background:#0d1710;color:#8aa48d;font-family:"Montserrat",sans-serif;text-align:left;min-width:0}' +
    'button.wp-cell{cursor:pointer;transition:border-color .15s,transform .15s}' +
    'button.wp-cell:hover{border-color:#4aac65}' +
    'button.wp-cell:focus-visible{outline:2px solid #4aac65;outline-offset:2px}' +
    '.wp-n{font-size:1.05rem;font-weight:800;color:#e4ede5;line-height:1.1}' +
    '.wp-n small{font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-right:0.25rem;color:inherit}' +
    '.wp-c{font-size:0.66rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}' +
    'button.wp-cell .wp-c{color:#6dc882;font-weight:600}' +
    '.wp-cell.off{background:transparent;border-style:dashed;border-color:rgba(44,66,50,0.6)}' +
    '.wp-cell.off .wp-n{color:#4c6150}' +
    '.wp-cell.off .wp-c{color:#4c6150}' +
    '.wp-cell.closed{border-color:rgba(200,152,48,0.35)}' +
    '.wp-cell.closed .wp-c{color:#c89830}' +
    '.wp-cell.today::after{content:"";position:absolute;top:0.55rem;right:0.6rem;width:6px;height:6px;border-radius:50%;background:#4aac65}' +
    '.wp-cell.on{background:linear-gradient(135deg,#c89830,#e0b840);border-color:transparent}' +
    '.wp-cell.on .wp-n,.wp-cell.on .wp-c{color:#0d1710}' +
    '.wp-cell.on.today::after{background:#0d1710}' +
    '.wp-c .wp-long{display:inline}.wp-c .wp-short{display:none}' +
    '@media (max-width:520px){.wp-grid{gap:0.35rem}.wp-cell{min-height:60px;padding:0.4rem 0.35rem;align-items:center;text-align:center}.wp-n{font-size:0.95rem;text-align:center}.wp-n small{display:block;font-size:0.52rem;margin:0 0 0.05rem}.wp-c{font-size:0.6rem;overflow:visible}.wp-c .wp-long{display:none}.wp-c .wp-short{display:inline}.wp-key{display:none}.wp-cell.today::after{top:0.35rem;right:0.35rem;width:5px;height:5px}}';

  function injectCss() {
    if (document.getElementById('wpCss')) return;
    var s = document.createElement('style'); s.id = 'wpCss'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  // Today in Cleveland, as a UTC-noon Date so day arithmetic never trips on DST.
  function today() {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, 12));
  }
  function key(d) { return d.toISOString().slice(0, 10); }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function monIndex(d) { return (d.getUTCDay() + 6) % 7; }
  function monthName(d, long) { return d.toLocaleDateString('en-US', { month: long ? 'long' : 'short', timeZone: 'UTC' }); }

  function days() {
    var t = today();
    return (7 - monIndex(t)) + WEEKS * 7;
  }

  function render(root, data, activeDay, onPick) {
    injectCss();
    root.textContent = '';
    root.classList.add('wp');
    root.removeAttribute('role');
    var list = (data && data.days) || [];
    var byDay = {}; list.forEach(function (d) { byDay[d.day] = d; });
    var closed = {}; ((data && data.closed) || []).forEach(function (c) { closed[c.day] = c.reason; });

    var t = today(), todayKey = key(t);
    var monday = addDays(t, -monIndex(t));
    // Build WEEKS + 1 weeks, drop leading weeks with nothing free, keep WEEKS.
    var weeks = [];
    for (var w = 0; w <= WEEKS; w++) {
      var row = [];
      for (var i = 0; i < 7; i++) row.push(addDays(monday, w * 7 + i));
      weeks.push(row);
    }
    while (weeks.length > WEEKS && !weeks[0].some(function (d) { return byDay[key(d)]; })) weeks.shift();
    weeks = weeks.slice(0, WEEKS);

    if (!list.length) return null;
    if (!byDay[activeDay]) activeDay = list[0].day;

    var weekend = weeks.some(function (r) { return byDay[key(r[5])] || byDay[key(r[6])]; });
    var cols = weekend ? 7 : 5;

    var first = weeks[0][0], last = weeks[weeks.length - 1][cols - 1];
    var head = el('div', 'wp-head');
    var title = monthName(first, true) + (first.getUTCMonth() !== last.getUTCMonth() ? ' – ' + monthName(last, true) : '') + ' ' + last.getUTCFullYear();
    head.appendChild(el('span', 'wp-month', title));
    head.appendChild(el('span', 'wp-key', 'Pick a day, then a time'));
    root.appendChild(head);

    var grid = el('div', 'wp-grid');
    grid.style.setProperty('--wp-cols', cols);
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Choose a day');
    for (var c = 0; c < cols; c++) grid.appendChild(el('span', 'wp-dow', DOW[c]));

    var prevMonth = null;
    weeks.forEach(function (row) {
      row.slice(0, cols).forEach(function (d) {
        var k = key(d), info = byDay[k], reason = closed[k];
        var cell = el(info ? 'button' : 'div', 'wp-cell' + (info ? '' : ' off') + (reason ? ' closed' : '') + (k === todayKey ? ' today' : '') + (info && k === activeDay ? ' on' : ''));
        var n = el('span', 'wp-n');
        if (prevMonth === null || d.getUTCMonth() !== prevMonth) n.appendChild(el('small', null, monthName(d)));
        n.appendChild(document.createTextNode(String(d.getUTCDate())));
        prevMonth = d.getUTCMonth();
        cell.appendChild(n);
        var full = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
        var cnt = el('span', 'wp-c');
        if (info) {
          cnt.appendChild(el('span', 'wp-long', info.count + (info.count === 1 ? ' time' : ' times')));
          cnt.appendChild(el('span', 'wp-short', info.count + ' free'));
          cell.type = 'button';
          cell.setAttribute('aria-pressed', k === activeDay ? 'true' : 'false');
          cell.setAttribute('aria-label', full + ', ' + info.count + ' times free');
          cell.addEventListener('click', function () { onPick(k); });
        } else if (reason) {
          cnt.appendChild(el('span', 'wp-long', reason));
          cnt.appendChild(el('span', 'wp-short', 'Closed'));
          cell.title = 'Closed for ' + reason;
          cell.setAttribute('aria-label', full + ', closed for ' + reason);
        } else {
          cnt.textContent = '—';
          cell.setAttribute('aria-label', full + ', no times');
        }
        cell.appendChild(cnt);
        grid.appendChild(cell);
      });
    });
    root.appendChild(grid);
    return activeDay;
  }

  window.TESWeekPicker = { days: days, render: render };
})();
