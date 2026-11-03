/*!
 * DripFinder v0.3.0 - Michael Head Marketing
 * Config-driven "Help Me Choose" quiz engine for client websites.
 * One engine for every client. Each client is a config (menu, prices, booking links, colors).
 * Industry-neutral: every visitor-facing string comes from the config, with neutral defaults.
 * Renders inside a Shadow DOM so the host site's CSS cannot break it.
 * Stores nothing. Answers stay in the visitor's browser.
 */
(function () {
  'use strict';
  if (window.DripFinder && window.DripFinder.version) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.DripFinder.autoMount);
    else window.DripFinder.autoMount();
    return;
  }

  var VERSION = '0.3.0';

  // Neutral defaults for every visitor-facing string the engine can show.
  // A config overrides any of these through its "ui" block (or resultTitle, kept for back-compat).
  var UI = {
    stepOf: 'Step {n} of {total}',
    pickAll: 'Pick all that fit.',
    pickOne: 'Pick one.',
    next: 'Next',
    seeMatch: 'See my match',
    back: 'Back',
    startOver: 'Start over',
    privacyNote: 'Nothing you pick here is saved.',
    beforeYouBook: 'Before you book',
    yourMatch: 'Your match',
    resultTitle: "Here's the best fit for you",
    anotherFit: 'Another good fit',
    basedOnPrefix: 'Based on: ',
    basedOnFallback: 'Based on what you picked.',
    alsoWorthLook: 'Also worth a look',
    bookPrefix: 'Book ',
    textPrefix: 'Text ',
    call: 'Call',
    backToBest: 'Back to my best match',
    getCareNow: 'Get care now',
    talkTitle: 'Talk with us first',
    afterHoursLabel: 'Book after hours',
    ariaLabel: 'Help Me Choose',
    quizName: 'Help Me Choose quiz',
    resultSmsText: 'Hi {contact}, I used the {quiz} on your site and it matched me with {item}. Can you help me book?',
    stopSmsText: 'Hi {contact}, I used the {quiz} on your site and want to check what is safe for me.'
  };

  /* ---------- helpers ---------- */

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : v);
      });
    }
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function find(list, id) {
    for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function fill(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] !== undefined && vars[k] !== null ? vars[k] : '';
    });
  }

  function emit(cfg, name, detail) {
    var d = Object.assign({ clinic: cfg.clinic && cfg.clinic.name, version: VERSION }, detail || {});
    try { window.dispatchEvent(new CustomEvent('dripfinder:' + name, { detail: d })); } catch (e) {}
    try { window.dataLayer = window.dataLayer || []; window.dataLayer.push(Object.assign({ event: 'dripfinder_' + name }, d)); } catch (e) {}
    try { if (typeof window.gtag === 'function') window.gtag('event', 'dripfinder_' + name, d); } catch (e) {}
  }

  function digits(s) { return String(s || '').replace(/\D/g, ''); }

  /* ---------- scoring ---------- */

  function weights(cfg, answers) {
    var w = {};
    cfg.questions.forEach(function (q) {
      (answers[q.id] || []).forEach(function (oid) {
        var o = find(q.options, oid);
        if (o && o.tags) Object.keys(o.tags).forEach(function (t) { w[t] = (w[t] || 0) + o.tags[t]; });
      });
    });
    return w;
  }

  function rank(cfg, answers) {
    var w = weights(cfg, answers);
    var scored = cfg.items.filter(function (d) { return !d.hideFromMatch; }).map(function (d, i) {
      var s = 0;
      Object.keys(d.tags || {}).forEach(function (t) { s += (w[t] || 0) * d.tags[t]; });
      return { item: d, score: s, order: i };
    });
    scored.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    if (scored.length && scored[0].score === 0 && cfg.fallback) {
      var fb = scored.filter(function (x) { return x.item.id === cfg.fallback; })[0];
      if (fb) scored = [fb].concat(scored.filter(function (x) { return x !== fb; }));
    }
    return scored;
  }

  function stopFor(cfg, answers) {
    var level = null;
    cfg.questions.forEach(function (q) {
      (answers[q.id] || []).forEach(function (oid) {
        var o = find(q.options, oid);
        if (o && o.stop) {
          if (o.stop === 'emergency' || !level) level = o.stop;
        }
      });
    });
    return level;
  }

  function flags(cfg, answers) {
    var f = {};
    cfg.questions.forEach(function (q) {
      (answers[q.id] || []).forEach(function (oid) {
        var o = find(q.options, oid);
        if (o && o.flag) f[o.flag] = true;
      });
    });
    return f;
  }

  /* ---------- styles ---------- */

  function css(b) {
    return (
      ':host{display:block}' +
      '*{box-sizing:border-box}' +
      '.df{--a:' + b.accent + ';--ab:' + b.button + ';--ai:' + b.accentInk + ';--soft:' + b.soft + ';--bg:' + b.bg + ';--fg:' + b.fg + ';--mu:' + b.muted + ';--ln:' + b.line + ';--sf:' + b.surface + ';--r:' + b.radius + ';' +
      'font-family:' + b.font + ';color:var(--fg);background:var(--bg);border:1px solid var(--ln);border-radius:calc(var(--r) + 6px);padding:clamp(18px,4.5vw,34px);max-width:640px;margin:0 auto;line-height:1.5;font-size:16px;-webkit-font-smoothing:antialiased}' +
      '.df h2{font-family:' + b.headingFont + ';font-size:clamp(1.35rem,4.8vw,1.8rem);line-height:1.15;margin:0 0 6px;font-weight:' + b.headingWeight + ';letter-spacing:-0.01em;text-wrap:balance;outline:none}' +
      '.df p{margin:0}' +
      '.sub{color:var(--mu);font-size:.95rem;margin-bottom:18px!important}' +
      '.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;min-height:28px}' +
      '.count{font-size:.76rem;letter-spacing:.09em;text-transform:uppercase;color:var(--mu);font-weight:600}' +
      '.bar{height:5px;background:var(--ln);border-radius:5px;overflow:hidden;margin-bottom:22px}' +
      '.bar i{display:block;height:100%;background:var(--a);transition:width .25s ease}' +
      '.opts{display:grid;gap:10px;margin:0;padding:0;list-style:none}' +
      '.opts.two{grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))}' +
      '.opt{width:100%;text-align:left;font:inherit;color:inherit;background:var(--sf);border:1.5px solid var(--ln);border-radius:var(--r);padding:13px 15px;min-height:54px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:border-color .12s,background .12s,transform .12s;height:100%}' +
      '.opt:hover{border-color:var(--a)}' +
      '.opt:active{transform:scale(.99)}' +
      '.opt[aria-pressed="true"]{border-color:var(--a);background:var(--soft)}' +
      '.opt b{font-weight:600;display:block}' +
      '.opt small{display:block;color:var(--mu);font-size:.86rem;margin-top:1px}' +
      '.tick{flex:none;width:22px;height:22px;border-radius:7px;border:1.5px solid var(--ln);display:grid;place-items:center;font-size:13px;line-height:1;background:var(--bg);color:var(--ai)}' +
      '.opt[aria-pressed="true"] .tick{background:var(--ab);border-color:var(--ab)}' +
      '.row{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}' +
      '.btn{font:inherit;font-weight:700;border-radius:var(--r);padding:14px 20px;min-height:50px;cursor:pointer;border:1.5px solid var(--ab);background:var(--ab);color:var(--ai);text-decoration:none;display:inline-flex;align-items:center;justify-content:center;text-align:center;gap:8px}' +
      '.btn:hover{filter:brightness(1.08)}' +
      '.btn.wide{flex:1 1 220px}' +
      '.btn.ghost{background:transparent;color:var(--fg);border-color:var(--ln);font-weight:600}' +
      '.btn.ghost:hover{border-color:var(--a);filter:none}' +
      '.btn[disabled]{opacity:.4;cursor:not-allowed}' +
      '.back{font:inherit;font-size:.9rem;background:none;border:0;color:var(--mu);cursor:pointer;padding:6px 4px;text-decoration:underline;text-underline-offset:3px;min-height:44px;display:inline-flex;align-items:center}' +
      '.match{background:var(--sf);border:1.5px solid var(--a);border-radius:var(--r);padding:clamp(16px,4vw,22px);display:grid;gap:10px}' +
      '.tag{font-size:.74rem;letter-spacing:.09em;text-transform:uppercase;color:var(--ab);font-weight:700}' +
      '.mh{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}' +
      '.match h3{font-family:' + b.headingFont + ';font-weight:' + b.headingWeight + ';font-size:clamp(1.4rem,5vw,1.7rem);line-height:1.12;margin:0}' +
      '.price{font-weight:700;font-size:1.25rem;font-variant-numeric:tabular-nums}' +
      '.why{font-size:.9rem;color:var(--mu)}' +
      '.facts{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 0;padding:0;list-style:none}' +
      '.facts li{font-size:.8rem;font-weight:600;background:var(--soft);color:var(--fg);border-radius:999px;padding:4px 10px}' +
      '.tips{display:grid;gap:8px;margin-top:4px}' +
      '.tip{font-size:.9rem;background:var(--bg);border:1px dashed var(--ln);border-radius:calc(var(--r) - 2px);padding:10px 12px}' +
      '.tip a{color:var(--ab);font-weight:600}' +
      '.alt{margin-top:22px}' +
      '.alt h4{font-size:.76rem;letter-spacing:.09em;text-transform:uppercase;color:var(--mu);margin:0 0 8px;font-weight:600}' +
      '.alt .opt{min-height:52px;padding:10px 14px;justify-content:space-between}' +
      '.alt .opt em{font-style:normal;font-weight:700;font-variant-numeric:tabular-nums;flex:none}' +
      '.stop{border:1.5px solid var(--ln);border-radius:var(--r);padding:18px;background:var(--sf);display:grid;gap:10px}' +
      '.stop.emergency{border-color:#b42318}' +
      '.stop.emergency .tag{color:#b42318}' +
      '.num{font-weight:700;font-size:1.15rem;font-variant-numeric:tabular-nums;user-select:all}' +
      '.note{font-size:.78rem;color:var(--mu);margin-top:18px!important}' +
      '.df :focus-visible{outline:2px solid var(--a);outline-offset:2px}' +
      '@media (prefers-reduced-motion:reduce){*{transition:none!important}}'
    );
  }

  /* ---------- widget ---------- */

  function normalize(cfg) {
    var b = Object.assign({
      accent: '#0e7c86', button: null, accentInk: '#ffffff', soft: '#e6f4f6', bg: '#ffffff', surface: '#f6f9fa',
      fg: '#14232a', muted: '#55666d', line: '#d7e2e6', radius: '12px', font: 'inherit', headingFont: 'inherit', headingWeight: '700'
    }, cfg.brand || {});
    if (!b.button) b.button = b.accent;
    if (b.headingFont === 'inherit' && b.font !== 'inherit') b.headingFont = b.font;
    cfg.brand = b;
    cfg.ui = Object.assign({}, UI, cfg.ui || {});
    cfg.clinic = cfg.clinic || { name: 'Clinic' };
    cfg.disclaimer = cfg.disclaimer || '';
    cfg.questions = cfg.questions || [];
    cfg.items = cfg.items || [];
    return cfg;
  }

  function mount(host, config) {
    var cfg = normalize(JSON.parse(JSON.stringify(config)));
    var ui = cfg.ui;
    var contact = cfg.clinic.contactName || cfg.clinic.name || '';
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var app = el('div', { class: 'df', role: 'region', 'aria-label': (cfg.clinic.name ? cfg.clinic.name + ' ' : '') + ui.ariaLabel });
    var live = el('div', { 'aria-live': 'polite', style: 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden' });
    root.appendChild(el('style', { text: css(cfg.brand) }));
    root.appendChild(app);
    root.appendChild(live);

    var state;
    function reset() { state = { step: 0, answers: {}, pick: 0, started: false }; }
    reset();

    // Deep links: ?feel=hungover,sick preselects answers on the first question (used by homepage symptom chips).
    try {
      var qs = new URLSearchParams(location.search);
      var q0 = cfg.questions[0];
      var pre = (qs.get('feel') || '').split(',').filter(function (id) { return q0 && find(q0.options, id); });
      if (pre.length) {
        state.answers[q0.id] = q0.multi ? pre : [pre[0]];
        state.started = true;
        emit(cfg, 'start', { preselect: pre.join('|'), src: qs.get('src') || '' });
      }
    } catch (e) {}

    function total() { return cfg.questions.length; }

    function focusHeading() {
      var h = app.querySelector('h2');
      if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
      try {
        var r = host.getBoundingClientRect();
        if (r.top < 0) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {}
    }

    function render(refocus) {
      app.innerHTML = '';
      if (state.step < total()) renderQuestion();
      else {
        var stop = stopFor(cfg, state.answers);
        if (stop) renderStop(stop); else renderResult();
      }
      if (refocus) focusHeading();
    }

    function header(label, pct, showBack, backFn) {
      app.appendChild(el('div', { class: 'top' }, [
        el('span', { class: 'count', text: label }),
        showBack ? el('button', { class: 'back', type: 'button', text: backFn === restart ? ui.startOver : ui.back, onclick: backFn }) : null
      ]));
      app.appendChild(el('div', { class: 'bar', 'aria-hidden': 'true' }, [el('i', { style: 'width:' + pct + '%' })]));
    }

    function renderQuestion() {
      var q = cfg.questions[state.step];
      var chosen = state.answers[q.id] || [];
      header(q.eyebrow || fill(ui.stepOf, { n: state.step + 1, total: total() }), Math.round((state.step / total()) * 100), state.step > 0, function () { state.step--; render(true); });
      app.appendChild(el('h2', { text: q.title }));
      app.appendChild(el('p', { class: 'sub', text: q.hint || (q.multi ? ui.pickAll : ui.pickOne) }));

      var list = el('ul', { class: 'opts' + (q.options.length > 5 ? ' two' : '') });
      q.options.forEach(function (o) {
        var on = chosen.indexOf(o.id) > -1;
        list.appendChild(el('li', null, [el('button', {
          class: 'opt', type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: function () { choose(q, o); }
        }, [
          q.multi ? el('span', { class: 'tick', 'aria-hidden': 'true', text: on ? '✓' : '' }) : null,
          el('span', null, [el('b', { text: o.label }), o.sub ? el('small', { text: o.sub }) : null])
        ])]));
      });
      app.appendChild(list);

      if (q.multi) {
        app.appendChild(el('div', { class: 'row' }, [el('button', {
          class: 'btn wide', type: 'button', text: state.step === total() - 1 ? ui.seeMatch : ui.next,
          disabled: chosen.length === 0, onclick: function () { next(); }
        })]));
      }
      app.appendChild(el('p', { class: 'note', text: ui.privacyNote }));
    }

    function choose(q, o) {
      if (!state.started) { state.started = true; emit(cfg, 'start'); }
      var cur = state.answers[q.id] || [];
      if (q.multi) {
        if (o.exclusive) cur = cur.indexOf(o.id) > -1 ? [] : [o.id];
        else {
          cur = cur.filter(function (id) { var x = find(q.options, id); return !(x && x.exclusive); });
          var i = cur.indexOf(o.id);
          if (i > -1) cur.splice(i, 1); else cur.push(o.id);
        }
        state.answers[q.id] = cur;
        render(false);
        // Keep keyboard focus on the option just toggled (render rebuilt the DOM).
        var opts = app.querySelectorAll('.opt');
        var oi = q.options.indexOf(o);
        if (opts[oi]) { try { opts[oi].focus({ preventScroll: true }); } catch (e) { opts[oi].focus(); } }
      } else {
        state.answers[q.id] = [o.id];
        emit(cfg, 'answer', { question: q.id, answer: o.id });
        next();
      }
    }

    function next() {
      var q = cfg.questions[state.step];
      if (q.multi) emit(cfg, 'answer', { question: q.id, answer: (state.answers[q.id] || []).join('|') });
      state.step++;
      if (state.step >= total()) {
        state.pick = 0;
        var stop = stopFor(cfg, state.answers);
        if (stop) emit(cfg, 'safety_stop', { level: stop });
        else emit(cfg, 'result', { item: rank(cfg, state.answers)[0].item.id });
      }
      render(true);
    }

    function bookHref(item) {
      var base = item.bookUrl || cfg.clinic.bookingUrl || '#';
      if (base === '#') return base;
      try {
        var u = new URL(base, location.href);
        var utm = cfg.utm || {};
        Object.keys(utm).forEach(function (k) { u.searchParams.set('utm_' + k, utm[k]); });
        if (cfg.utm) u.searchParams.set('utm_content', item.id);
        return u.toString();
      } catch (e) { return base; }
    }

    function smsHref(text) {
      var n = digits(cfg.clinic.smsNumber || cfg.clinic.phone);
      if (!n) return null;
      if (n.length === 10) n = '1' + n;
      return 'sms:+' + n + '?&body=' + encodeURIComponent(text);
    }

    function textButton(text, label) {
      var href = smsHref(text);
      if (!href) return null;
      return el('a', {
        class: 'btn ghost wide', href: href, text: label || (ui.textPrefix + (cfg.clinic.contactName || cfg.clinic.name)),
        onclick: function () { emit(cfg, 'text_click', {}); }
      });
    }

    function pickedLabels() {
      var out = [];
      cfg.questions.forEach(function (q) {
        if (!q.showInWhy) return;
        (state.answers[q.id] || []).forEach(function (oid) { var o = find(q.options, oid); if (o) out.push(o.short || o.label); });
      });
      return out;
    }

    function renderStop(level) {
      var s = (cfg.stops || {})[level] || {};
      header(ui.beforeYouBook, 100, true, function () { state.step = total() - 1; render(true); });
      app.appendChild(el('h2', { text: s.title || ui.talkTitle }));
      var box = el('div', { class: 'stop ' + level });
      box.appendChild(el('p', { class: 'tag', text: level === 'emergency' ? ui.getCareNow : cfg.clinic.name }));
      box.appendChild(el('p', { text: s.body || '' }));
      if (level !== 'emergency' && cfg.clinic.phone) {
        box.appendChild(el('p', { class: 'num', text: cfg.clinic.phone }));
        var row = el('div', { class: 'row' });
        var tb = textButton(s.smsText || fill(ui.stopSmsText, { contact: contact, quiz: ui.quizName }), s.textLabel);
        if (tb) { tb.className = 'btn wide'; row.appendChild(tb); }
        row.appendChild(el('a', { class: 'btn ghost wide', href: 'tel:+1' + digits(cfg.clinic.phone).slice(-10), text: ui.call, onclick: function () { emit(cfg, 'call_click', {}); } }));
        box.appendChild(row);
      }
      if (level === 'emergency' && s.cta) {
        box.appendChild(el('div', { class: 'row' }, [el('a', { class: 'btn wide', href: s.cta.href, text: s.cta.label })]));
      }
      app.appendChild(box);
      app.appendChild(el('p', { class: 'note', text: cfg.disclaimer }));
      live.textContent = s.title || '';
    }

    function renderResult() {
      var ranked = rank(cfg, state.answers);
      var cur = ranked[state.pick].item;
      var w = weights(cfg, state.answers);
      var f = flags(cfg, state.answers);

      header(ui.yourMatch, 100, true, restart);
      app.appendChild(el('h2', { text: state.pick === 0 ? (cfg.resultTitle || ui.resultTitle) : ui.anotherFit }));
      var why = pickedLabels();
      app.appendChild(el('p', { class: 'sub', text: why.length ? ui.basedOnPrefix + why.join(', ') + '.' : ui.basedOnFallback }));

      var card = el('div', { class: 'match' });
      card.appendChild(el('p', { class: 'tag', text: cfg.clinic.name }));
      card.appendChild(el('div', { class: 'mh' }, [el('h3', { text: cur.name }), cur.price ? el('span', { class: 'price', text: cur.price }) : null]));
      if (cur.blurb) card.appendChild(el('p', { text: cur.blurb }));
      if (cur.facts && cur.facts.length) {
        var fl = el('ul', { class: 'facts' });
        cur.facts.forEach(function (t) { fl.appendChild(el('li', { text: t })); });
        card.appendChild(fl);
      }

      var tips = el('div', { class: 'tips' });
      (cfg.addons || []).forEach(function (a) {
        if (a.notFor && a.notFor.indexOf(cur.id) > -1) return;
        if (a.onlyFor && a.onlyFor.indexOf(cur.id) === -1) return;
        if (a.whenTag && !((w[a.whenTag] || 0) >= (a.min || 1))) return;
        tips.appendChild(el('p', { class: 'tip', text: a.text }));
      });
      if (f.newClient && cfg.newClientNote) tips.appendChild(el('p', { class: 'tip', text: cfg.newClientNote }));
      if (cfg.afterHours) {
        tips.appendChild(el('p', { class: 'tip' }, [
          cfg.afterHours.text + ' ',
          el('a', { href: bookHref({ id: 'after-hours', bookUrl: cfg.afterHours.url }), target: '_top', text: cfg.afterHours.linkLabel || ui.afterHoursLabel, onclick: function () { emit(cfg, 'book_click', { item: cur.id, after_hours: true }); } })
        ]));
      }
      var row = el('div', { class: 'row', style: 'margin-top:6px' }, [
        el('a', {
          class: 'btn wide', href: bookHref(cur), target: '_top', rel: 'noopener',
          text: ui.bookPrefix + cur.name,
          onclick: function () { emit(cfg, 'book_click', { item: cur.id }); }
        })
      ]);
      var tb = textButton(fill(ui.resultSmsText, { contact: contact, quiz: ui.quizName, item: cur.name }), cfg.clinic.textLabel);
      if (tb) row.appendChild(tb);
      card.appendChild(row);
      if (tips.childNodes.length) card.appendChild(tips);
      app.appendChild(card);

      if (state.pick === 0) {
        var others = ranked.slice(1, 3).filter(function (r) { return r.score > 0; });
        var custom = cfg.customOption ? find(cfg.items, cfg.customOption) : null;
        if (others.length || custom) {
          var alt = el('div', { class: 'alt' }, [el('h4', { text: ui.alsoWorthLook })]);
          var list = el('ul', { class: 'opts' });
          others.forEach(function (r) {
            var idx = ranked.indexOf(r);
            list.appendChild(el('li', null, [el('button', {
              class: 'opt', type: 'button',
              onclick: function () { state.pick = idx; emit(cfg, 'alt_view', { item: r.item.id }); render(true); }
            }, [el('span', null, [el('b', { text: r.item.name }), r.item.short ? el('small', { text: r.item.short }) : null]), r.item.price ? el('em', { text: r.item.price }) : null])]));
          });
          if (custom) {
            list.appendChild(el('li', null, [el('a', {
              class: 'opt', href: bookHref(custom), target: '_top', style: 'text-decoration:none',
              onclick: function () { emit(cfg, 'book_click', { item: custom.id }); }
            }, [el('span', null, [el('b', { text: custom.name }), custom.short ? el('small', { text: custom.short }) : null]), custom.price ? el('em', { text: custom.price }) : null])]));
          }
          alt.appendChild(list);
          app.appendChild(alt);
        }
      } else {
        app.appendChild(el('div', { class: 'row' }, [el('button', { class: 'btn ghost', type: 'button', text: ui.backToBest, onclick: function () { state.pick = 0; render(true); } })]));
      }
      app.appendChild(el('p', { class: 'note', text: cfg.disclaimer }));
      live.textContent = 'Your match is ' + cur.name;
    }

    function restart() { reset(); emit(cfg, 'restart'); render(true); }

    render(false);
    return { restart: restart, host: host };
  }

  /* ---------- auto-mount ---------- */

  function autoMount() {
    var nodes = document.querySelectorAll('[data-dripfinder]:not([data-dripfinder-ready])');
    Array.prototype.forEach.call(nodes, function (node) {
      node.setAttribute('data-dripfinder-ready', '1');
      var url = node.getAttribute('data-config');
      var inline = node.querySelector('script[type="application/json"]');
      if (inline) {
        try { var c = JSON.parse(inline.textContent); inline.remove(); mount(node, c); } catch (e) { console.error('DripFinder config error', e); }
      } else if (url) {
        fetch(url).then(function (r) { return r.json(); }).then(function (c) { mount(node, c); })
          .catch(function (e) { console.error('DripFinder config error', e); });
      }
    });
  }

  window.DripFinder = { version: VERSION, mount: mount, autoMount: autoMount, _rank: rank };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
  else autoMount();
})();
