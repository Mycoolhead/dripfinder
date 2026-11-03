# DripFinder

White-label "Help Me Choose" IV quiz for mobile IV clinic websites. Michael Head Marketing.

## Start in Claude Code

1. Unzip this folder somewhere you keep work, like Documents/dripfinder.
2. Open Claude Code in this folder. Desktop app: open the folder. Terminal: `cd` into it and run `claude`.
3. Open PROMPT.md, copy everything, paste it in as your first message.
4. Claude stops after each phase with a report. Reply "go" for the next phase.

CLAUDE.md loads automatically and holds the standing rules. docs/HISTORY.md has every decision so far.

## Folder map

- src/: engine source
- dist/: built script
- configs/: one JSON per clinic
- embeds/: paste-in blocks per clinic
- tests/: Playwright tests (legacy scripts from v0.2 in tests/legacy)
- docs/: history, Drip It homepage spec, mockups
- handoff/: step-by-step files for Muhammad (Claude Code creates these)
- scripts/: build, validate and check-links scripts
- schema/: JSON Schema for a client config

## Commands

Run these from this folder. Claude Code runs them for you; they are here for reference.

- `npm install` once, then `npx playwright install chromium` once (downloads the test browser).
- `npm run build` - minify the engine to dist/ and regenerate every embeds/<client>/ block.
- `npm run validate` - schema and rule check for every config.
- `npm test` - full Playwright suite (builds first) at phone and desktop sizes.
- `npm run check-links` - open every booking link and confirm the service still exists.
