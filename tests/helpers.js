'use strict';
/*
 * Shared test harness. Mounts the BUILT engine (dist/dripfinder.min.js) with a config
 * into a page, and drives the quiz the way a visitor would. Testing dist/ means the
 * tests protect the artifact that actually ships.
 */
const fs = require('fs');
const path = require('path');
const score = require('../scripts/lib/score');

const ROOT = path.join(__dirname, '..');
const ENGINE_PATH = path.join(ROOT, 'dist', 'dripfinder.min.js');

function engine() {
  if (!fs.existsSync(ENGINE_PATH)) {
    throw new Error('dist/dripfinder.min.js missing - run `npm run build` first (npm test does this automatically).');
  }
  return fs.readFileSync(ENGINE_PATH, 'utf8');
}

function loadConfig(slug) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'configs', slug + '.json'), 'utf8'));
}

function runtimeConfig(cfg) {
  const c = JSON.parse(JSON.stringify(cfg));
  delete c.embed;
  delete c.approved;
  return c;
}

function containers(cfg, count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += '<div id="df-' + i + '" data-dripfinder style="padding:8px 0">' +
      '<script type="application/json">' + JSON.stringify(runtimeConfig(cfg)) + '</script></div>\n';
  }
  return html;
}

function pageHtml(bodyInner) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>DripFinder test harness</title></head>' +
    '<body style="font-family:Inter,system-ui,sans-serif;margin:0;padding:16px">' + bodyInner + '</body></html>';
}

// Collect console errors + page errors for a test. Call assertNoErrors(errors) at the end.
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

// Mount `count` widgets for `slug`. If `search` is given (e.g. '?feel=hungover&src=x'),
// the page is served from a routed URL so location.search is set (for ?feel= preselect).
async function mount(page, slug, opts) {
  opts = opts || {};
  const cfg = loadConfig(slug);
  const count = opts.count || 1;
  const body = containers(cfg, count);
  if (opts.search) {
    const url = 'https://harness.test/find' + opts.search;
    await page.route('https://harness.test/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: pageHtml(body) }));
    await page.goto(url);
  } else {
    await page.setContent(pageHtml(body));
  }
  await page.addScriptTag({ content: engine() });
  await page.waitForSelector('[data-dripfinder-ready]');
  return cfg;
}

function scope(page, index) {
  return page.locator('#df-' + (index || 0));
}

function questionById(cfg, id) {
  return cfg.questions.filter((q) => q.id === id)[0];
}
function optionLabel(cfg, qid, oid) {
  const q = questionById(cfg, qid);
  return score.findOption(q, oid).label;
}

// Drive the quiz through `answers` ({questionId: [optionId,...]}), in question order.
// Single-select questions auto-advance; multi-select need the Next / See my match button.
async function runPath(page, cfg, answers, index) {
  const s = scope(page, index);
  for (let i = 0; i < cfg.questions.length; i++) {
    const q = cfg.questions[i];
    const picks = answers[q.id] || [];
    for (const oid of picks) {
      const label = optionLabel(cfg, q.id, oid);
      await s.locator('button.opt', { hasText: label }).first().click();
    }
    if (q.multi) {
      const last = i === cfg.questions.length - 1;
      const btnText = last ? (cfg.ui && cfg.ui.seeMatch) || 'See my match' : (cfg.ui && cfg.ui.next) || 'Next';
      await s.locator('button.btn', { hasText: btnText }).first().click();
    }
  }
}

// Shadow-aware active element info (tag, class, text).
async function activeInfo(page) {
  return page.evaluate(() => {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el ? { tag: el.tagName, cls: el.className, text: (el.textContent || '').trim().slice(0, 40) } : null;
  });
}

// The safety question is the one whose options carry a `stop`.
function safetyQuestion(cfg) {
  return cfg.questions.filter((q) => (q.options || []).some((o) => o.stop))[0] || null;
}
// A non-stop option for the safety question (prefer the exclusive "none").
function safeOption(q) {
  const excl = (q.options || []).filter((o) => o.exclusive && !o.stop)[0];
  if (excl) return excl.id;
  const none = (q.options || []).filter((o) => !o.stop)[0];
  return none ? none.id : null;
}

// Per question, the candidate answer-sets to try when searching for a reachable path.
function candidateSets(cfg, q) {
  if ((q.options || []).some((o) => o.stop)) {
    const s = safeOption(q);
    return s ? [[s]] : [[]];
  }
  // single and multi alike: try each option on its own (one pick is enough to advance).
  return (q.options || []).map((o) => [o.id]);
}

// For every matchable item, find one answer path that makes it the top match.
// Returns { itemId: answers }. Missing keys mean "unreachable" (a test asserts none are).
function reachabilityPaths(cfg) {
  const matchable = (cfg.items || []).filter((it) => !it.hideFromMatch);
  const found = {};
  const lists = cfg.questions.map((q) => ({ id: q.id, sets: candidateSets(cfg, q) }));
  const CAP = 20000;
  let n = 0;
  const idx = lists.map(() => 0);
  while (n < CAP) {
    n++;
    const answers = {};
    lists.forEach((l, i) => { answers[l.id] = l.sets[idx[i]]; });
    const top = score.topItem(cfg, answers);
    if (top && !found[top.id]) found[top.id] = JSON.parse(JSON.stringify(answers));
    if (Object.keys(found).length === matchable.length) break;
    // increment odometer
    let k = lists.length - 1;
    while (k >= 0) {
      idx[k]++;
      if (idx[k] < lists[k].sets.length) break;
      idx[k] = 0; k--;
    }
    if (k < 0) break;
  }
  return { paths: found, matchable: matchable.map((it) => it.id) };
}

// A baseline answer set that reaches a result (safety = none), for building stop variants.
function baselineAnswers(cfg) {
  const answers = {};
  cfg.questions.forEach((q) => {
    const sets = candidateSets(cfg, q);
    answers[q.id] = sets[0];
  });
  return answers;
}

module.exports = {
  engine, loadConfig, runtimeConfig, mount, scope, runPath,
  activeInfo, trackErrors, optionLabel, questionById, score,
  reachabilityPaths, baselineAnswers, safetyQuestion, safeOption
};
