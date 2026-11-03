# Changelog

All notable changes to DripFinder. Newest first.

## 0.4.0 - 2026-11-03

Phase 2: a hosted engine and real, anonymous usage numbers. A client site now needs only a
two-line snippet, and a price or bug fix ships from this repo without touching the client's site.
The matching logic is unchanged - every answer path still recommends the same item (asserted in tests).

### Added
- Hosted engine model: the engine fetches `/configs/<slug>.json` from its own origin when a
  container has `data-client="<slug>"` and no inline config. Inline JSON still wins, so existing
  paste-in blocks keep working. If the fetch fails, the engine renders a single Book button to
  `data-fallback` - never a blank box.
- Anonymous, first-party usage events via `navigator.sendBeacon`: `view`, `start`, `result`,
  `stop_emergency`, `stop_talk`, `book_click`, `text_click` with client slug, matched item id,
  `src`, page path and date. Never the feel/week/safety answers, never anything identifying.
  Sending can't block or slow the quiz. The existing dataLayer/gtag events are unchanged.
- Cloudflare Worker (`worker/index.js`): serves the engine + configs as static assets, ingests
  events to D1 (`/e`), and renders a phone-readable stats page (`/stats/<slug>?key=...`) with
  views, starts, completion rate, book/text taps and stop counts by week and month, top matched
  items, top sources, and a one-sentence "copy for report". `worker/schema.sql` is the D1 table.
- Versioned hosting: `npm run assemble` builds `site/` with `/v0/` (latest 0.x), frozen
  `/v<version>/` copies (pinnable), and `/configs/<slug>.json` for **approved configs only** -
  unapproved configs are skipped and listed, so an unsigned-off answer map never goes live.
- `releases/<version>/` holds the frozen build for each version (committed, drift-checked).
- Handoff docs: `handoff/cloudflare-setup.md` (account setup) and
  `handoff/muhammad-dripit-hosted-swap.md` (swap the site to the hosted quiz, with rollback).
- Tests: `tests/hosted.spec.js` covers config fetch, inline-wins, the fallback button, and the
  beacon privacy guarantee (only whitelisted events, no answers leaked).

### Changed
- Engine VERSION 0.4.0; the build now stamps the banner comment with the real version.
- `npm run deploy` / `npm run release` chain validate -> build -> assemble (-> wrangler deploy).

### Notes
- First render on an emulated 4G phone (cold cache, 4x CPU) is ~0.7s median, including the engine
  download and the config fetch.
- dripit is still **not approved**, so its config is skipped on deploy and the hosted embed would
  show the fallback Book button until Deanna + her medical director sign off.

## 0.3.0 - 2026-10-28

Phase 1: a real repo with a safety net. The engine, config and paste-in blocks are the same
quiz Deanna has today (every answer path still recommends the same IV), now with a build,
validation, tests and link checks around them.

### Added
- `npm run build`: minifies `src/dripfinder.js` to `dist/dripfinder.min.js` (ASCII only) and
  regenerates every `embeds/<slug>/` artifact from its config.
- `embeds/<slug>/<slug>-crawlable.html`: a plain-HTML, no-JavaScript "Which IV is right for me?"
  section with a feeling-to-IV table, 6 Q&As and FAQPage JSON-LD. Readable by Google and AI
  search (the quiz renders in Shadow DOM, which they do not read) and the fallback when JS fails.
- `npm run validate`: JSON Schema (`schema/config.schema.json`) plus rule checks (safety screen,
  booking-link protocols, tag balance, disclaimer, em dashes, standalone "drip", `approved` block).
- `npm test`: Playwright suite at 390x844 and 1366x900 - the 9 legacy answer paths, auto-generated
  coverage (every item reachable, every stop safe, every Book link correct, disclaimer shown, two
  embeds on one page, zero console errors) and accessibility (axe, keyboard-only, focus, tap targets).
- `npm run check-links`: opens every booking URL and confirms the service name is on the page
  (reads the GlossGenius modal for `/services` links). Weekly GitHub Actions schedule.
- GitHub Actions: `ci.yml` (validate, build, test on push/PR) and `check-links.yml` (weekly).

### Changed
- The engine is now industry-neutral: no IV-specific words in `src/`. Every visitor-facing string
  comes from the config, with neutral defaults ("Here's the best fit for you", "See my match").
- Configs gain `"vertical": "iv"` (switches on the IV safety rules) and `"approved": {by, date}`.
- Config key `drips` renamed to `items`; analytics event detail `drip` renamed to `item`.
  (`window.DripFinder`, the `data-dripfinder` attribute and the `dripfinder_*` event names are the
  product name and are unchanged, so existing dataLayer/gtag wiring keeps working apart from that key.)
- Copy pass on `dripit.json` (see the Phase 1 report for every before/after).
- Accessibility: the "Back" control is now a 44px tap target, and toggling a multi-select option
  keeps keyboard focus on that option.
- Build VERSION set to 0.3.0 (the shipped v0.2.1 minified file still read 0.2.0).

### Fixed
- `dist/dripfinder.min.js` version string now matches the source.
