'use strict';
/*
 * Renders the paste-in artifacts for one client from its config:
 *   - embed block   (the quiz: container + inline JSON config + inline engine)
 *   - symptom chips (homepage deep-link chips)
 *   - strip         (thin "tell us how you feel" banner)
 *   - crawlable     (plain-HTML SEO + no-JS fallback, with FAQPage JSON-LD)
 *   - all-snippets  (all of the above in one labeled file)
 * All copy and colors come from the config. No vertical-specific words are hard-coded here;
 * anything industry-flavored (for example the word "IV") comes from the config's embed block.
 */
var score = require('./score');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return esc(s).replace(/"/g, '&quot;');
}
// Darken a #rrggbb hex by a fraction (0..1). Used for hover tints from brand tokens.
function darken(hex, amt) {
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  var n = parseInt(m[1], 16);
  var r = Math.round(((n >> 16) & 255) * (1 - amt));
  var g = Math.round(((n >> 8) & 255) * (1 - amt));
  var b = Math.round((n & 255) * (1 - amt));
  return '#' + [r, g, b].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
}

// The runtime config: drop build-only keys the engine never reads.
function runtimeConfig(cfg) {
  var c = JSON.parse(JSON.stringify(cfg));
  delete c.embed;
  delete c.approved;
  return c;
}

function embedBlock(slug, cfg, engineMin) {
  var e = cfg.embed || {};
  var id = e.containerId || 'drip-finder';
  var json = JSON.stringify(runtimeConfig(cfg));
  return (
    '<!-- DripFinder v' + cfg.version + ' for ' + esc(cfg.clinic.name) + ' (Michael Head Marketing). Paste this whole block into ONE Custom Code element. -->\n' +
    '<div id="' + escAttr(id) + '" data-dripfinder style="padding:8px 0">\n' +
    '<script type="application/json">' + json + '</script>\n' +
    '</div>\n' +
    '<script>' + engineMin + '</script>\n'
  );
}

function chipsBlock(cfg) {
  var e = cfg.embed || {};
  var chips = (e.chips && e.chips.items) || [];
  var page = e.page || '#';
  var b = cfg.brand;
  var font = b.headingFont && b.headingFont !== 'inherit' ? b.headingFont : (b.font && b.font !== 'inherit' ? b.font : "system-ui, -apple-system, 'Segoe UI', sans-serif");
  var links = chips.map(function (c) {
    return '    <a class="dfx-chip" href="' + escAttr(page + '?feel=' + encodeURIComponent(c.feel) + '&src=home-chip') + '">' + esc(c.text) + '</a>';
  }).join('\n');
  return (
    '<!-- DripFinder symptom chips for ' + esc(cfg.clinic.name) + '. Paste into ONE Custom Code element directly under the hero buttons on the homepage. -->\n' +
    '<div class="dfx-chips" aria-label="Help Me Choose by symptom">\n' +
    '  <p class="dfx-chips__label">' + esc(e.chips && e.chips.label) + '</p>\n' +
    '  <div class="dfx-chips__row">\n' + links + '\n  </div>\n' +
    '</div>\n' +
    '<style>\n' +
    '.dfx-chips{margin:14px 0 4px;font-family:' + font + ';max-width:600px}\n' +
    '.dfx-chips__label{margin:0 0 8px;font-size:14px;font-weight:700;color:' + b.fg + ';letter-spacing:.01em}\n' +
    '.dfx-chips__row{display:flex;flex-wrap:wrap;gap:8px}\n' +
    '.dfx-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:10px 14px;border:1.5px solid ' + b.accent + ';background:' + b.bg + ';color:' + b.button + ';font-size:15px;font-weight:600;line-height:1;text-decoration:none;border-radius:999px;white-space:nowrap;transition:background .15s,color .15s}\n' +
    '.dfx-chip:hover,.dfx-chip:focus-visible{background:' + b.accent + ';color:' + b.accentInk + ';outline:none}\n' +
    '@media (max-width:640px){\n' +
    '  .dfx-chips__row{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;margin-right:-16px;padding-right:16px;scrollbar-width:none}\n' +
    '  .dfx-chips__row::-webkit-scrollbar{display:none}\n' +
    '}\n' +
    '@media (prefers-reduced-motion:reduce){.dfx-chip{transition:none}}\n' +
    '</style>\n'
  );
}

function stripBlock(cfg) {
  var e = cfg.embed || {};
  var s = e.strip || {};
  var page = e.page || '#';
  var b = cfg.brand;
  var font = b.headingFont && b.headingFont !== 'inherit' ? b.headingFont : (b.font && b.font !== 'inherit' ? b.font : "system-ui, -apple-system, 'Segoe UI', sans-serif");
  return (
    '<!-- DripFinder strip for ' + esc(cfg.clinic.name) + '. Paste into ONE Custom Code element: homepage (above the cards), top of the Services page, and above the list on every city page. -->\n' +
    '<a class="dfx-strip" href="' + escAttr(page + '?src=strip') + '">\n' +
    '  <span class="dfx-strip__icon" aria-hidden="true">\n' +
    '    <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2.5c-3.6 4.6-6.5 8.4-6.5 11.6A6.5 6.5 0 0 0 12 20.6a6.5 6.5 0 0 0 6.5-6.5C18.5 10.9 15.6 7.1 12 2.5z" fill="' + b.accentInk + '"/></svg>\n' +
    '  </span>\n' +
    '  <span class="dfx-strip__text"><b>' + esc(s.lead) + '</b> ' + esc(s.text) + '</span>\n' +
    '  <span class="dfx-strip__cta">' + esc(s.cta) + ' <span aria-hidden="true">&rarr;</span></span>\n' +
    '</a>\n' +
    '<style>\n' +
    '.dfx-strip{display:flex;align-items:center;gap:14px;max-width:980px;margin:12px auto 22px;padding:12px 14px 12px 12px;background:' + b.soft + ';border:1.5px solid ' + b.accent + ';color:' + b.fg + ';text-decoration:none;font-family:' + font + ';font-size:16px;line-height:1.35;transition:background .15s}\n' +
    '.dfx-strip:hover,.dfx-strip:focus-visible{background:' + darken(b.soft, 0.06) + ';outline:none}\n' +
    '.dfx-strip__icon{flex:none;width:40px;height:40px;display:grid;place-items:center;background:' + b.accent + '}\n' +
    '.dfx-strip__text{flex:1;min-width:0}\n' +
    '.dfx-strip__text b{font-weight:700}\n' +
    '.dfx-strip__cta{flex:none;background:' + b.button + ';color:' + b.accentInk + ';font-weight:700;padding:11px 16px;white-space:nowrap}\n' +
    '@media (max-width:640px){\n' +
    '  .dfx-strip{flex-wrap:wrap;gap:10px;margin:10px 0 18px}\n' +
    '  .dfx-strip__text{flex:1 1 calc(100% - 60px);font-size:15px}\n' +
    '  .dfx-strip__cta{flex:1 1 100%;text-align:center}\n' +
    '}\n' +
    '</style>\n'
  );
}

function itemById(cfg, id) {
  return (cfg.items || []).filter(function (x) { return x.id === id; })[0] || null;
}

function crawlable(cfg) {
  var e = cfg.embed || {};
  var c = e.crawlable || {};
  var b = cfg.brand;
  var noun = c.noun || 'option';
  var heading = c.heading || ('Which ' + noun + ' is right for me?');
  var intro = c.intro || '';
  var font = b.headingFont && b.headingFont !== 'inherit' ? b.headingFont : (b.font && b.font !== 'inherit' ? b.font : "system-ui, -apple-system, 'Segoe UI', sans-serif");
  var feelQ = (cfg.questions || [])[0];

  // Feeling -> matched item table, computed from the same scoring the quiz uses.
  var rows = ((feelQ && feelQ.options) || []).map(function (o) {
    var answers = {};
    answers[feelQ.id] = [o.id];
    var item = score.topItem(cfg, answers);
    if (!item) return '';
    var href = score.bookHref(cfg, item);
    return (
      '    <li class="dfc-row">\n' +
      '      <p class="dfc-feel">' + esc(o.label) + '</p>\n' +
      '      <p class="dfc-match"><a href="' + escAttr(href) + '" target="_top" rel="noopener">' + esc(item.name) + '</a>' + (item.price ? ' <span class="dfc-price">' + esc(item.price) + '</span>' : '') + '</p>\n' +
      (item.short ? '      <p class="dfc-line">' + esc(item.short) + '</p>\n' : '') +
      '    </li>'
    );
  }).filter(Boolean).join('\n');

  // FAQ (curated in config, or derived) + matching FAQPage JSON-LD.
  var faqSrc = (c.faq && c.faq.length) ? c.faq : deriveFaq(cfg, noun);
  var faqHtml = [];
  var faqLd = [];
  faqSrc.forEach(function (f) {
    var item = itemById(cfg, f.item);
    if (!item) return;
    var href = score.bookHref(cfg, item);
    var plain = item.name + (item.price ? ' (' + item.price + ')' : '') + '. ' + (item.blurb || item.short || '');
    faqHtml.push(
      '    <div class="dfc-qa">\n' +
      '      <h4>' + esc(f.q) + '</h4>\n' +
      '      <p>' + esc(plain) + ' <a href="' + escAttr(href) + '" target="_top" rel="noopener">Book ' + esc(item.name) + '</a></p>\n' +
      '    </div>'
    );
    faqLd.push({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: plain }
    });
  });
  var ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqLd
  };

  return (
    '<!-- DripFinder crawlable fallback for ' + esc(cfg.clinic.name) + ' (Michael Head Marketing).\n' +
    '     Plain HTML, no JavaScript. Paste in ONE Custom Code element directly UNDER the quiz on ' + esc(e.page || '') + '.\n' +
    '     It gives Google and AI search readable content (the quiz renders in Shadow DOM, which they do not read)\n' +
    '     and is the fallback shown when JavaScript fails. -->\n' +
    '<section class="dfc" aria-label="' + escAttr(heading) + '">\n' +
    '  <h2 class="dfc-h">' + esc(heading) + '</h2>\n' +
    (intro ? '  <p class="dfc-intro">' + esc(intro) + '</p>\n' : '') +
    '  <ul class="dfc-list">\n' + rows + '\n  </ul>\n' +
    '  <h3 class="dfc-h3">Common questions</h3>\n' +
    '  <div class="dfc-faqs">\n' + faqHtml.join('\n') + '\n  </div>\n' +
    (cfg.disclaimer ? '  <p class="dfc-note">' + esc(cfg.disclaimer) + '</p>\n' : '') +
    '</section>\n' +
    '<style>\n' +
    '.dfc{font-family:' + font + ';color:' + b.fg + ';max-width:720px;margin:0 auto;line-height:1.5}\n' +
    '.dfc .dfc-h{font-size:1.4rem;margin:0 0 6px}\n' +
    '.dfc .dfc-intro{color:' + b.muted + ';margin:0 0 16px}\n' +
    '.dfc-list{list-style:none;margin:0 0 18px;padding:0;display:grid;gap:10px}\n' +
    '.dfc-row{border:1px solid ' + b.line + ';border-radius:' + b.radius + ';padding:12px 14px}\n' +
    '.dfc-feel{margin:0;font-weight:700}\n' +
    '.dfc-match{margin:2px 0 0}\n' +
    '.dfc-match a{color:' + b.button + ';font-weight:700;text-decoration:none}\n' +
    '.dfc-match a:hover{text-decoration:underline}\n' +
    '.dfc-price{color:' + b.fg + ';font-weight:700}\n' +
    '.dfc-line{margin:2px 0 0;color:' + b.muted + ';font-size:.95rem}\n' +
    '.dfc-h3{font-size:1.15rem;margin:18px 0 8px}\n' +
    '.dfc-qa{margin:0 0 12px}\n' +
    '.dfc-qa h4{margin:0 0 2px;font-size:1rem}\n' +
    '.dfc-qa p{margin:0;color:' + b.fg + '}\n' +
    '.dfc-qa a{color:' + b.button + ';font-weight:600}\n' +
    '.dfc-note{margin:18px 0 0;color:' + b.muted + ';font-size:.8rem}\n' +
    '</style>\n' +
    '<script type="application/ld+json">' + JSON.stringify(ld) + '</script>\n'
  );
}

// Fallback FAQ when a config does not curate one: one question per distinct matched item.
function deriveFaq(cfg, noun) {
  var feelQ = (cfg.questions || [])[0];
  var seen = {};
  var out = [];
  ((feelQ && feelQ.options) || []).forEach(function (o) {
    if (out.length >= 7) return;
    var answers = {};
    answers[feelQ.id] = [o.id];
    var item = score.topItem(cfg, answers);
    if (!item || seen[item.id]) return;
    seen[item.id] = true;
    out.push({ q: "What's the best " + noun + ' for ' + (o.short || o.label) + '?', item: item.id });
  });
  return out;
}

function allSnippets(slug, cfg, engineMin) {
  var bar = '<!-- ================================================================= -->\n';
  return (
    '<!-- DripFinder paste-in snippets for ' + esc(cfg.clinic.name) + ' (Michael Head Marketing). v' + cfg.version + '.\n' +
    '     Four blocks below, each in its own labeled section. Each goes in its OWN Custom Code element. -->\n\n' +
    bar + '<!-- 1) THE QUIZ. Put this on ' + esc((cfg.embed || {}).page || 'the quiz page') + '. -->\n' + bar +
    embedBlock(slug, cfg, engineMin) + '\n' +
    bar + '<!-- 2) HOMEPAGE SYMPTOM CHIPS. Put this under the hero buttons on the homepage. -->\n' + bar +
    chipsBlock(cfg) + '\n' +
    bar + '<!-- 3) THE STRIP. Put this above the cards on the homepage, Services and city pages. -->\n' + bar +
    stripBlock(cfg) + '\n' +
    bar + '<!-- 4) CRAWLABLE FALLBACK. Put this directly UNDER the quiz on ' + esc((cfg.embed || {}).page || 'the quiz page') + '. -->\n' + bar +
    crawlable(cfg)
  );
}

module.exports = {
  embedBlock: embedBlock,
  chipsBlock: chipsBlock,
  stripBlock: stripBlock,
  crawlable: crawlable,
  allSnippets: allSnippets,
  runtimeConfig: runtimeConfig
};
