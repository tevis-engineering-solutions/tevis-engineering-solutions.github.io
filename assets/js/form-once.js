/*
 * form-once.js: stop a form from being sent twice when the visitor uses the
 * back button after Formspree's confirmation page.
 *
 * Opt a form in with data-send-once. When it is submitted the page remembers
 * that in sessionStorage. If the visitor comes back (back button, bfcache or a
 * restored page), the form is cleared and the page's thank-you is shown instead
 * of a filled-in form that could be sent again. A plain reload afterwards shows
 * a fresh form.
 *
 *   data-sent-show="#id"    element to show once sent (the thank-you)
 *   data-sent-hide="#id"    element to hide once sent (defaults to the form)
 *   data-sent-class="name"  show the thank-you by adding this class instead
 *
 * A page with its own thank-you logic can listen for the cancelable "tes:sent"
 * event on the form and call preventDefault() to take over.
 *
 * Forms that submit from code (form.submit() skips the submit event) call
 * TESFormOnce.mark(form) first.
 *
 * Load with defer, after the page's own scripts, so a submit the page has
 * already handled itself (preventDefault, then fetch) is not counted.
 */
(function () {
  function key(form) { return 'tesSent:' + location.pathname + ':' + (form.id || 'form'); }

  function mark(form) {
    try { sessionStorage.setItem(key(form), '1'); } catch (e) {}
  }

  function pick(form, attr) {
    var sel = form.getAttribute(attr);
    return sel ? document.querySelector(sel) : null;
  }

  function showSent(form) {
    form.reset();
    var ev;
    try { ev = new CustomEvent('tes:sent', { cancelable: true }); } catch (e) { ev = null; }
    if (ev && !form.dispatchEvent(ev)) return;
    var hide = pick(form, 'data-sent-hide') || form;
    hide.hidden = true;
    hide.style.display = 'none';
    var show = pick(form, 'data-sent-show');
    if (!show) return;
    var cls = form.getAttribute('data-sent-class');
    if (cls) { show.classList.add(cls); }
    else { show.hidden = false; show.style.display = 'block'; }
  }

  window.TESFormOnce = { mark: mark, showSent: showSent };

  var forms = document.querySelectorAll('form[data-send-once]');
  Array.prototype.forEach.call(forms, function (form) {
    var btn = form.querySelector('button[type="submit"], button:not([type])');
    var label = btn ? btn.innerHTML : '';

    form.addEventListener('submit', function (e) {
      if (e.defaultPrevented) return; // the page sent it itself
      mark(form);
      if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    });

    function check() {
      var sent = false;
      try { sent = sessionStorage.getItem(key(form)) === '1'; sessionStorage.removeItem(key(form)); } catch (e) {}
      if (btn) { btn.disabled = false; btn.innerHTML = label; }
      if (sent) showSent(form);
    }
    window.addEventListener('pageshow', check);
  });
})();
