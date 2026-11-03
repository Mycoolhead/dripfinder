'use strict';
/*
 * Phase 2 hosted-engine behavior:
 *   - data-client fetches /configs/<slug>.json from the script's origin and renders;
 *   - an inline config still wins (Deanna's current paste-in block keeps working);
 *   - a failed config fetch renders the data-fallback Book button, never a blank box;
 *   - usage beacons only ever send the whitelisted events, and never a visitor's answers.
 * Served from a routed origin so the engine's same-origin /configs/ and /e resolve.
 */
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const ORIGIN = 'https://dfhost.test';

// Set up the host: serve the page HTML, the config (or 404), and capture beacons.
async function host(page, opts) {
  opts = opts || {};
  const cfg = H.loadConfig('dripit');
  const beacons = [];

  await page.route(ORIGIN + '/**', (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    if (p === '/configs/dripit.json') {
      if (opts.configStatus && opts.configStatus !== 200) return route.fulfill({ status: opts.configStatus, contentType: 'text/plain', body: 'nope' });
      return route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(H.runtimeConfig(cfg)) });
    }
    if (p.startsWith('/configs/')) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
    if (p === '/e') return route.fulfill({ status: 204, body: '' });
    if (p === '/v0/dripfinder.min.js') return route.fulfill({ contentType: 'application/javascript', body: H.engine() });
    return route.fulfill({ contentType: 'text/html', body: pageHtml(opts.body || '') });
  });

  page.on('request', (req) => {
    if (req.url() === ORIGIN + '/e' && req.method() === 'POST') {
      let b = null; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
      if (b) beacons.push(b);
    }
  });

  await page.goto(ORIGIN + '/find');
  // Load the engine from a real same-origin URL so its SELF_SRC origin == ORIGIN.
  await page.evaluate((src) => new Promise((res) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; document.head.appendChild(s);
  }), ORIGIN + '/v0/dripfinder.min.js');
  await page.waitForSelector('[data-dripfinder-ready]');
  return { cfg, beacons };
}

function pageHtml(bodyInner) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>hosted</title></head>' +
    '<body style="font-family:system-ui,sans-serif;margin:0;padding:16px">' + bodyInner + '</body></html>';
}

test('data-client fetches the config from the script origin and renders the quiz', async ({ page }) => {
  const errors = H.trackErrors(page);
  await host(page, { body: '<div id="w" data-dripfinder data-client="dripit" data-fallback="https://book.example/"></div>' });
  const heading = await page.evaluate(() => {
    const el = document.querySelector('#w');
    const h = el.shadowRoot && el.shadowRoot.querySelector('.df h2');
    return h ? h.textContent : null;
  });
  expect(heading && heading.length).toBeTruthy();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('inline config wins over data-client (no fetch, paste-in block keeps working)', async ({ page }) => {
  const cfg = H.loadConfig('dripit');
  const inline = H.runtimeConfig(cfg);
  inline.clinic = Object.assign({}, inline.clinic, { name: 'INLINEWIN' });
  let fetched = false;
  page.on('request', (r) => { if (r.url() === ORIGIN + '/configs/dripit.json') fetched = true; });
  const body = '<div id="w" data-dripfinder data-client="dripit" data-fallback="https://book.example/">' +
    '<script type="application/json">' + JSON.stringify(inline) + '</script></div>';
  await host(page, { body });
  const label = await page.evaluate(() => {
    const el = document.querySelector('#w');
    const df = el.shadowRoot && el.shadowRoot.querySelector('.df');
    return df ? df.getAttribute('aria-label') : null;
  });
  expect(label).toContain('INLINEWIN');
  expect(fetched).toBe(false);
});

test('a failed config fetch renders the fallback Book button, never a blank box', async ({ page }) => {
  await host(page, { configStatus: 500, body: '<div id="w" data-dripfinder data-client="dripit" data-fallback="https://book.example/go"></div>' });
  const fb = await page.evaluate(() => {
    const el = document.querySelector('#w');
    const a = el.shadowRoot && el.shadowRoot.querySelector('.dff a');
    return a ? { href: a.getAttribute('href'), text: a.textContent.trim() } : null;
  });
  expect(fb).not.toBeNull();
  expect(fb.href).toBe('https://book.example/go');
  expect(fb.text.length).toBeGreaterThan(0);
});

test('usage beacons send only whitelisted events and never a visitor answer', async ({ page }) => {
  const ALLOWED = ['view', 'start', 'result', 'stop_emergency', 'stop_talk', 'book_click', 'text_click'];
  const { cfg, beacons } = await host(page, { body: '<div id="df-0" data-dripfinder data-client="dripit" data-fallback="https://book.example/"></div>' });
  await page.waitForFunction(() => {
    const el = document.querySelector('#df-0');
    return el.shadowRoot && el.shadowRoot.querySelector('.df h2');
  });
  // Drive a known path to a result: hungover + big night + new client + safety:none.
  await H.runPath(page, cfg, { feel: ['hungover'], week: ['night'], client: ['new'], safety: ['none'] });
  // Click Book on the result.
  await page.evaluate(() => {
    const el = document.querySelector('#df-0');
    const a = el.shadowRoot.querySelector('.match a.btn.wide');
    if (a) a.click();
  });
  await page.waitForTimeout(300);

  expect(beacons.length).toBeGreaterThan(0);
  const events = beacons.map((b) => b.e);
  for (const e of events) expect(ALLOWED, 'unexpected beacon event: ' + e).toContain(e);
  expect(events).toContain('view');
  expect(events).toContain('start');
  expect(events).toContain('result');
  expect(events).toContain('book_click');
  // No beacon may carry a feel/week/safety answer id anywhere in its payload.
  const answerIds = ['hungover', 'night', 'new', 'none', 'pregnant', 'emergency'];
  for (const b of beacons) {
    const blob = JSON.stringify(b);
    for (const a of answerIds) expect(blob, 'beacon leaked answer "' + a + '": ' + blob).not.toContain('"' + a + '"');
  }
});
