/* Free website analysis — shared client.
 *
 * Used by three pages:
 *   website_creation.html        the scanner section
 *   free-website-analysis.html   the same scanner, as the whole page
 *   website-report.html          the report the scan opens in a new tab
 *
 * Second file in assets/js/ (after invoices.js), for the same reason: three pages need
 * the identical logic and the alternative is three copies that drift.
 *
 * WHY THE SCAN IS NOT IN THE BROWSER: a page cannot read another origin's HTML. CORS
 * forbids it, and no amount of client-side cleverness gets around that. The work happens
 * in the tes-portal Worker at /portal-api/public/audit, which is same-origin with this
 * page. See C:\dev\tes-portal\src\audit.js.
 *
 * THE HANDOFF: the report opens in a second tab, so the result travels through
 * localStorage rather than sessionStorage. sessionStorage is per-tab; a tab opened with
 * window.open inherits a COPY in some browsers and nothing in others, which is exactly
 * the kind of works-on-my-machine bug that would show up only for a customer.
 */
(function () {
  'use strict';

  var API = '/portal-api/public';
  var STORE_KEY = 'tes_site_report_v1';
  var MIN_SCAN_MS = 9000;   // the animation is doing a job; do not flash past it

  // ---------------------------------------------------------------- storage

  function saveResult(payload) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      return false;   // private mode, quota, storage blocked
    }
  }

  function loadResult() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // ---------------------------------------------------------------- helpers

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function post(path, body, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 45000);
    return fetch(API + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    }).then(function (res) {
      clearTimeout(timer);
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    }).catch(function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  // Plain-English for every error the Worker can return. A raw code in front of a
  // business owner is the same as no message at all.
  var ERRORS = {
    bad_url: 'That does not look like a website address. Try it in the form example.com.',
    blocked_host: 'We can only scan a public website address, not an IP address or an internal name.',
    rate_limited: 'You have run several scans in a short time. Give it an hour, or call us and we will run one for you.',
    busy: 'The scanner is busy right now. Try again in a few minutes, or get in touch and we will run it by hand.'
  };

  function errorText(code) {
    return ERRORS[code] || 'Something went wrong on our end. Please try again, or get in touch and we will run the analysis by hand.';
  }

  // ---------------------------------------------------------------- the scanner

  // What the visitor reads while the scan runs. The left column tracks what is actually
  // happening; the right column is the part that earns the wait — real, specific advice
  // they can use whether or not they ever call us.
  var STEPS = [
    'Reaching your website\u2026',
    'Reading your homepage\u2026',
    'Following your contact and about pages\u2026',
    'Checking that your phone number actually dials\u2026',
    'Looking for stock photos presented as your own work\u2026',
    'Reading your footer, copyright year and photo dates\u2026',
    'Checking how the site behaves on a phone\u2026',
    'Testing your security certificate\u2026',
    'Scoring what we found\u2026'
  ];

  var TIPS = [
    ['The tap-to-call test', 'On a phone, more than half of local-service visitors tap the phone number instead of filling in a form. If that link is not a real tel: link, the tap does nothing and the customer calls the next result down.'],
    ['Your title tag is your ad', 'The blue headline in Google search results comes from one line of code most sites never set. A title reading "Home" wastes the single most valuable piece of text you own.'],
    ['Google measures what visitors feel', 'Largest Contentful Paint is how long before the main headline or photo actually appears. Google weighs it in ranking because people abandon slow pages, and most give up before three seconds.'],
    ['Name your city, in words', 'Google cannot rank you for a town you never mention. A site that never writes its own service area out loud is invisible for the searches that convert best.'],
    ['Stock photos are checkable', 'A homeowner who reverse-image-searches a "recent project" photo and finds it on a stock site stops believing everything else on the page. Real job photos beat perfect ones.'],
    ['The footer year is the first thing checked', 'A careful buyer scrolls to the bottom to see whether a business is still trading. A copyright year three seasons stale reads as "closed" whether or not you are.'],
    ['A form earns while you sleep', 'Phone-only businesses lose every visitor who lands after hours, which is when most people actually research contractors. One short quote form recovers them.'],
    ['Not secure means not trusted', 'Browsers now put a warning in the address bar for sites without a valid certificate. Visitors do not read the warning; they read it as "this company is not safe".'],
    ['Mobile is not a version of your site', 'A site with no responsive viewport renders on a phone as a shrunken desktop page you have to pinch to read. Most local searches happen on a phone.'],
    ['Own your own domain', 'If your website, domain and email are registered in someone else\u2019s account, you do not own your address. Getting it back later is the expensive version of this conversation.']
  ];

  function initScanner() {
    var form = document.getElementById('tesScanForm');
    if (!form) return;

    var urlInput = document.getElementById('tesScanUrl');
    var notesInput = document.getElementById('tesScanNotes');
    var button = document.getElementById('tesScanBtn');
    var errorBox = document.getElementById('tesScanError');
    var idle = document.getElementById('tesScanIdle');
    var stage = document.getElementById('tesScanStage');
    var stepLabel = document.getElementById('tesScanStep');
    var bar = document.getElementById('tesScanBar');
    var tipTitle = document.getElementById('tesTipTitle');
    var tipBody = document.getElementById('tesTipBody');
    var done = document.getElementById('tesScanDone');
    var doneOpen = document.getElementById('tesScanOpen');
    var doneNote = document.getElementById('tesScanDoneNote');

    var running = false;
    var timers = [];

    function clearTimers() {
      timers.forEach(clearInterval);
      timers.forEach(clearTimeout);
      timers = [];
    }

    function showError(message) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    }

    function startAnimation() {
      var step = 0;
      var tip = Math.floor(Math.random() * TIPS.length);

      stepLabel.textContent = STEPS[0];
      paintTip(tip);
      bar.style.width = '4%';

      timers.push(setInterval(function () {
        step = Math.min(step + 1, STEPS.length - 1);
        stepLabel.textContent = STEPS[step];
        // Creeps toward 92% and waits there. A bar that reaches 100% before the answer
        // does is a bar that has lied to somebody.
        var pct = 4 + Math.round((step / (STEPS.length - 1)) * 88);
        bar.style.width = pct + '%';
      }, Math.round(MIN_SCAN_MS / STEPS.length)));

      timers.push(setInterval(function () {
        tip = (tip + 1) % TIPS.length;
        paintTip(tip);
      }, 4200));
    }

    function paintTip(i) {
      tipTitle.textContent = TIPS[i][0];
      tipBody.textContent = TIPS[i][1];
      tipTitle.parentNode.classList.remove('tes-tip-in');
      // Reflow, so the fade restarts rather than being skipped as a no-op class swap.
      void tipTitle.parentNode.offsetWidth;
      tipTitle.parentNode.classList.add('tes-tip-in');
    }

    function finish(payload) {
      clearTimers();
      bar.style.width = '100%';
      stepLabel.textContent = 'Report ready.';

      var stored = saveResult(payload);
      setTimeout(function () {
        stage.hidden = true;
        done.hidden = false;

        if (!stored) {
          // Storage is blocked (private mode, or the browser is set to refuse it).
          // The report page reads its data from there, so say so instead of opening
          // a tab that can only apologize.
          doneNote.textContent = 'Your browser is blocking local storage, so we cannot open the'
            + ' full report in a new tab. Get in touch and we will send it to you.';
          doneOpen.hidden = true;
          return;
        }

        var opened = window.open('website-report.html', '_blank');
        if (!opened) {
          // Do not move this tab anywhere: it is now the only route to the report.
          doneNote.textContent = 'Your browser blocked the new tab. Use the button below to open your report.';
          return;
        }
        handOffToContact(doneNote);
      }, 600);
    }

    // The report is now in front of them in the other tab, so this tab's job is done and
    // the next step is a conversation. It counts down out loud with a way to stop it:
    // a page that silently navigates away while somebody is still reading it feels broken,
    // and this one has just finished asking them to trust us.
    function handOffToContact(note) {
      var seconds = 6;
      note.textContent = '';
      note.appendChild(document.createTextNode('Your report opened in a new tab. Taking you to our contact page in '));
      var count = el('b', null, String(seconds));
      note.appendChild(count);
      note.appendChild(document.createTextNode(' seconds… '));
      var stop = el('button', 'scan-stay', 'Stay on this page');
      stop.type = 'button';
      note.appendChild(stop);

      var tick = setInterval(function () {
        seconds -= 1;
        if (seconds <= 0) {
          clearInterval(tick);
          window.location.href = 'contact.html?from=analysis';
          return;
        }
        count.textContent = String(seconds);
      }, 1000);

      stop.addEventListener('click', function () {
        clearInterval(tick);
        note.textContent = 'Your report opened in a new tab.';
      });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (running) return;

      var url = (urlInput.value || '').trim();
      if (!url) {
        showError('Enter your website address first.');
        urlInput.focus();
        return;
      }

      running = true;
      errorBox.hidden = true;
      button.disabled = true;
      idle.hidden = true;
      stage.hidden = false;
      done.hidden = true;
      startAnimation();

      var notes = notesInput ? (notesInput.value || '').trim() : '';
      var startedAt = Date.now();

      post('/audit', { url: url }, 45000).then(function (res) {
        if (!res.data || !res.data.ok) {
          throw { handled: errorText(res.data && res.data.error) };
        }
        // Hold the animation for its full run even when the scan comes back fast. The
        // rotating advice is the point of the wait, not decoration over an empty one.
        var wait = Math.max(0, MIN_SCAN_MS - (Date.now() - startedAt));
        timers.push(setTimeout(function () {
          finish({ v: 1, at: Date.now(), url: url, notes: notes, report: res.data });
        }, wait));
      }).catch(function (err) {
        clearTimers();
        running = false;
        button.disabled = false;
        stage.hidden = true;
        idle.hidden = false;
        bar.style.width = '0%';
        showError(err && err.handled
          ? err.handled
          : 'We could not reach the scanner. Check your connection and try again.');
      });
    });
  }

  // ---------------------------------------------------------------- the report

  var SEVERITY = {
    critical: ['Critical', '#b91c1c'],
    high: ['High', '#dc2626'],
    medium: ['Medium', '#b8860f'],
    low: ['Low', '#64748b'],
    info: ['Note', '#64748b']
  };

  var GRADE_COLOR = { A: '#2f7d4a', B: '#2f7d4a', C: '#b8860f', D: '#b8860f', F: '#b91c1c' };

  var GRADE_LINE = {
    A: 'Nothing our automated checks flag. That is rarer than you would think.',
    B: 'Broadly healthy, with a few things worth tidying.',
    C: 'Working, but leaking. Several fixable problems are costing you contacts.',
    D: 'Real problems. Some of these are turning away customers who found you.',
    F: 'Serious problems. The site is actively working against the business right now.'
  };

  // Google's own thresholds, in words a business owner can act on.
  var METRIC_HELP = {
    FCP: ['First Contentful Paint', 'How long before anything at all appears on screen.', 'under 1.8s'],
    LCP: ['Largest Contentful Paint', 'How long before the main content, usually the big headline or photo, actually appears. This is the number Google weighs most heavily.', 'under 2.5s'],
    TBT: ['Total Blocking Time', 'How long the page sits frozen, ignoring taps and scrolls, while it finishes loading.', 'under 200ms'],
    CLS: ['Cumulative Layout Shift', 'How much the page jumps around while loading, which is why people tap the wrong thing.', 'under 0.1'],
    'Speed Index': ['Speed Index', 'How quickly the page visibly fills in.', 'under 3.4s'],
    'Time to Interactive': ['Time to Interactive', 'How long before the page actually responds when someone taps it.', 'under 3.8s'],
    'LCP (ms)': ['Largest Contentful Paint', 'Main content appears.', 'under 2500ms'],
    'INP (ms)': ['Interaction to Next Paint', 'How fast the page reacts to a tap.', 'under 200ms'],
    'FCP (ms)': ['First Contentful Paint', 'Anything appears.', 'under 1800ms']
  };

  var SCORE_LABEL = {
    performance: 'Performance',
    accessibility: 'Accessibility',
    seo: 'SEO',
    'best-practices': 'Best Practices'
  };

  function initReport() {
    var root = document.getElementById('tesReport');
    if (!root) return;

    var payload = loadResult();
    if (!payload || !payload.report || !payload.report.ok) {
      document.getElementById('tesReportEmpty').hidden = false;
      return;
    }

    var report = payload.report;
    document.getElementById('tesReportBody').hidden = false;
    document.title = 'Website Report Card \u2014 ' + report.domain;

    renderHero(report);
    renderScorecard(report);
    renderFindings(report);

    // Both enrichments are requested from the report itself, after it has rendered.
    // A Lighthouse run takes tens of seconds and Claude takes tens more; behind the
    // scan they would have meant a minute of spinner before anything appeared.
    //
    // The advice waits for the speed result rather than racing it. Fired together, the
    // advice request read payload.speed before PageSpeed had answered, so the write-up
    // was told there were no speed numbers -- and correctly said the scan could not
    // measure speed, in a report displaying Google's speed measurements directly above
    // it. Caught on the first live run against tevisengineering.com.
    requestAdvice(payload, requestSpeed(payload));
  }

  function renderHero(report) {
    var grade = report.scores.grade;
    var badge = document.getElementById('tesGrade');
    badge.textContent = grade;
    badge.style.background = GRADE_COLOR[grade] || '#64748b';

    document.getElementById('tesDomain').textContent = report.domain;
    document.getElementById('tesUrl').textContent = report.final_url;

    // The Website Watch card under the report: name the site, and carry it to signup.
    var watchDomain = document.getElementById('tesWatchDomain');
    var watchGo = document.getElementById('tesWatchGo');
    if (watchDomain && report.domain) watchDomain.textContent = report.domain;
    if (watchGo && report.domain) watchGo.href = 'website-watch.html?site=' + encodeURIComponent(report.domain) + '#start';
    document.getElementById('tesVerdict').textContent = GRADE_LINE[grade] || '';

    var meta = document.getElementById('tesMeta');
    meta.textContent = '';
    var bits = [
      'Platform: ' + report.platform.name,
      report.reachable
        ? 'Responded in ' + (report.response_ms != null ? report.response_ms + ' ms' : 'time')
        : 'Site did not load',
      'Pages read: ' + (report.pages_scanned.length || 0),
      'Scanned ' + new Date(report.scanned_at).toLocaleDateString(undefined,
        { year: 'numeric', month: 'short', day: 'numeric' })
    ];
    bits.forEach(function (b) { meta.appendChild(el('span', null, b)); });
  }

  function renderScorecard(report) {
    var wrap = document.getElementById('tesBars');
    wrap.textContent = '';
    var labels = report.category_labels || {};
    Object.keys(report.scores.by_category).forEach(function (key) {
      var score = report.scores.by_category[key];
      var color = score >= 80 ? '#2f7d4a' : (score >= 60 ? '#b8860f' : '#dc2626');
      wrap.appendChild(el('div', 'tes-lbl', labels[key] || key));
      var track = el('div', 'tes-track');
      var fill = el('div', 'tes-fill');
      fill.style.width = score + '%';
      fill.style.background = color;
      track.appendChild(fill);
      wrap.appendChild(track);
      wrap.appendChild(el('div', 'tes-val', String(score)));
    });
  }

  function renderFindings(report) {
    var wrap = document.getElementById('tesFindings');
    var count = document.getElementById('tesFindingCount');
    wrap.textContent = '';

    if (!report.findings.length) {
      count.textContent = 'None';
      wrap.appendChild(el('p', 'tes-none',
        'Every automated check passed. We found no broken contact links, no stale dates, '
        + 'no missing mobile support and no security problems. Keeping a site in that '
        + 'condition is the part most businesses find hard, and it is exactly what a '
        + 'maintenance plan is for.'));
      return;
    }

    count.textContent = String(report.findings.length);
    var labels = report.category_labels || {};
    var lastCategory = null;

    report.findings.forEach(function (f) {
      if (f.category !== lastCategory) {
        lastCategory = f.category;
        wrap.appendChild(el('h3', 'tes-cathead', labels[f.category] || f.category));
      }
      var meta = SEVERITY[f.severity] || SEVERITY.info;
      var card = el('div', 'tes-finding');
      card.style.borderLeftColor = meta[1];

      var head = el('div', 'tes-ftitle');
      var tag = el('span', 'tes-tag', meta[0]);
      tag.style.background = meta[1];
      head.appendChild(tag);
      head.appendChild(document.createTextNode(f.title));
      card.appendChild(head);

      card.appendChild(el('p', 'tes-detail', f.detail));
      if (f.evidence) card.appendChild(kv('What we saw', f.evidence));
      if (f.recommendation) card.appendChild(kv('The fix', f.recommendation));
      wrap.appendChild(card);
    });
  }

  function kv(label, value) {
    var row = el('div', 'tes-kv');
    row.appendChild(el('b', null, label + ': '));
    row.appendChild(document.createTextNode(value));
    return row;
  }

  // ---------------------------------------------------------------- speed section

  // Returns a promise that always resolves, never rejects: the advice request waits on
  // it, and a rejected speed lookup must not take the written section down with it.
  function requestSpeed(payload) {
    var section = document.getElementById('tesSpeed');
    var body = document.getElementById('tesSpeedBody');

    return post('/audit/speed', { url: payload.report.final_url }, 95000).then(function (res) {
      var data = res.data || {};
      if (!data.ok) {
        body.textContent = '';
        body.appendChild(el('p', 'tes-none', data.error === 'unmeasurable'
          ? 'Google could not load your site for measurement. That usually means the site '
            + 'blocks automated visits, and it is worth knowing: the same block can affect '
            + 'how Google reads your pages for search.'
          : 'Google\u2019s speed test did not return in time. It is a busy free service and '
            + 'this happens; it says nothing about your site.'));
        return;
      }
      // Read by the advice request, which is waiting on this promise.
      payload.speed = data;
      renderSpeed(data, body);
      section.classList.add('tes-arrived');
    }).catch(function () {
      body.textContent = '';
      body.appendChild(el('p', 'tes-none',
        'Google\u2019s speed test did not finish in time. Nothing to read into.'));
    });
  }

  function renderSpeed(data, body) {
    body.textContent = '';

    body.appendChild(el('p', 'tes-blurb',
      'These are Google\u2019s own measurements of your site loading on a phone, taken with '
      + 'the same tools Google uses to help decide search rankings. Visitors feel these '
      + 'numbers directly: most people give up on a page that takes more than a few seconds '
      + 'to appear, so a slow site quietly costs you calls before anyone sees your work.'));

    var scores = el('div', 'tes-scores');
    Object.keys(data.scores).forEach(function (key) {
      var value = data.scores[key];
      var tile = el('div', 'tes-score');
      var num = el('div', 'tes-score-n', String(value));
      num.style.color = value >= 90 ? '#2f7d4a' : (value >= 50 ? '#b8860f' : '#dc2626');
      tile.appendChild(num);
      tile.appendChild(el('div', 'tes-score-l', SCORE_LABEL[key] || key));
      scores.appendChild(tile);
    });
    body.appendChild(scores);
    body.appendChild(el('p', 'tes-blurb-in', 'Scored 0 to 100, higher is better.'));

    if (data.metrics && Object.keys(data.metrics).length) {
      body.appendChild(el('p', 'tes-blurb-in', 'What was actually measured:'));
      body.appendChild(metricTable(data.metrics));
    }

    if (data.field) {
      body.appendChild(el('p', 'tes-blurb-in',
        'Real visitors: the same measurements from actual Chrome users on your site over '
        + 'the last 28 days. Three quarters of visits were at least this fast.'));
      body.appendChild(metricTable(data.field));
    }
  }

  function metricTable(metrics) {
    var table = el('table', 'tes-metrics');
    Object.keys(metrics).forEach(function (key) {
      var help = METRIC_HELP[key] || [key, '', ''];
      var tr = el('tr');
      var name = el('td', 'tes-mname', help[0]);
      if (help[0].toLowerCase() !== key.toLowerCase()) {
        name.appendChild(el('span', 'tes-mabbr', key));
      }
      tr.appendChild(name);
      tr.appendChild(el('td', 'tes-mval', String(metrics[key])));
      var desc = el('td', 'tes-mdesc', help[1]);
      if (help[2]) desc.appendChild(el('i', 'tes-good', 'Google considers good: ' + help[2]));
      tr.appendChild(desc);
      table.appendChild(tr);
    });
    return table;
  }

  // ---------------------------------------------------------------- advice section

  function requestAdvice(payload, speedReady) {
    var section = document.getElementById('tesAdvice');
    var body = document.getElementById('tesAdviceBody');

    // Wait for the speed numbers, but not indefinitely. A hung PageSpeed call must not
    // cost the visitor the written section entirely, so after 60s the advice goes out
    // with whatever arrived.
    var settled = Promise.race([
      speedReady,
      new Promise(function (resolve) { setTimeout(resolve, 60000); })
    ]);

    settled.then(function () {
      return post('/audit/advice', {
        url: payload.report.final_url,
        notes: payload.notes || '',
        speed: payload.speed || null
      }, 150000);
    }).then(function (res) {
      var data = res.data || {};
      if (!data.ok || !data.advice) {
        adviceFallback(section, body, data.error);
        return;
      }
      renderAdvice(data.advice, body);
      section.classList.add('tes-arrived');
    }).catch(function () {
      adviceFallback(section, body);
    });
  }

  // Written recommendations are the section most likely to fail, because it depends on
  // a third service. It degrades to the honest version rather than to an empty box: the
  // findings above are the deliverable and they are already on the page.
  function adviceFallback(section, body, code) {
    body.textContent = '';
    body.appendChild(el('p', 'tes-none', code === 'rate_limited' || code === 'busy'
      ? 'We are writing a lot of these today and hit our own daily limit on this section. '
        + 'Everything above is complete. Send us the report and we will write the plan by hand.'
      : 'We could not generate the written recommendations for this scan. Everything above '
        + 'is complete, and we are glad to walk through it with you on a short call.'));
  }

  function renderAdvice(advice, body) {
    body.textContent = '';

    if (advice.headline) body.appendChild(el('p', 'tes-adv-headline', advice.headline));
    if (advice.opening) body.appendChild(el('p', 'tes-adv-p', advice.opening));

    if (advice.priorities && advice.priorities.length) {
      body.appendChild(el('h3', 'tes-adv-h', 'What to fix first'));
      var list = el('ol', 'tes-priorities');
      advice.priorities.forEach(function (p) {
        var item = el('li');
        item.appendChild(el('strong', null, p.title));
        item.appendChild(el('p', 'tes-adv-why', p.why));
        if (p.approach) item.appendChild(el('p', 'tes-adv-how', p.approach));
        list.appendChild(item);
      });
      body.appendChild(list);
    }

    if (advice.answers && advice.answers.length) {
      body.appendChild(el('h3', 'tes-adv-h', 'Your questions'));
      advice.answers.forEach(function (a) {
        var block = el('div', 'tes-answer');
        block.appendChild(el('strong', null, a.question));
        block.appendChild(el('p', 'tes-adv-p', a.answer));
        body.appendChild(block);
      });
    }

    if (advice.quick_wins && advice.quick_wins.length) {
      body.appendChild(el('h3', 'tes-adv-h', 'Things you can do yourself'));
      var wins = el('ul', 'tes-wins');
      advice.quick_wins.forEach(function (w) { wins.appendChild(el('li', null, w)); });
      body.appendChild(wins);
    }

    if (advice.closing) {
      var close = el('p', 'tes-adv-close', advice.closing);
      body.appendChild(close);
    }

    body.appendChild(el('p', 'tes-adv-fine',
      'This section was written by an AI reviewing the findings above, in the way we would '
      + 'write it ourselves. It only discusses what the scan actually found. Every number '
      + 'and every defect above was measured, not estimated.'));
  }

  // ---------------------------------------------------------------- boot

  function boot() {
    initScanner();
    initReport();
    var printBtn = document.getElementById('tesPrint');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
