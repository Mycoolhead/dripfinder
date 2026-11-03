'use strict';
/*
 * Semantic rule checks (beyond JSON Schema shape), per PROMPT Phase 1 step 5.
 * runRules(cfg) returns an array of human-readable error strings; empty means pass.
 */

var EM_DASH = /[—―]/; // em dash, horizontal bar

// Keys whose string values are technical (URLs, ids, colors, tracking) and not visitor copy.
var TECH_KEYS = {
  bookUrl: 1, url: 1, href: 1, bookingUrl: 1, page: 1, src: 1, id: 1, feel: 1, item: 1,
  smsNumber: 1, phone: 1, accent: 1, button: 1, accentInk: 1, soft: 1, bg: 1, surface: 1,
  fg: 1, muted: 1, line: 1, radius: 1, font: 1, headingFont: 1, headingWeight: 1,
  containerId: 1, date: 1, by: 1, vertical: 1, version: 1, flag: 1, stop: 1, whenTag: 1,
  source: 1, medium: 1, campaign: 1
};

function looksTechnical(v) {
  return /^(https?:|tel:|sms:|mailto:|\/|#|data:)/.test(v) || /^#[0-9a-fA-F]{3,8}$/.test(v);
}

// Collect every visitor-facing string with a path label, skipping technical fields.
function collectStrings(node, keyName, pathStr, out) {
  if (node == null) return;
  if (typeof node === 'string') {
    if (keyName && TECH_KEYS[keyName]) return;
    if (looksTechnical(node)) return;
    out.push({ path: pathStr, value: node });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach(function (v, i) { collectStrings(v, keyName, pathStr + '[' + i + ']', out); });
    return;
  }
  if (typeof node === 'object') {
    // tags objects are keyed by tag name with numeric values; nothing visitor-facing.
    Object.keys(node).forEach(function (k) {
      if (k === 'tags' || k === 'brand' || k === 'utm') return;
      collectStrings(node[k], k, pathStr ? pathStr + '.' + k : k, out);
    });
  }
}

function tagSet(list, key) {
  var s = {};
  (list || []).forEach(function (o) {
    var tags = (o[key] || o.tags);
    if (tags) Object.keys(tags).forEach(function (t) { s[t] = true; });
  });
  return s;
}

function runRules(cfg) {
  var errors = [];
  var isIv = cfg.vertical === 'iv';

  // --- IV safety requirements ---
  if (isIv) {
    var safety = (cfg.questions || []).filter(function (q) {
      return (q.options || []).some(function (o) { return o.stop; });
    });
    if (!safety.length) {
      errors.push('vertical "iv": no safety question (no option has a "stop").');
    } else {
      var stops = {};
      (cfg.questions || []).forEach(function (q) {
        (q.options || []).forEach(function (o) { if (o.stop) stops[o.stop] = true; });
      });
      if (!stops.emergency) errors.push('vertical "iv": no option routes to the "emergency" stop (call 911).');
      if (!stops.talk) errors.push('vertical "iv": no option routes to the "talk" stop (talk to the clinic first).');
      // The stop screens themselves must exist with copy.
      var defined = cfg.stops || {};
      if (stops.emergency && (!defined.emergency || !defined.emergency.body)) {
        errors.push('vertical "iv": stops.emergency is missing or has no body.');
      }
      if (stops.talk && (!defined.talk || !defined.talk.body)) {
        errors.push('vertical "iv": stops.talk is missing or has no body.');
      }
    }
    if (!cfg.disclaimer || !String(cfg.disclaimer).trim()) {
      errors.push('vertical "iv": disclaimer is empty.');
    }
  }

  // --- Booking URL protocols ---
  function checkUrl(label, u) {
    if (u == null) return;
    if (!/^(https:\/\/|sms:|tel:)/.test(String(u))) {
      errors.push(label + ' must start with https://, sms: or tel: (got "' + u + '").');
    }
  }
  (cfg.items || []).forEach(function (it) {
    if (it.bookUrl != null) checkUrl('items[' + it.id + '].bookUrl', it.bookUrl);
  });
  if (cfg.clinic && cfg.clinic.bookingUrl != null) checkUrl('clinic.bookingUrl', cfg.clinic.bookingUrl);
  if (cfg.afterHours && cfg.afterHours.url != null) checkUrl('afterHours.url', cfg.afterHours.url);

  // --- Tag balance: option tags and item tags must be the same set ---
  var optTags = {};
  (cfg.questions || []).forEach(function (q) {
    (q.options || []).forEach(function (o) {
      if (o.tags) Object.keys(o.tags).forEach(function (t) { optTags[t] = true; });
    });
  });
  var itemTags = {};
  (cfg.items || []).forEach(function (it) {
    if (it.tags) Object.keys(it.tags).forEach(function (t) { itemTags[t] = true; });
  });
  Object.keys(optTags).forEach(function (t) {
    if (!itemTags[t]) errors.push('tag "' + t + '" is used by an answer option but never by an item.');
  });
  Object.keys(itemTags).forEach(function (t) {
    if (!optTags[t]) errors.push('tag "' + t + '" is used by an item but never by an answer option.');
  });

  // --- Copy voice: em dashes, and standalone "drip" for iv ---
  // Proper nouns and product names are allowed to contain "Drip" (e.g. the clinic's own
  // brand name, or a service named "Build Your Custom Drip"). We strip those phrases out
  // before testing, so only "drip" used as a common noun for an IV is flagged.
  var allowedPhrases = [];
  if (cfg.clinic) {
    [cfg.clinic.name, cfg.clinic.contactName, cfg.clinic.textLabel].forEach(function (p) {
      if (p) allowedPhrases.push(p);
    });
  }
  (cfg.items || []).forEach(function (it) { if (it.name) allowedPhrases.push(it.name); });
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var strings = [];
  collectStrings(cfg, null, '', strings);
  strings.forEach(function (s) {
    if (EM_DASH.test(s.value)) {
      errors.push('em dash in visitor-facing string at ' + s.path + ': "' + s.value + '"');
    }
    if (isIv) {
      var cleaned = s.value;
      allowedPhrases.forEach(function (p) { cleaned = cleaned.replace(new RegExp(escapeRe(p), 'g'), ''); });
      cleaned = cleaned.replace(/IV drips?/gi, '');
      if (/\bdrips?\b/i.test(cleaned)) {
        errors.push('standalone "drip" in visitor-facing string at ' + s.path + ' (use "IV"): "' + s.value + '"');
      }
    }
  });

  // --- Referential integrity (not strictly required, but catches dead references) ---
  var ids = {};
  (cfg.items || []).forEach(function (it) { ids[it.id] = true; });
  if (cfg.fallback && !ids[cfg.fallback]) errors.push('fallback "' + cfg.fallback + '" is not an item id.');
  if (cfg.customOption && !ids[cfg.customOption]) errors.push('customOption "' + cfg.customOption + '" is not an item id.');
  (cfg.addons || []).forEach(function (a, i) {
    (a.notFor || []).concat(a.onlyFor || []).forEach(function (id) {
      if (!ids[id]) errors.push('addons[' + i + '] references unknown item id "' + id + '".');
    });
  });
  var crawlFaq = (cfg.embed && cfg.embed.crawlable && cfg.embed.crawlable.faq) || [];
  crawlFaq.forEach(function (f, i) {
    if (!ids[f.item]) errors.push('embed.crawlable.faq[' + i + '] references unknown item id "' + f.item + '".');
  });
  var feelQ = (cfg.questions || [])[0];
  var feelIds = {};
  if (feelQ) (feelQ.options || []).forEach(function (o) { feelIds[o.id] = true; });
  var chips = (cfg.embed && cfg.embed.chips && cfg.embed.chips.items) || [];
  chips.forEach(function (c, i) {
    if (!feelIds[c.feel]) errors.push('embed.chips.items[' + i + '] references unknown feel id "' + c.feel + '".');
  });

  return errors;
}

module.exports = { runRules: runRules, collectStrings: collectStrings };
