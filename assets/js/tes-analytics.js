/*
 * tes-analytics.js: Google Analytics 4 and Google Ads tags, consent, and conversion events.
 *
 * ===== PASTE YOUR IDS HERE =====
 * Nothing loads and no banner shows until at least one ID is filled in.
 *
 *   ga4  Google Analytics 4 Measurement ID. GA4 > Admin > Data streams > your web stream.
 *        Looks like 'G-ABC123XYZ9'.
 *   ads  Google Ads tag ID. Google Ads > Goals > Conversions > (any web conversion) > Tag setup.
 *        Looks like 'AW-123456789'.
 *   adsLabels  Optional. A Google Ads conversion label per event, from the same Tag setup
 *        screen (the part after the slash in 'AW-123456789/AbCdEfGh'). Leave an event blank
 *        to skip sending it to Ads directly; you can instead import GA4 key events into Ads.
 *
 * These IDs are public by design; they appear in every visitor's browser. No passwords or
 * API keys belong in this file.
 */
var TES_TAGS = {
  ga4: '',
  ads: '',
  adsLabels: {
    generate_lead: '',      // contact, project and product requests, assessment, office setup
    book_appointment: '',   // a consultation booked on book.html
    phone_click: '',        // a tap or click on the phone number
    purchase: '',           // an invoice paid through PayPal
    begin_checkout: '',     // Website Watch or Ohio Crash checkout started
    start_trial: '',        // Ohio Crash free trial requested
  },
};

(function () {
  var ids = [TES_TAGS.ga4, TES_TAGS.ads].filter(Boolean);
  var queue = [];
  // Pages call tesTrack() whether or not tags are configured; without IDs it does nothing.
  window.tesTrack = function (name, params) { queue.push([name, params || {}]); };
  if (!ids.length) { window.tesTrack = function () {}; return; }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  // Consent: granted by default in the US, denied in the EEA, UK and Switzerland until the
  // visitor accepts. A visitor's own choice from the bar overrides both.
  var EEA = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH'];
  var DENIED = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' };
  var GRANTED = { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' };
  var choice = null;
  try { choice = localStorage.getItem('tesConsent'); } catch (e) {}
  gtag('consent', 'default', Object.assign({}, DENIED, { region: EEA, wait_for_update: 500 }));
  gtag('consent', 'default', GRANTED);
  if (choice === 'denied') gtag('consent', 'update', DENIED);
  if (choice === 'granted') gtag('consent', 'update', GRANTED);

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ids[0]);
  document.head.appendChild(s);
  gtag('js', new Date());
  // Pay links and quote links carry a signed token, and a few pages take an email or a
  // search in the URL. Strip those from what Google records; campaign parameters (utm_*,
  // gclid) stay so ads can be attributed.
  var PRIVATE = ['t', 'token', 'q', 'email', 'as', 'id', 'ref', 'invoice'];
  var url = new URL(location.href);
  PRIVATE.forEach(function (k) { url.searchParams.delete(k); });
  var base = { page_location: url.origin + url.pathname + (url.search || '') };
  if (TES_TAGS.ga4) gtag('config', TES_TAGS.ga4, base);
  if (TES_TAGS.ads) gtag('config', TES_TAGS.ads, base);

  function track(name, params) {
    params = Object.assign({ page_path: location.pathname }, params || {});
    gtag('event', name, params);
    var label = TES_TAGS.ads && TES_TAGS.adsLabels[name];
    if (label) {
      var conv = { send_to: TES_TAGS.ads + '/' + label };
      if (params.value != null) { conv.value = params.value; conv.currency = params.currency || 'USD'; }
      if (params.transaction_id) conv.transaction_id = params.transaction_id;
      gtag('event', 'conversion', conv);
    }
  }
  window.tesTrack = track;
  queue.forEach(function (q) { track(q[0], q[1]); });

  // ---- Form submissions ----
  // Fires when the browser accepts a submission (after its own required-field checks).
  // Forms that post through the Worker can still fail server-side; those are rare and this
  // keeps one rule for every form on the site.
  var FORMS = {
    contactForm:  ['generate_lead', 'contact'],
    reqForm:      ['generate_lead', 'project_request'],
    mailForm:     ['generate_lead', 'it_assessment'],
    osForm:       ['generate_lead', 'office_setup'],
    bmForm:       ['generate_lead', 'bid_software_waitlist'],
    bkForm:       ['book_appointment', 'consultation'],
    wwForm:       ['begin_checkout', 'website_watch'],
    buyForm:      ['begin_checkout', 'ohio_crash'],
    trialForm:    ['start_trial', 'ohio_crash'],
    tesScanForm:  ['scan_website', 'free_website_analysis'],
    nlForm:       ['sign_up', 'newsletter'],
    sugForm:      ['suggestion', 'geo_visualizer'],
    ticketForm:   ['support_ticket', 'support'],
    billingForm:  ['billing_request', 'billing'],
  };
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM' || f.dataset.tesTracked) return;
    var m = FORMS[f.id] || (f.classList.contains('newsletter-form') ? ['sign_up', 'newsletter'] : null);
    if (!m) return;
    f.dataset.tesTracked = '1';
    setTimeout(function () { delete f.dataset.tesTracked; }, 4000);
    var params = { form_name: m[1] };
    var kind = f.querySelector('[name="project_type"], [name="start"], [name="model"]');
    if (kind && kind.value) params.form_choice = kind.value;
    track(m[0], params);
  }, true);

  // ---- Clicks ----
  var CTA = /(?:^|\/)(contact|book|make_ticket|login|engineering-services-cleveland|replacement-parts-cleveland|pricing_sheet|service_catalog)\.html|#get-started/;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    var text = (a.textContent || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (/^tel:/i.test(href)) track('phone_click', { link_text: text });
    else if (/^mailto:/i.test(href)) track('email_click', { link_text: text, email: href.slice(7).split('?')[0] });
    else if (/\.pdf($|\?)/i.test(href)) track('file_download', { file_name: href.split('/').pop(), link_text: text });
    else if (CTA.test(href)) track('cta_click', { link_text: text, link_url: href });
  }, true);

  // ---- Live chat ----
  window.Tawk_API = window.Tawk_API || {};
  var prevStart = window.Tawk_API.onChatStarted;
  window.Tawk_API.onChatStarted = function () { track('chat_start', {}); if (typeof prevStart === 'function') prevStart(); };

  // ---- Consent bar ----
  if (choice) return;
  function bar() {
    var css = document.createElement('style');
    css.textContent =
      '#tesConsent{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:640px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;' +
      'padding:14px 16px;border-radius:12px;background:rgba(10,20,14,0.97);border:1px solid rgba(74,172,101,0.35);box-shadow:0 12px 30px rgba(0,0,0,0.45);' +
      'color:#cfe0d2;font:14px/1.5 Inter,"Segoe UI",system-ui,sans-serif}' +
      '#tesConsent p{margin:0;flex:1 1 280px}#tesConsent a{color:#6dd28a}' +
      '#tesConsent .tc-btns{display:flex;gap:8px}' +
      '#tesConsent button{font:700 13px Montserrat,"Segoe UI",sans-serif;min-height:40px;padding:0 16px;border-radius:999px;cursor:pointer}' +
      '#tesConsent .tc-yes{background:linear-gradient(135deg,#c89830,#e0b840);color:#0d1710;border:0}' +
      '#tesConsent .tc-no{background:transparent;color:#cfe0d2;border:1px solid rgba(207,224,210,0.35)}';
    document.head.appendChild(css);
    var el = document.createElement('div');
    el.id = 'tesConsent';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Cookie choices');
    var pre = location.pathname.split('/').length > 2 ? '../' : '';
    el.innerHTML = '<p>We use Google Analytics and Google Ads cookies to see which pages and ads bring in customers. ' +
      '<a href="' + pre + 'privacy_policy.html#cookies">Cookie choices</a></p>' +
      '<div class="tc-btns"><button type="button" class="tc-no">Decline</button><button type="button" class="tc-yes">Accept</button></div>';
    document.body.appendChild(el);
    function set(v) {
      try { localStorage.setItem('tesConsent', v); } catch (e) {}
      gtag('consent', 'update', v === 'granted' ? GRANTED : DENIED);
      el.remove();
    }
    el.querySelector('.tc-yes').addEventListener('click', function () { set('granted'); });
    el.querySelector('.tc-no').addEventListener('click', function () { set('denied'); });
  }
  if (document.body) bar(); else document.addEventListener('DOMContentLoaded', bar);
})();
