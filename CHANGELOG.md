# Changelog

All notable changes to DripFinder. Newest first.

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
