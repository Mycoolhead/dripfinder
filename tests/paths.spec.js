'use strict';
/*
 * Ported from tests/legacy/t.js (9 answer paths) and tests/legacy/pre.js (?feel= preselect).
 * Expected matches are frozen to what v0.2 shipped on Oct 28, 2026 - changing a match is a
 * deliberate decision (PROMPT ground rule) and must break this test.
 */
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const SLUG = 'dripit';

// Each case: answers by question id -> expected result item name, or expected stop title.
const MATCH_CASES = [
  { name: 'hungover + big night + new', answers: { feel: ['hungover'], week: ['night'], client: ['new'], safety: ['none'] }, expect: 'Hangover/Flu Relief' },
  { name: 'sore + training', answers: { feel: ['sore'], week: ['train'], client: ['returning'], safety: ['none'] }, expect: 'Peak Performance' },
  { name: 'tired + grind', answers: { feel: ['tired'], week: ['grind'], client: ['returning'], safety: ['none'] }, expect: 'Myers Cocktail' },
  { name: 'glow + event', answers: { feel: ['glow'], week: ['event'], client: ['returning'], safety: ['none'] }, expect: 'High Dose Glutathione' },
  { name: 'sick + bug', answers: { feel: ['sick'], week: ['bug'], client: ['new'], safety: ['none'] }, expect: 'Immunity Boost' },
  { name: 'dry + outside', answers: { feel: ['dry'], week: ['outside'], client: ['returning'], safety: ['none'] }, expect: 'Hydration Hero' },
  { name: 'nausea + headache + big night', answers: { feel: ['nausea', 'headache'], week: ['night'], client: ['returning'], safety: ['none'] }, expect: 'Hangover/Flu Relief' }
];

const STOP_CASES = [
  { name: 'pregnant -> talk', answers: { feel: ['tired'], week: ['routine'], client: ['returning'], safety: ['pregnant'] }, title: "Let's talk before you book" },
  { name: 'chest pain -> emergency', answers: { feel: ['tired'], week: ['routine'], client: ['returning'], safety: ['emergency'] }, title: 'Please get care right away' }
];

for (const c of MATCH_CASES) {
  test('match: ' + c.name + ' -> ' + c.expect, async ({ page }) => {
    const errors = h.trackErrors(page);
    await h.mount(page, SLUG);
    await h.runPath(page, h.loadConfig(SLUG), c.answers);
    const s = h.scope(page);
    await expect(s.locator('h3')).toHaveText(c.expect);
    expect(errors, 'no console errors').toEqual([]);
  });
}

for (const c of STOP_CASES) {
  test('stop: ' + c.name, async ({ page }) => {
    const errors = h.trackErrors(page);
    const cfg = await h.mount(page, SLUG);
    await h.runPath(page, cfg, c.answers);
    const s = h.scope(page);
    await expect(s.locator('h2')).toHaveText(c.title);
    await expect(s.locator('h3')).toHaveCount(0); // no item shown on a stop
    await expect(s.locator('a.btn', { hasText: 'Book ' })).toHaveCount(0); // no booking link
    expect(errors, 'no console errors').toEqual([]);
  });
}

test('preselect: ?feel=hungover checks the hungover option on question 1', async ({ page }) => {
  const errors = h.trackErrors(page);
  const cfg = await h.mount(page, SLUG, { search: '?feel=hungover&src=home-chip' });
  const label = h.optionLabel(cfg, 'feel', 'hungover');
  const s = h.scope(page);
  // still on question 1, with the hungover option pressed
  await expect(s.locator('h2')).toHaveText(cfg.questions[0].title);
  await expect(s.locator('button.opt[aria-pressed="true"]')).toHaveText(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  expect(errors, 'no console errors').toEqual([]);
});
