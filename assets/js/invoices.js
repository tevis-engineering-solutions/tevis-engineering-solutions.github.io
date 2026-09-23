/* ---------------------------------------------------------------------------
   TES invoicing client  —  assets/js/invoices.js
   Shared by pay_invoice.html (public lookup) and portal/billing.html (portal).

   Data source: the Google Apps Script web app in front of the billing sheet.
   The script is called two ways:

     ?q=<token>      one-off lookup by invoice number OR account/username
     ?email=<addr>   every invoice billed to one email address

   Both calls also filter client-side after the response, so this file keeps
   working against the older Apps Script deployment that ignores the query
   string and returns the whole sheet. See _ops/INVOICING.md.
--------------------------------------------------------------------------- */
(function (global) {
  'use strict';

  /* Invoices come from the TES portal Worker, same-origin, scoped server-side.
     The previous Google Apps Script endpoint was removed: it ignored its query
     parameter and returned EVERY invoice row to any caller, and its URL sat in
     this file, which is public. Filtering used to happen in the browser below,
     which meant it was not a control at all. */
  var API = '/portal-api';

  /* Set when the page is opened from a signed pay link (?t=...). That token is
     the authorization for exactly one invoice, so it is what payment calls send. */
  var payToken = null;

  /* Column aliases. The sheet's header row supplies the JSON keys, so accept
     the names in use today plus the ones a future sheet is likely to use. */
  var FIELDS = {
    email:       ['Email', 'ClientEmail', 'Account', 'AccountEmail', 'Username', 'Client'],
    number:      ['InvoiceNumber', 'Invoice', 'InvoiceID', 'LatestInvoice', 'Number'],
    service:     ['ServiceType', 'Service', 'Type', 'Cadence'],
    amount:      ['InvoiceAmount', 'Amount', 'Total', 'Balance', 'AmountDue'],
    paid:        ['Paid', 'Status', 'PaidStatus'],
    issued:      ['IssuedDate', 'Issued', 'InvoiceDate', 'Date'],
    due:         ['DueDate', 'Due'],
    description: ['Description', 'Details', 'Notes', 'Note', 'Memo', 'LineItems'],
    paidDate:    ['PaidDate', 'DatePaid', 'PaymentDate'],
    ref:         ['PaymentRef', 'PaymentReference', 'OrderID', 'PayPalOrder']
  };

  function pick(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(row, keys[i])) {
        var v = row[keys[i]];
        if (v !== '' && v !== null && v !== undefined) return v;
      }
    }
    return '';
  }

  function normalizeToken(value) {
    return String(value == null ? '' : value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function toNumber(value) {
    if (typeof value === 'number') return isFinite(value) ? value : null;
    var n = Number(String(value == null ? '' : value).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : null;
  }

  function formatUSD(value) {
    var n = typeof value === 'number' ? value : toNumber(value);
    if (n === null) return String(value || '—');
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  function dateValue(value) {
    if (!value) return null;
    if (value instanceof Date) return value.getTime();
    /* The API returns unix SECONDS. Anything below ~1e11 is seconds, not ms. */
    if (typeof value === 'number') return value < 1e11 ? value * 1000 : value;
    var s = String(value).trim();
    // Bare YYYY-MM-DD is parsed as UTC by Date, which can render as the day
    // before in US time zones. Pin it to local noon instead.
    var ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3], 12).getTime();
    var t = Date.parse(s);
    return isNaN(t) ? null : t;
  }

  function formatDate(value) {
    var t = dateValue(value);
    if (t === null) return String(value || '—');
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isPaidFlag(value) {
    var s = String(value == null ? '' : value).trim().toLowerCase();
    if (!s) return false;
    return /^(y|yes|true|t|1|paid|complete|completed|settled|closed)/.test(s);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Turn one raw sheet row into the shape the pages render. */
  function parseRow(row) {
    var emailRaw = String(pick(row, FIELDS.email) || '').trim();
    return {
      email:       emailRaw,
      emailKey:    emailRaw.toLowerCase(),
      number:      String(pick(row, FIELDS.number) || '').trim(),
      service:     String(pick(row, FIELDS.service) || '').trim(),
      amount:      toNumber(pick(row, FIELDS.amount)),
      paid:        isPaidFlag(pick(row, FIELDS.paid)),
      issued:      pick(row, FIELDS.issued),
      due:         pick(row, FIELDS.due),
      description: String(pick(row, FIELDS.description) || '').trim(),
      paidDate:    pick(row, FIELDS.paidDate),
      ref:         String(pick(row, FIELDS.ref) || '').trim(),
      raw:         row
    };
  }

  function isOverdue(inv) {
    if (inv.paid) return false;
    var t = dateValue(inv.due);
    return t !== null && t < Date.now();
  }

  /* ---------- network ---------------------------------------------------- */

  function apiGet(path) {
    return fetch(API + path, { credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .catch(function () { return { ok: false, error: 'network' }; });
  }

  function apiPost(path, body) {
    return fetch(API + path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {})
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .catch(function () { return { ok: false, error: 'network' }; });
  }

  /* Maps the API shape onto the field names the pages already render, so the
     billing and pay pages did not have to be rewritten around a new object. */
  function fromApi(inv) {
    if (!inv) return null;
    return {
      id:          inv.id,
      number:      inv.number || '',
      service:     inv.service || '',
      description: inv.description || '',
      amount:      Number(inv.amount_cents) / 100,
      paid:        inv.status === 'paid',
      status:      inv.status,
      issued:      inv.issued_at || null,
      due:         inv.due_at || null,
      paidDate:    inv.paid_at || null,
      overdue:     !!inv.overdue,
      /* A PDF copy is on file. Fetched by invoice id (or by the pay token on the
         public pay page), never by a storage key. */
      hasPdf:      !!inv.has_pdf,
      // An agreement fee invoice has a record of the period behind it. Fetched on
      // demand rather than with the list: most people never open it.
      hasStatement: !!inv.has_statement,
      currency:    inv.currency || 'USD',
      /* Set when the customer has told us they paid by check or transfer. The
         invoice is 'pending' until TES confirms the funds landed. */
      method:      inv.payment_method || '',
      ref:         inv.payment_ref || '',
      reportedDate: inv.reported_at || null,
      /* Billed-to. Safe on the pay-link path: the recipient already holds this
         invoice, and nothing here reveals any other account. */
      email:       inv.email || '',
      company:     inv.company || '',
      emailKey:    ''
    };
  }

  /* Every invoice for the signed-in account. The email argument is ignored and
     kept only so existing callers did not need changing -- scoping is done by
     the session on the server, never by anything the browser supplies. */
  function fetchForEmail() {
    return apiGet('/invoices').then(function (d) {
      if (!d || !d.ok) return [];
      return (d.invoices || []).map(fromApi);
    });
  }

  function fetchSummary() {
    return apiGet('/invoices').then(function (d) {
      if (!d || !d.ok) return null;
      return { invoices: (d.invoices || []).map(fromApi), summary: d.summary };
    });
  }

  /* Resolves the signed pay link in the current URL (?t=...). Returns
     { ok, invoice } or { ok:false, error }. No token means no invoice: there is
     deliberately no way to look one up by guessing a number. */
  function lookupFromPayLink() {
    var t = new URLSearchParams(location.search).get('t');
    if (!t) return Promise.resolve({ ok: false, error: 'no_token' });
    payToken = t;
    return apiGet('/pay/invoice?t=' + encodeURIComponent(t)).then(function (d) {
      if (!d || !d.ok) return { ok: false, error: (d && d.error) || 'not_found' };
      return { ok: true, invoice: fromApi(d.invoice) };
    });
  }

  /* What an agreement invoice covered: the tickets, the time, the messages, the
     equipment and the visits. Authorized by the session and keyed on the invoice --
     the caller never names a period, so there is nothing to point at somebody else's.
     Resolves to null on any failure; a missing statement must not break the page. */
  function fetchStatement(inv) {
    return fetch(API + '/invoices/' + encodeURIComponent(inv.id) + '/statement', {
      credentials: 'same-origin', headers: { accept: 'application/json' },
    }).then(function (r) { return r.json(); })
      .then(function (r) { return r && r.ok ? r.statement : null; })
      .catch(function () { return null; });
  }

  /* Where the PDF copy of an invoice is served from. On the pay page the signed
     token is the authorization; in the portal it is the session cookie. */
  function pdfUrl(inv) {
    if (payToken) return API + '/pay/invoice/pdf?t=' + encodeURIComponent(payToken);
    return API + '/invoices/' + encodeURIComponent(inv.id) + '/pdf';
  }

  /* Legacy name kept so pay_invoice.html keeps working. */
  function lookup() { return lookupFromPayLink(); }

  /* Retained as a no-op. Marking an invoice paid is now a server-side decision
     made only after a capture whose amount matched the invoice. The browser
     saying "this is paid" is not evidence of anything. */
  function notifyPaid() { return Promise.resolve(null); }

  /* ---------- identity --------------------------------------------------- */

  /* The portal Worker exposes the signed-in user at /portal-api/me, backed by
     the app-level session cookie. Local dev has no Worker, so ?as=<email> stands
     in for it. The hostname guard below means that branch is unreachable in
     production -- it cannot be used to impersonate anyone on the live site. */
  function getIdentity() {
    var host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
      var as = new URLSearchParams(location.search).get('as');
      if (as) return Promise.resolve({ email: as, name: as.split('@')[0] });
    }
    // Identity is served by the portal Worker's app-level session, not by
    // Cloudflare Access. Shape is kept identical ({email, name}) so callers
    // did not have to change.
    return fetch('/portal-api/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return d && d.ok ? d : null; })
      .catch(function () { return null; });
  }

  /* ---------- PayPal ----------------------------------------------------- */

  function whenPayPalReady(cb, onFail) {
    if (global.paypal && global.paypal.Buttons) { cb(); return; }
    var waited = 0;
    var timer = setInterval(function () {
      if (global.paypal && global.paypal.Buttons) { clearInterval(timer); cb(); return; }
      waited += 150;
      if (waited >= 9000) { clearInterval(timer); if (onFail) onFail(); }
    }, 150);
  }

  /* Identifies the invoice to the server. A pay link authorizes exactly one
     invoice; otherwise the session decides what the caller may pay. Note that
     no AMOUNT is sent -- the server reads it from the database. That is the
     whole point: the old flow built the order in the browser, so a modified
     page could capture a different figure than the invoice said. */
  function payRef(inv) {
    return payToken ? { token: payToken } : { invoice_id: inv && inv.id };
  }

  function mountPayPal(container, inv, handlers) {
    handlers = handlers || {};
    whenPayPalReady(function () {
      global.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'pay' },

        createOrder: function () {
          return apiPost('/pay/order', payRef(inv)).then(function (d) {
            if (!d || !d.ok || !d.order_id) {
              throw new Error((d && d.error) || 'order_failed');
            }
            return d.order_id;
          });
        },

        onApprove: function (data) {
          var body = payRef(inv);
          body.order_id = data.orderID;
          return apiPost('/pay/capture', body).then(function (d) {
            if (!d || !d.ok) {
              if (handlers.onError) handlers.onError((d && d.error) || 'capture_failed');
              return;
            }
            if (handlers.onPaid) handlers.onPaid(data.orderID);
          });
        },

        onError: function () { if (handlers.onError) handlers.onError('paypal_error'); }
      }).render(container);
    }, function () { if (handlers.onError) handlers.onError('sdk_timeout'); });
  }

  /* ---------- check / ACH / wire ------------------------------------------ */

  /* Raises a support ticket asking for remittance details, which TES answers by
     email. Account and routing numbers are deliberately never rendered on a page
     or stored in this repo, which is public. */
  function requestBankDetails(inv, kind) {
    var body = payRef(inv);
    body.kind = kind || 'ACH';
    return apiPost('/pay/bank-request', body);
  }

  /* Customer states they have paid by check, ACH, or wire. This moves the
     invoice to 'pending', NOT 'paid' -- a claim is not cleared funds. TES
     confirms the money landed and closes it out. */
  function reportPayment(inv, method, reference) {
    var body = payRef(inv);
    body.method = method;
    body.reference = reference || '';
    return apiPost('/pay/report', body);
  }

  global.TESInvoices = {
    normalizeToken: normalizeToken,
    toNumber: toNumber,
    formatUSD: formatUSD,
    formatDate: formatDate,
    dateValue: dateValue,
    escapeHtml: escapeHtml,
    isOverdue: isOverdue,
    fetchForEmail: fetchForEmail,
    fetchSummary: fetchSummary,
    lookup: lookup,
    lookupFromPayLink: lookupFromPayLink,
    pdfUrl: pdfUrl,
    fetchStatement: fetchStatement,
    notifyPaid: notifyPaid,
    getIdentity: getIdentity,
    mountPayPal: mountPayPal,
    requestBankDetails: requestBankDetails,
    reportPayment: reportPayment
  };
})(window);
