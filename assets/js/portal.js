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
    /* The Projects tab only appears for an account that has a project. */
    if (me.waiting.projects) {
      var pt = document.querySelector('.ptab[href="projects.html"]');
      if (pt) pt.hidden = false;
    }
    dot('projects.html', me.waiting.signoff);
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

  /* ---- the tab strip ------------------------------------------------------ */
  /* Eleven tabs stopped fitting a laptop, never mind a phone. The strip has always
     scrolled, but with the scrollbar hidden there was nothing on screen saying so,
     so a tab past the right edge simply looked missing -- which is how Tyler found
     it, on a desktop.

     The affordance is a fade at whichever end still has somewhere to go, applied as
     a MASK on the strip rather than a colored overlay: the bar is translucent over
     the page's radial gradient, so a fade painted in a fixed color would band
     visibly against it at some scroll positions and not others. A mask fades the
     content itself and does not care what is behind it.

     Arrows appear only for a pointer that can hover. On a touch screen the strip is
     already swipeable and a pair of buttons would just cover two tabs. */
  (function tabStrip() {
    var bar = document.querySelector('.ptabs');
    var strip = bar && bar.querySelector('.ptabs-inner');
    if (!bar || !strip) return;

    var EDGE = 4; // a pixel or two of rounding should not light up an arrow

    function paint() {
      var over = strip.scrollWidth - strip.clientWidth;
      var x = strip.scrollLeft;
      bar.classList.toggle('fade-l', over > EDGE && x > EDGE);
      bar.classList.toggle('fade-r', over > EDGE && x < over - EDGE);
    }

    function nudge(dir) {
      // Most of a screen, not all of it: a tab kept in view is what tells you where
      // the jump landed.
      strip.scrollBy({ left: dir * Math.round(strip.clientWidth * 0.7), behavior: 'smooth' });
    }

    ['\u2039', '\u203a'].forEach(function (glyph, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pscroll ' + (i ? 'right' : 'left');
      b.textContent = glyph;
      b.setAttribute('aria-label', i ? 'Scroll tabs right' : 'Scroll tabs left');
      // The strip is a duplicate of links already reachable by keyboard, so the
      // buttons are decoration to a screen reader and a tab stop it does not need.
      b.tabIndex = -1;
      b.setAttribute('aria-hidden', 'true');
      b.addEventListener('click', function () { touched = true; nudge(i ? 1 : -1); });
      bar.appendChild(b);
    });

    // Land on the page with the tab you are on in view.
    var touched = false;
    function center() {
      var here = strip.querySelector('.ptab.active');
      if (!here || touched) return;
      // scrollIntoView rather than arithmetic off offsetLeft: the strip is centered
      // with auto margins and padded 5% a side, so hand-computing a scroll position
      // has to account for both and came up short on the last tab at every width
      // below 1280. `block:'nearest'` so it cannot drag the page vertically, and the
      // page's own scroll is put back either way.
      //
      // The strip deliberately does NOT set scroll-behavior:smooth in CSS: with that
      // on the element every programmatic scroll is queued as an animation, which is
      // how the first cut of this silently did nothing at all. The arrows ask for
      // smooth per call instead.
      var y = window.scrollY;
      here.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
      if (window.scrollY !== y) window.scrollTo(0, y);
    }

    strip.addEventListener('scroll', paint, { passive: true });
    window.addEventListener('resize', function () { paint(); center(); });
    if (window.ResizeObserver) {
      // Observe a TAB, not just the strip. The strip is 100% of the bar, so when the
      // web font swaps in and every tab gets wider the strip's own box does not
      // change at all and an observer on it never fires -- which is how the first
      // measurement, taken against the fallback font, was the one that stuck and the
      // last tab ended up 80px short of on screen.
      var ro = new ResizeObserver(function () { paint(); center(); });
      ro.observe(strip);
      var one = strip.querySelector('.ptab');
      if (one) ro.observe(one);
    }
    // And the same thing said directly, for a browser that reflows some other way.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { paint(); center(); });
    }
    // Once somebody has moved the strip themselves, it stays where they left it.
    ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
      strip.addEventListener(ev, function () { touched = true; }, { passive: true });
    });

    // A vertical wheel over the strip turns it sideways. While the strip has
    // anywhere to scroll, the wheel belongs to it even at either end: reaching
    // the last tab must not hand the wheel to the page. To scroll the page,
    // move the pointer off the bar. When every tab fits, the wheel is left alone.
    bar.addEventListener('wheel', function (e) {
      if (e.deltaY === 0 || e.ctrlKey) return;
      if (strip.scrollWidth - strip.clientWidth <= EDGE) return;
      e.preventDefault();
      touched = true;
      // Firefox reports line-mode deltas (about 3 per notch), not pixels.
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * strip.clientWidth : e.deltaY;
      strip.scrollLeft += dy;
    }, { passive: false });

    center();
    paint();
  })();

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
