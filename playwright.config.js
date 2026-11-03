'use strict';
const { defineConfig } = require('@playwright/test');

// `npm test` runs `pretest` (build) first, so dist/ and embeds/ are fresh.
// Two viewports, matching the real phone and desktop sizes DripFinder ships to.
module.exports = defineConfig({
  testDir: './tests',
  testIgnore: ['legacy/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    headless: true,
    // Prefer Playwright's bundled Chromium; fall back to system Chrome if present.
    channel: process.env.DF_CHROME_CHANNEL || undefined
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { viewport: { width: 1366, height: 900 } } }
  ]
});
