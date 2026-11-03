'use strict';
/*
 * Node-side mirror of the engine's scoring and booking-link logic (src/dripfinder.js).
 * Used by build (crawlable feeling -> item table) and the test suite (expected matches).
 * A Playwright test (tests/parity.spec.js) asserts this mirror agrees with the real
 * in-browser engine, so the two cannot silently drift.
 */

function findOption(question, id) {
  var opts = question.options || [];
  for (var i = 0; i < opts.length; i++) if (opts[i].id === id) return opts[i];
  return null;
}

function weights(cfg, answers) {
  var w = {};
  (cfg.questions || []).forEach(function (q) {
    (answers[q.id] || []).forEach(function (oid) {
      var o = findOption(q, oid);
      if (o && o.tags) Object.keys(o.tags).forEach(function (t) { w[t] = (w[t] || 0) + o.tags[t]; });
    });
  });
  return w;
}

function rank(cfg, answers) {
  var w = weights(cfg, answers);
  var scored = (cfg.items || []).filter(function (d) { return !d.hideFromMatch; }).map(function (d, i) {
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

function topItem(cfg, answers) {
  var r = rank(cfg, answers);
  return r.length ? r[0].item : null;
}

// Mirrors the engine bookHref(). base is absolute, so the URL base argument is only a fallback.
function bookHref(cfg, item) {
  var base = item.bookUrl || (cfg.clinic && cfg.clinic.bookingUrl) || '#';
  if (base === '#') return base;
  var u = new URL(base, 'https://example.invalid/');
  var utm = cfg.utm || {};
  Object.keys(utm).forEach(function (k) { u.searchParams.set('utm_' + k, utm[k]); });
  if (cfg.utm) u.searchParams.set('utm_content', item.id);
  return u.toString();
}

module.exports = { weights: weights, rank: rank, topItem: topItem, bookHref: bookHref, findOption: findOption };
