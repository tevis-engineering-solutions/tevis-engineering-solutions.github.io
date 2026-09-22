/* The portal app shell, shared by every page under /portal/.
 *
 * Two things every portal page needs and none of them should carry its own copy of:
 * the gold dots that say what is waiting on the customer, and the announcement
 * banner. Plus sign-out, which ends the app-level session in the portal Worker.
 *
 * This lived inline on all ten pages until Session 51. Nine of the ten were
 * byte-identical; the tenth had drifted, which is exactly the failure this file
 * exists to prevent.
 *
 * Loaded with `defer` from each page's <head>, so the DOM is parsed before it runs.
 */
(function () {
  'use strict';

  /* ---- what is waiting on you, and any live announcement ------------------ */
  /* One extra /me call, which every page already makes once. */
  function dot(href, n) {
    var a = document.querySelector('.ptab[href="' + href + '"]');
    if (!a || !n) return;
    var d = document.createElement('span');
    d.className = 'pdot';
    d.setAttribute('aria-label', n + ' waiting');
    a.appendChild(d);
  }

  fetch('/portal-api/me', { credentials: 'same-origin' }).then(function (r) {
    return r.ok ? r.json() : null;
  }).then(function (me) {
    if (!me || !me.ok || !me.waiting) return;
    dot('messages.html', me.waiting.messages);
    dot('tickets.html', me.waiting.tickets);
    dot('equipment.html', me.waiting.equipment);
    dot('billing.html', me.waiting.invoices_due);
    if (!me.waiting.announcements) return;
    return fetch('/portal-api/announcements', { credentials: 'same-origin' }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (d) {
      if (!d || !d.ok || !d.announcements.length) return;
      var box = document.getElementById('pAnnounce');
      if (!box) return;
      /* Dismissal is per viewer and per announcement. localStorage can throw in a
         private window, so every read and write is guarded. */
      var seen = {};
      try { seen = JSON.parse(localStorage.getItem('tes_ann_seen') || '{}'); } catch (e) { seen = {}; }
      d.announcements.forEach(function (a) {
        if (seen[a.id]) return;
        var row = document.createElement('div');
        row.className = 'pann ' + a.kind;
        var t = document.createElement('div');
        t.className = 'pann-t';
        var b = document.createElement('b');
        b.textContent = (a.kind === 'maintenance' ? 'Maintenance: ' : a.kind === 'billing' ? 'Billing: ' : '') + a.title;
        t.appendChild(b);
        var p = document.createElement('span');
        p.textContent = ' ' + a.body;
        t.appendChild(p);
        row.appendChild(t);
        var x = document.createElement('button');
        x.type = 'button';
        x.className = 'pann-x';
        x.setAttribute('aria-label', 'Dismiss');
        x.textContent = '\u00d7';
        x.addEventListener('click', function () {
          row.remove();
          seen[a.id] = 1;
          try { localStorage.setItem('tes_ann_seen', JSON.stringify(seen)); } catch (e) { /* private mode */ }
          if (!box.childNodes.length) box.hidden = true;
        });
        row.appendChild(x);
        box.appendChild(row);
      });
      if (box.childNodes.length) box.hidden = false;
    });
  }).catch(function () { /* the strip is a courtesy, never the page */ });

  /* ---- sign out ----------------------------------------------------------- */
  /* A POST, not a link: it has to end the session server-side, and a GET that
     changes state is a link a prefetcher can follow. */
  Array.prototype.forEach.call(document.querySelectorAll('.psignout, .signout-link'), function (a) {
    a.setAttribute('href', '#');
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      fetch('/portal-api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      }).then(function () { location.href = '../login.html'; });
    });
  });
})();
