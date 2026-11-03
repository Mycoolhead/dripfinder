'use strict';
/*
 * Accessibility (PROMPT Phase 1 step 6):
 *   - axe-core finds no serious/critical issues on every screen (includes WCAG AA contrast)
 *   - the whole quiz completes with the keyboard only
 *   - focus moves to the new question heading on each step
 *   - tap targets (options and buttons) are at least 44px
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const h = require('./helpers');

const SLUG = 'dripit';

async function axeSerious(page) {
  const res = await new AxeBuilder({ page }).analyze();
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => v.id + ' (' + v.nodes.length + ')');
}

// Drive to a named screen using baseline answers, stopping partway where needed.
async function goto(page, cfg, screen) {
  const s = h.scope(page);
  const first = cfg.questions[0];
  const feelLabel = h.optionLabel(cfg, first.id, first.options[0].id);
  if (screen === 'q1') return;
  // q1 -> advance
  await s.locator('button.opt', { hasText: feelLabel }).first().click();
  await s.locator('button.btn', { hasText: 'Next' }).first().click();
  if (screen === 'q2') return;
  await s.locator('button.opt').first().click(); // week (single, auto-advances)
  if (screen === 'q3') return;
  await s.locator('button.opt').first().click(); // client (single, auto-advances)
  if (screen === 'q4') return;
  // q4 safety -> choose per screen
  if (screen === 'result') {
    await s.locator('button.opt', { hasText: 'None of these' }).first().click();
    await s.locator('button.btn', { hasText: 'See my match' }).first().click();
  } else if (screen === 'talk') {
    await s.locator('button.opt', { hasText: 'Pregnant or breastfeeding' }).first().click();
    await s.locator('button.btn', { hasText: 'See my match' }).first().click();
  } else if (screen === 'emergency') {
    await s.locator('button.opt', { hasText: 'Chest pain' }).first().click();
    await s.locator('button.btn', { hasText: 'See my match' }).first().click();
  }
}

for (const screen of ['q1', 'q2', 'q3', 'q4', 'result', 'talk', 'emergency']) {
  test('axe: no serious/critical issues on ' + screen, async ({ page }) => {
    const cfg = await h.mount(page, SLUG);
    await goto(page, cfg, screen);
    const violations = await axeSerious(page);
    expect(violations, 'axe serious/critical: ' + violations.join(', ')).toEqual([]);
  });
}

test('focus moves to the question heading on each step', async ({ page }) => {
  const cfg = await h.mount(page, SLUG);
  const s = h.scope(page);
  // advance q1 -> q2
  await s.locator('button.opt').first().click();
  await s.locator('button.btn', { hasText: 'Next' }).first().click();
  expect((await h.activeInfo(page)).tag).toBe('H2');
  // q2 -> q3 (single auto-advance)
  await s.locator('button.opt').first().click();
  expect((await h.activeInfo(page)).tag).toBe('H2');
  // q3 -> q4
  await s.locator('button.opt').first().click();
  expect((await h.activeInfo(page)).tag).toBe('H2');
  // q4 -> result
  await s.locator('button.opt', { hasText: 'None of these' }).first().click();
  await s.locator('button.btn', { hasText: 'See my match' }).first().click();
  expect((await h.activeInfo(page)).tag).toBe('H2');
});

test('the whole quiz completes with the keyboard only', async ({ page }) => {
  const cfg = await h.mount(page, SLUG);
  const s = h.scope(page);

  async function tabUntil(pred, max) {
    for (let i = 0; i < (max || 25); i++) {
      const info = await h.activeInfo(page);
      if (info && pred(info)) return info;
      await page.keyboard.press('Tab');
    }
    const info = await h.activeInfo(page);
    if (info && pred(info)) return info;
    throw new Error('tabUntil: target not reached; last focus = ' + JSON.stringify(info));
  }
  const isOpt = (i) => /\bopt\b/.test(i.cls);
  const isBtn = (i, t) => /\bbtn\b/.test(i.cls) && i.text.indexOf(t) > -1;

  // Q1 (multi): focus an option, select with Space, then reach Next and press Enter.
  await tabUntil(isOpt);
  await page.keyboard.press('Space');
  await tabUntil((i) => isBtn(i, 'Next'));
  await page.keyboard.press('Enter');
  // Q2 (single): focus an option, Enter auto-advances.
  await tabUntil(isOpt);
  await page.keyboard.press('Enter');
  // Q3 (single)
  await tabUntil(isOpt);
  await page.keyboard.press('Enter');
  // Q4 (multi, safety): select an option then See my match.
  await tabUntil(isOpt);
  await page.keyboard.press('Space');
  await tabUntil((i) => isBtn(i, 'See my match'));
  await page.keyboard.press('Enter');

  // Reached a result or a stop screen - either is a valid keyboard-reachable end state.
  const heading = await s.locator('h2').textContent();
  expect(heading && heading.length).toBeTruthy();
  const hasResultOrStop = (await s.locator('h3').count()) + (await s.locator('.stop').count());
  expect(hasResultOrStop).toBeGreaterThan(0);
});

test('tap targets (options and buttons) are at least 44px tall', async ({ page }) => {
  const cfg = await h.mount(page, SLUG);
  const s = h.scope(page);
  await goto(page, cfg, 'result');
  const small = await page.evaluate(() => {
    const host = document.querySelector('#df-0');
    const nodes = host.shadowRoot.querySelectorAll('.opt, .btn');
    const bad = [];
    nodes.forEach((n) => { if (n.getBoundingClientRect().height < 44) bad.push((n.textContent || '').trim().slice(0, 30) + ' = ' + Math.round(n.getBoundingClientRect().height)); });
    return bad;
  });
  expect(small, 'targets under 44px: ' + small.join(', ')).toEqual([]);
});
