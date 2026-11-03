'use strict';
/*
 * Auto-generated coverage (PROMPT Phase 1 step 6), derived from the config so it grows
 * with every client:
 *   - every matchable item is reachable by some answer path (and the engine agrees with
 *     the Node scorer used by the build -> parity)
 *   - every Book link equals the item's bookUrl plus UTM params
 *   - the disclaimer shows on the result screen
 *   - every stop answer shows no item and no Book link
 *   - the custom option is offered on a normal result
 *   - two embeds on one page both mount
 *   - zero console errors
 */
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const SLUG = 'dripit';
const cfg = h.loadConfig(SLUG);
const { paths, matchable } = h.reachabilityPaths(cfg);

test('every matchable item is reachable by some answer path', () => {
  const missing = matchable.filter((id) => !paths[id]);
  expect(missing, 'unreachable items: ' + missing.join(', ')).toEqual([]);
});

for (const id of matchable) {
  const item = cfg.items.filter((x) => x.id === id)[0];
  test('reach + book link + disclaimer: ' + id, async ({ page }) => {
    const errors = h.trackErrors(page);
    await h.mount(page, SLUG);
    const answers = paths[id];
    expect(answers, 'path exists for ' + id).toBeTruthy();
    await h.runPath(page, cfg, answers);
    const s = h.scope(page);

    // Engine's top match equals the Node scorer's (reachability + parity).
    await expect(s.locator('h3')).toHaveText(item.name);

    // Book link == bookUrl + UTM.
    const expected = h.score.bookHref(cfg, item);
    const href = await s.locator('a.btn', { hasText: 'Book ' + item.name }).first().getAttribute('href');
    expect(href).toBe(expected);

    // Disclaimer present on the result screen.
    await expect(s.locator('.note', { hasText: cfg.disclaimer })).toHaveCount(1);

    expect(errors, 'no console errors').toEqual([]);
  });
}

test('the custom option is offered on a normal result', async ({ page }) => {
  if (!cfg.customOption) test.skip();
  const errors = h.trackErrors(page);
  await h.mount(page, SLUG);
  await h.runPath(page, cfg, paths[matchable[0]]);
  const s = h.scope(page);
  const custom = cfg.items.filter((x) => x.id === cfg.customOption)[0];
  await expect(s.locator('.alt')).toContainText(custom.name);
  expect(errors).toEqual([]);
});

// Every stop answer: no item, no Book link, disclaimer shown.
const safetyQ = h.safetyQuestion(cfg);
const stopOptions = (safetyQ.options || []).filter((o) => o.stop);
for (const o of stopOptions) {
  test('stop answer shows no item and no Book link: ' + o.id + ' (' + o.stop + ')', async ({ page }) => {
    const errors = h.trackErrors(page);
    await h.mount(page, SLUG);
    const answers = h.baselineAnswers(cfg);
    answers[safetyQ.id] = [o.id];
    await h.runPath(page, cfg, answers);
    const s = h.scope(page);
    await expect(s.locator('h3')).toHaveCount(0);
    await expect(s.locator('a.btn', { hasText: 'Book ' })).toHaveCount(0);
    await expect(s.locator('.note')).toHaveCount(1); // disclaimer still shown
    if (o.stop === 'emergency' && cfg.stops.emergency.cta) {
      await expect(s.locator('a.btn', { hasText: cfg.stops.emergency.cta.label })).toHaveCount(1);
    }
    expect(errors, 'no console errors').toEqual([]);
  });
}

test('two embeds on one page both mount', async ({ page }) => {
  const errors = h.trackErrors(page);
  await h.mount(page, SLUG, { count: 2 });
  const mounted = await page.evaluate(() => {
    return Array.prototype.map.call(document.querySelectorAll('[data-dripfinder]'), (n) =>
      !!(n.shadowRoot && n.shadowRoot.querySelector('.df')));
  });
  expect(mounted).toEqual([true, true]);
  expect(errors, 'no console errors').toEqual([]);
});
