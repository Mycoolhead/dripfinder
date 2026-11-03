# DripFinder: project rules for Claude Code

DripFinder is Michael Head Marketing's white-label symptom quiz for mobile IV clinic websites. A visitor taps how they feel, answers a few quick questions, passes a safety screen, and gets matched to one of that clinic's IVs with a Book button that deep links to the exact service in the clinic's booking system.

Owner: Michael Head (michael@nextstepcoach.org). Never use michael@michaelheadmarketing.com anywhere.

## What exists today (v0.2.x)

- `src/dripfinder.js`: the engine. Plain ES5, no dependencies, renders in a Shadow DOM so it can't break or be broken by the host site's CSS. Auto-mounts on any element with `data-dripfinder` and reads an inline JSON config from a `<script type="application/json">` inside it. Supports `?feel=a,b` to preselect answers to question 1 and `?src=` for tracking. Pushes `dripfinder_*` events to `dataLayer` and `gtag` if present.
- `dist/dripfinder.min.js`: terser build, ASCII only. The version string inside still reads 0.2.0 even though it has the v0.2.1 preselect feature. Fix on the first build.
- `configs/dripit.json`: the first client, Drip It IV Solutions (Deanna Katsadas, Brevard County FL, books through GlossGenius).
- `embeds/dripit/`: the paste-in blocks for Deanna's GHL site (full quiz block, homepage symptom chips, thin strip, and one file with all three labeled).
- `tests/legacy/`: the throwaway Playwright scripts used to verify v0.2. `t.js` runs 9 answer paths, `pre.js` checks the `?feel=` preselect. Both passed on Oct 28, 2026.
- `docs/`: the Drip It homepage rewrite spec, mockups and HISTORY.md (decisions so far). Read HISTORY.md before changing behavior.

## Why this exists (judge every change against this)

The quiz exists to turn a visitor who doesn't know what to buy into a Book click. Success is book clicks per client per month, shown in the client's report. It also has to keep IV clients from churning, because a client who can see the quiz producing bookings stays. Polish that doesn't move book clicks or reliability waits.

The engine stays industry-neutral. IV is the first vertical. Funeral homes and senior living ("Help Me Choose" for service or care level) come later, so nothing medical goes in src/. Medical rules live in config and validation, and they're switched on by `"vertical": "iv"`.

## Hosting decisions

- The repo is private, because a public one exposes Michael's client list.
- Hosting is Cloudflare, deployed from GitHub, with a Worker endpoint for anonymous usage events and a per-client stats page.

## Hard rules

1. **Every IV config must keep a safety screen.** Emergency answers route to "call 911" with no IV shown. Pregnancy, kidney disease, heart failure or dialysis, and vomiting over a day route to "text or call the clinic first" with no IV shown. The validator must fail any config without these.
2. **Every result shows the disclaimer.** "This is a general guide, not medical advice..." A clinic can reword it but can't remove it.
3. **No IV goes live without a working booking link.** If a service has no direct booking link, leave it out of matching. Don't point it at a general menu.
4. **The clinic's medical director approves the answer-to-IV map before a config goes live.** Track that with `"approved": {"by": "", "date": ""}` in each config. Production deploys skip unapproved configs.
5. **Builds are ASCII only** (`terser --format ascii_only=true`). GHL pages without a charset meta garble UTF-8.
6. **Never send symptom answers anywhere off the page.** Analytics events carry the matched IV id and the step, never the answers to the health or safety questions. This matters more once lead capture exists.
7. **Customer language.** Visitors don't know what a "drip" is. In visitor-facing copy, use "IV" as the noun and lead with how they feel. "Drip" only appears inside a product name ("Hangover/Flu Relief") or as "IV drip".
8. **Copy voice:** short, plain, direct. No em dashes. No emojis. No hype words.
9. **Never put what a clinic pays Michael in any file in this repo.** The clinic's own service prices are fine.
10. **Never email, text or message a client or Michael's team from here.** Draft it in a file and tell Michael.
11. **One fix updates every clinic once hosting exists, and so does one bug.** Never deploy without the full test suite passing for every config.

## Commands (create these in Phase 1)

- `npm run build`: minify `src/` to `dist/` and regenerate every `embeds/<client>/` block from its config.
- `npm test`: Playwright suite over every config in `configs/`.
- `npm run validate`: schema and rule check for every config.
- `npm run new-client <slug>`: scaffold a config from `configs/_template.json`.

## Team context

- Muhammad builds and edits the GHL websites. He pastes the embed blocks. Anything he has to do gets written as numbered steps in a markdown file under `handoff/`.
- Clinic sites are GoHighLevel. Custom Code elements accept inline scripts and external `<script src>`.
