/*
 * form-ack.js: email the visitor a copy of a Formspree form they just sent.
 *
 * Opt a form in with data-ack="<form key>" (engineering, shingleai, shed, crash, geo,
 * billing). On submit the form's fields go to the portal Worker, which emails the
 * address on the form a branded copy, and then the form is submitted to Formspree
 * exactly as before. Formspree is always submitted, whatever the Worker says, after
 * at most a few seconds, so a confirmation can never cost TES the request itself.
 *
 * The Worker needs a Turnstile token, so each opted-in form carries a cf-turnstile
 * widget. With no token the copy is skipped and the request still goes through.
 *
 * Load before form-once.js; it marks the form as sent before handing it to Formspree.
 */
(function () {
  var ENDPOINT = '/portal-api/public/form-ack';
  var WAIT_MS = 4000;

  function collect(form) {
    var out = {};
    var data = new FormData(form);
    data.forEach(function (value, key) {
      if (typeof value !== 'string') return; // files are not echoed
      if (key in out) { out[key] = [].concat(out[key], value); }
      else out[key] = value;
    });
    return out;
  }

  var forms = document.querySelectorAll('form[data-ack]');
  Array.prototype.forEach.call(forms, function (form) {
    var handing = false;
    form.addEventListener('submit', function (e) {
      if (handing || e.defaultPrevented) return;
      if (typeof window.fetch !== 'function') return; // old browser: plain submit
      e.preventDefault();
      handing = true;
      var btn = form.querySelector('button[type="submit"], button:not([type])');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

      var fields = collect(form);
      var token = fields['cf-turnstile-response'];
      delete fields['cf-turnstile-response'];

      function toFormspree() {
        if (window.TESFormOnce) window.TESFormOnce.mark(form);
        HTMLFormElement.prototype.submit.call(form);
      }
      if (!token) { toFormspree(); return; }

      var done = false;
      function once() { if (!done) { done = true; toFormspree(); } }
      setTimeout(once, WAIT_MS);
      fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ form: form.getAttribute('data-ack'), turnstileToken: token, fields: fields }),
        keepalive: true,
      }).then(once, once);
    });
    // Coming back to the page (bfcache) must allow a fresh send.
    window.addEventListener('pageshow', function () { handing = false; });
  });
})();
