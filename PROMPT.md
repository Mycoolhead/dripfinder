Read CLAUDE.md and docs/HISTORY.md first, then read src/dripfinder.js and configs/dripit.json in full.

You're taking DripFinder from a single-client paste-in block to a product I can run on every client site I manage. Right now the engine and config are pasted inline into each GHL page, so any fix means Muhammad re-pastes on every site, and I have no way to show a client how many people used the quiz or clicked Book. I want:
- one hosted engine;
- one config per client;
- numbers I can put in a client report;
- tests that protect every client at once;
- a fast way to onboard the next client.

How to work with me:
- I'm not a developer. Run every command yourself, including installs, builds, tests and deploys.
- Only stop for things that need me: logging into an account, a choice that changes what visitors see, or approving a production deploy.
- At the end of each phase, give me a plain-English report: what you built, how you tested it, what you couldn't verify, and the one or two things you need from me. Then stop until I say go.
- If something I asked for is a bad idea, say so before you build it.
- Keep a running CHANGELOG.md.

## Phase 1: a real repo with a safety net

1. `git init`, .gitignore, package.json. Dev deps: terser 5.31.0, @playwright/test, @axe-core/playwright, ajv. Use the installed Chromium if there is one.
2. Make the engine industry-neutral.
   - No IV-specific words in src/. Every visitor-facing string comes from the config, with neutral defaults ("Here's the best fit for you", "See my match", "Help Me Choose").
   - Add `"vertical": "iv"` to configs. The IV safety rules in CLAUDE.md apply when vertical is "iv".
   - I plan to reuse this engine as a "Help Me Choose" quiz for funeral homes and senior living, so don't hard-code anything medical into the engine.
3. `npm run build`:
   - Minify to dist/ with `--format ascii_only=true`. Set VERSION to 0.3.0.
   - Regenerate everything in embeds/<slug>/ from each config: the full paste-in block, the symptom chips, the strip, and the all-snippets file.
   - The dripit quiz must recommend the same IV for every path it does today.
4. `npm run build` also writes embeds/<slug>/<slug>-crawlable.html: a plain HTML "Which IV is right for me?" section with no JavaScript. It contains:
   - a list of each feeling, the IV it matches, price, one line and a Book link;
   - 5 to 7 Q&As ("What's the best IV for a hangover?") with matching FAQPage JSON-LD.
   It pastes under the quiz on the clinic's page. It gives Google and AI search something to read (the quiz renders in Shadow DOM, so they can't), and it works as the fallback when JavaScript fails. All copy follows CLAUDE.md voice rules.
5. `npm run validate`, JSON Schema plus rule checks. Fail the build when any of these is true:
   - For vertical "iv": the config has no safety question, or the emergency and talk stops are missing.
   - An option has a bookUrl that doesn't start with https://, sms: or tel:.
   - A tag is used by options but never by an item, or the reverse.
   - The disclaimer is empty when vertical is "iv".
   - Any visitor-facing string has an em dash, or has "drip" as a standalone noun when vertical is "iv" (product names like "Build Your Custom Drip" are allowed).
   - A config is missing `approved: {by, date}`. For dripit, leave both empty.
6. `npm test`, Playwright at 390x844 and 1366x900, for every config:
   - Port tests/legacy/t.js (9 paths) and tests/legacy/pre.js (preselect). Keep today's expected matches exactly.
   - Auto-generate tests that:
     - every visible item is reachable by some answer path;
     - every stop answer shows no item and no Book link;
     - every Book link equals the item's bookUrl plus UTM params;
     - the disclaimer shows on the result screen;
     - two embeds on one page both mount;
     - there are zero console errors.
   - Accessibility:
     - axe-core finds no serious or critical issues on every screen;
     - the whole quiz completes with the keyboard only;
     - focus moves to the new question heading on each step;
     - tap targets are at least 44px;
     - text contrast meets WCAG AA.
7. `npm run check-links` uses Playwright to open every bookUrl and confirm the item's name appears on the booking page.
   - GlossGenius `/services?service_token=` links open a modal for that service. Check the modal's heading, not the page text behind it.
   - Run it on a weekly GitHub Actions schedule. When a clinic renames or deletes a service in their booking tool, the Book button breaks silently, and this is how I find out.
8. Copy pass on dripit.json, following CLAUDE.md rule 7:
   - Result title: "Here's the IV that fits you best".
   - SMS body: "Hi Deanna, I used the Help Me Choose quiz on your site. Before I book, can you" (then keep the rest of the current message).
   - Show me every visitor-facing string you changed, before and after, in the report.
9. GitHub Actions runs validate, build and test on every push. The repo stays private.

## Phase 2: hosted engine and real numbers

Goal: a client site needs only this, and I can change a price or fix a bug without touching GHL:
```html
<div data-dripfinder data-client="dripit" data-fallback="https://dripitivsolutions.glossgenius.com/services"></div>
<script src="https://<host>/v0/dripfinder.min.js" defer></script>
```

1. **Hosting.** Use Cloudflare (Pages or Workers static assets) deploying from the private GitHub repo. Don't use GitHub Pages:
   - the repo has to stay private, because a public one shows my client list;
   - Cloudflare gives me a free place to receive usage events.
   Walk me through the Cloudflare login and connection when you get there. Use a workers.dev or pages.dev address for now and tell me what a custom domain would take.
2. **Versioned paths.**
   - /v0/ serves the latest passing 0.x build.
   - /v0.3.0/ and so on are frozen copies, so I can pin a client if a release breaks something.
   - Configs live at /configs/<slug>.json.
   - Deploy only from main, after validate, build and test pass for every config.
   - Skip configs whose `approved` block is empty, and say so in the deploy output.
3. **Engine.**
   - When `data-client` is set and there's no inline config, fetch /configs/<slug>.json from the same origin as the script.
   - Inline JSON still wins, so Deanna's current paste-in block keeps working.
   - If the fetch fails, render a single Book button to `data-fallback`. Never leave a blank box.
   - Measure the first-render time on a throttled 4G phone and report it.
4. **Usage numbers (first-party and anonymous).** I can't count on clients having GA4 set up, and I need to prove the quiz works.
   - Add a tiny event endpoint on Cloudflare (a Worker with D1 or KV).
   - The engine sends: client slug, event (`view`, `start`, `result`, `stop_emergency`, `stop_talk`, `book_click`, `text_click`), matched item id, `src`, page path and date.
   - Never send answers to the feel, week or safety questions. Never store IP addresses or anything that identifies a person. Use `navigator.sendBeacon`. A failed send must never block or slow the quiz.
   - Keep the existing dataLayer and gtag events too.
5. **Stats page.** /stats/<slug>?key=<secret>, readable on a phone:
   - views, starts, completion rate, book clicks, text clicks and stop counts, by week and month;
   - top matched items and top `src` sources;
   - a "copy for report" button that gives me one plain sentence, e.g. "In October, 64 people used Help Me Choose on your site and 19 tapped Book."
   Put the keys in a file outside the repo and tell me where.
6. **Muhammad handoff.** Write handoff/muhammad-dripit-hosted-swap.md: numbered steps to replace the inline block on /find-your-drip with the hosted version, paste the crawlable block under it, and roll back if something breaks. Don't send it anywhere.

## Phase 3: get people to the quiz and onboard the next client

1. **Link builder.** `npm run links <slug>` writes handoff/<slug>-links.md. It has one tagged link per feeling per source, using sources `gbp`, `google-ads`, `instagram`, `facebook`, `sms`, `email`. Example: `/find-your-drip?feel=hungover&src=gbp`. Each link gets a one-line suggested post or button label in customer words ("Hungover? Tap here and we'll match you in 30 seconds"). Roman uses these for Google posts and social.
2. configs/_template.json, with every field explained in _template.notes.md.
3. `npm run new-client <slug>`:
   - asks for name, phone, vertical, brand colors, booking platform, the menu as a pasted CSV (name, price, booking URL, one-line description) and hours;
   - writes the config with the vertical's required stops prefilled;
   - suggests tags and marks every suggestion `"needsReview": true`;
   - runs check-links on the new booking URLs.
4. **Preview page** at /preview/?client=<slug>, banner "Preview, not live". Show the quiz plus a plain table of every answer path and the item it lands on. I send this to the client and, for IV clinics, their medical director for approval. It has to read clearly to a nurse.
5. handoff/intake-checklist.md: what I need from a client before building.

## Phase 4: plan only, don't build without my yes

Write docs/phase4-plan.md on an optional "Text me my match" button. It would send name, phone and the matched item name, never the symptom or safety answers, to the client's GHL inbound webhook, so a visitor who doesn't book right away becomes a lead the clinic can follow up with. Cover:
- TCPA consent wording;
- exactly what data leaves the page;
- HIPAA exposure for IV clinics and how to reduce it;
- the GHL workflow on the receiving end;
- your honest read on whether it's worth the risk.

## Ground rules

- Don't change which item a config recommends for any path without my approval. Copy changes are fine.
- Never deploy a change that fails tests for any client.
