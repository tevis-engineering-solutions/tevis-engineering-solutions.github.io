/* Coverage table on cleveland-crime-map.html, read from the live feed.
 *
 * The table is baked into the page with the numbers current at the last edit, so it reads
 * correctly with no JavaScript and when the feed is unreachable. When agencies.json
 * answers, the rows and the note are rebuilt from it, so the page says what the map says
 * without anyone editing HTML after a nightly refresh. Everything is built with
 * createElement and textContent; nothing from the feed is treated as markup.
 */
(function () {
  'use strict';
  var FEED = 'https://map.tevisengineering.com/feeds/agencies.json';
  var body = document.getElementById('covBody');
  var note = document.getElementById('covNote');
  if (!body || !note || typeof fetch !== 'function') return;

  function ym(iso) { return iso && iso.length >= 7 ? iso.slice(0, 7) : '—'; }
  function cell(text, cls) {
    var td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = text;
    return td;
  }

  var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);

  fetch(FEED, { signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('feed ' + r.status); return r.json(); })
    .then(function (d) {
      var list = Array.isArray(d && d.agencies) ? d.agencies.filter(function (a) { return a && a.public !== false; }) : [];
      if (!list.length) return;
      list.sort(function (a, b) { return (b.count || 0) - (a.count || 0); });

      var frag = document.createDocumentFragment();
      var total = 0;
      list.forEach(function (a) {
        var tr = document.createElement('tr');
        tr.appendChild(cell(String(a.short_name || a.name || a.key || '')));
        tr.appendChild(cell(Number(a.count || 0).toLocaleString('en-US'), 'num'));
        var range = a.range || {};
        tr.appendChild(cell(ym(range.start) + ' → ' + ym(range.end)));
        frag.appendChild(tr);
        total += Number(a.count || 0);
      });
      body.textContent = '';
      body.appendChild(frag);

      note.textContent = '';
      var b = document.createElement('b');
      b.textContent = total.toLocaleString('en-US') + ' reports';
      note.appendChild(b);
      var built = typeof d.generated === 'string' ? d.generated.slice(0, 10) : '';
      note.appendChild(document.createTextNode(' across ' + list.length + ' departments.' + (built ? ' Feed built ' + built + '.' : '')));
    })
    .catch(function () { /* the baked-in table stands */ })
    .then(function () { clearTimeout(timer); });
})();
