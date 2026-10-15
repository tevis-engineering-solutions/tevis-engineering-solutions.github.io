/* TES Website Watch traffic snippet. https://tevisengineering.com/website-watch.html
 *
 * Installed on a client's site as:
 *   <script defer src="https://tevisengineering.com/w.js" data-site="KEY"></script>
 *
 * Counts a page view, and a click on a phone number, an email address, a form send or an
 * add-to-cart button. Sets no cookies and stores nothing in the browser. What it sends:
 * the site key, the page path, the referring page, any utm_source/utm_medium tags,
 * whether the visit came from a Google Ads click, and the window width (phone or
 * computer). The counting happens at tevisengineering.com/portal-api/public/hit
 * (tes-portal src/traffic.js). Kept small and dependency-free on purpose.
 */
(function () {
  var me = document.currentScript || document.querySelector('script[data-site][src*="/w.js"]');
  var key = me && me.getAttribute('data-site');
  if (!key || navigator.webdriver || document.visibilityState === 'prerender') return;
  var END = (me.src.match(/^https?:\/\/[^/]+/) || ['https://tevisengineering.com'])[0] + '/portal-api/public/hit';

  function send(t, extra) {
    var q = new URLSearchParams(location.search);
    var body = { k: key, t: t, p: location.pathname };
    if (t === 'view') {
      body.r = document.referrer || '';
      body.s = q.get('utm_source') || '';
      body.m = q.get('utm_medium') || '';
      body.g = q.has('gclid') || q.has('gbraid') || q.has('wbraid') ? 1 : 0;
      body.w = window.innerWidth || 0;
    }
    if (extra) for (var x in extra) body[x] = extra[x];
    var data = JSON.stringify(body);
    try {
      // text/plain keeps it a simple request: no preflight, and it survives a page unload.
      if (navigator.sendBeacon && navigator.sendBeacon(END, new Blob([data], { type: 'text/plain' }))) return;
    } catch (e) { /* fall through */ }
    try { fetch(END, { method: 'POST', body: data, keepalive: true, mode: 'no-cors', headers: { 'content-type': 'text/plain' } }); } catch (e) { /* never break the page */ }
  }

  // Add-to-cart buttons on the common store builders, and anything marked by hand.
  var CART = '[data-tes-cart],form[action*="/cart/add"] [type=submit],button[name=add],.add_to_cart_button,.single_add_to_cart_button,' +
    '[data-hook="add-to-cart"],.sqs-add-to-cart-button,.product-form__submit,[data-action="add-to-cart"]';

  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('a,button,[data-tes-cart]') : null;
    if (!el) return;
    var href = (el.getAttribute && el.getAttribute('href')) || '';
    if (/^tel:/i.test(href)) send('phone');
    else if (/^mailto:/i.test(href)) send('email');
    else if (el.matches && el.matches(CART)) send('cart');
  }, true);

  var sent = typeof WeakSet === 'function' ? new WeakSet() : null;
  document.addEventListener('submit', function (ev) {
    var f = ev.target;
    if (!f || (f.matches && f.matches('form[action*="/cart/add"],form[role=search],form[action*="search"]'))) return;
    if (sent) { if (sent.has(f)) return; sent.add(f); }
    send('form');
  }, true);

  send('view');
})();
