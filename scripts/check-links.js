'use strict';
/*
 * npm run check-links
 * Opens every booking URL in a real browser and confirms the service's name is on the
 * page it lands on, so a silently renamed or deleted service shows up as a broken Book
 * button here instead of on a visitor's screen.
 *
 * GlossGenius quirk (see docs/HISTORY.md):
 *   /services?service_token=  opens a MODAL for that service over the full menu.
 *     The menu behind it lists every service, so we read the [role="dialog"] only.
 *   /book?service_token=      is a single-service booking page (no full menu),
 *     so a body-text search is safe.
 *
 * Runs on a weekly GitHub Actions schedule (.github/workflows/check-links.yml).
 */
var fs = require('fs');
var path = require('path');
var pw = require('@playwright/test');

var ROOT = path.join(__dirname, '..');
var CONFIG_DIR = path.join(ROOT, 'configs');

var GOTO_TIMEOUT = 45000;
var DIALOG_TIMEOUT = 20000;
var SETTLE_MS = 4000;

function listConfigs() {
  if (!fs.existsSync(CONFIG_DIR)) return [];
  return fs.readdirSync(CONFIG_DIR)
    .filter(function (f) { return /\.json$/.test(f) && f[0] !== '_'; })
    .map(function (f) { return { slug: f.replace(/\.json$/, ''), file: path.join(CONFIG_DIR, f) }; });
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();
}

function linksFor(cfg) {
  var out = [];
  (cfg.items || []).forEach(function (it) {
    if (it.bookUrl) out.push({ id: it.id, name: it.name, url: it.bookUrl });
  });
  if (cfg.afterHours && cfg.afterHours.url && cfg.afterHours.name) {
    out.push({ id: 'after-hours', name: cfg.afterHours.name, url: cfg.afterHours.url });
  }
  return out;
}

async function checkOne(browser, link) {
  var page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: GOTO_TIMEOUT });
    var isServices = /\/services\b/.test(link.url);
    var hay = '';
    var where = '';
    if (isServices) {
      // Wait for the service modal and read only it.
      try { await page.waitForSelector('[role="dialog"]', { timeout: DIALOG_TIMEOUT }); } catch (e) {}
      var dialog = await page.$('[role="dialog"]');
      if (!dialog) return { link: link, ok: false, reason: 'service modal did not open' };
      hay = await dialog.innerText();
      where = 'modal';
    } else {
      await page.waitForTimeout(SETTLE_MS);
      hay = await page.locator('body').innerText();
      where = 'page';
    }
    var ok = norm(hay).indexOf(norm(link.name)) > -1;
    return { link: link, ok: ok, where: where, reason: ok ? '' : 'name "' + link.name + '" not found in ' + where };
  } catch (e) {
    return { link: link, ok: false, reason: e.message.split('\n')[0] };
  } finally {
    await page.close();
  }
}

async function main() {
  var configs = listConfigs();
  var allLinks = [];
  configs.forEach(function (c) {
    var cfg = JSON.parse(fs.readFileSync(c.file, 'utf8'));
    linksFor(cfg).forEach(function (l) { l.slug = c.slug; allLinks.push(l); });
  });
  if (!allLinks.length) { console.log('No booking links to check.'); return; }

  var browser = await pw.chromium.launch();
  var results = [];
  for (var i = 0; i < allLinks.length; i++) {
    var r = await checkOne(browser, allLinks[i]);
    results.push(r);
    var tag = r.ok ? 'PASS' : 'FAIL';
    console.log(tag + '  ' + r.link.slug + '/' + r.link.id + '  ' + (r.ok ? '("' + r.link.name + '" in ' + r.where + ')' : r.reason));
  }
  await browser.close();

  var failed = results.filter(function (r) { return !r.ok; });
  console.log('\ncheck-links: ' + (results.length - failed.length) + '/' + results.length + ' ok.');
  if (failed.length) {
    console.error('Broken booking links:');
    failed.forEach(function (r) { console.error('  - ' + r.link.slug + '/' + r.link.id + ': ' + r.reason + '  (' + r.link.url + ')'); });
    process.exit(1);
  }
}

main().catch(function (e) { console.error('check-links error: ' + e.message); process.exit(1); });
