# DripFinder history and decisions

## Oct 8, 2026: v0.1 demo
Built as a generic "find your bag" quiz with Silver / Gold / Platinum tiers. Never deployed.

## Oct 28, 2026: v0.2 for Drip It IV Solutions
- Dropped tiers. Deanna's site and GlossGenius use IV names, so the quiz matches to real services.
- Questions, in order:
  1. `feel` (multi): tired, headache, nausea, sick, hungover, dry, sore, glow, well.
  2. `week` (single): night, bug, train, outside, event, grind, routine.
  3. `client`: new (sets the newClient flag) or returning.
  4. `safety` (multi): none (exclusive), emergency (stop: emergency), vomit / pregnant / organ (stop: talk).
- Matching is tag-weight scoring with a fallback IV. `hideFromMatch` keeps Build Your Custom Drip out of matching, and `customOption` always offers it as the alternative.
- Matches with prices and GlossGenius service tokens:
  - Hangover/Flu Relief $229: c4a12d54
  - Immunity Boost $229: 7a4cc7ee
  - Myers Cocktail $229: 04bc4708
  - Peak Performance $229: 23662a05
  - Hydration Hero $179: 8c7d1432
  - High Dose Glutathione $199: 9c8c7c51
  - Build Your Custom Drip $249: e88deeb4
- Add-ons:
  - $30 anti-nausea when the nausea weight is 3 or more.
  - $20 Elite glutathione on everything except Glutathione.
- First-time clients see the $25 one-year telehealth consult note.
- After-hours note: $75 fee, with its own booking link (97c336d1).
- Left out on purpose: Migraine Relief, Mama Hydrate, Prime Energy and Niagen. None of them has a GlossGenius booking link.
- Result screen order: match, then Book and Text buttons, then tips. Book links carry UTM tags.
- A guard was added: if `window.DripFinder` already exists, the second script calls autoMount and returns. This fixed a second embed not mounting.

## Oct 28, 2026: v0.2.1
- Added `?feel=` preselect and `?src=` tracking.
- Builds are ASCII only after a UTF-8 checkmark risked garbling.
- Tested with 9 answer paths plus the preselect: all matches correct, no console errors.

## Oct 28, 2026: placement and labels on Deanna's site
- The quiz lives on its own page, /find-your-drip. The homepage gets pointers to it, not the full embed.
- Homepage hero: the white secondary button becomes "Help Me Choose ->". Under it, 4 symptom chips: Hungover, Sick or run down, Wiped out, Dehydrated. Each chip links with `?feel=` so the answer arrives already checked.
- A thin strip ("Not sure what you need? Tell us how you feel and we'll match you in 30 seconds.") goes above the IV cards on the homepage, the Services page and 9 city pages.
- "Find My Drip" was rejected because visitors don't know the word "drip". Customer words win.

## Status on Oct 28, 2026
- Muhammad has a draft with Part 1 (build a hidden /find-your-drip page and test it) and Part 2 (wire it into the site after Michael says go). Not sent yet.
- Verified Oct 28 in a headless phone browser: all 8 GlossGenius links open the right service.
  - The 5 `/services?service_token=` links (Hangover/Flu Relief, Immunity Boost, Myers Cocktail, Peak Performance, Hydration Hero) open that service's modal over the menu, showing its options (for example Myers Cocktail $229 or Myers Elite $249) and add-ons. GlossGenius uses this format for services that have options. `/book?` redirects back to it.
  - The 3 `/book?service_token=` links (High Dose Glutathione, Build Your Custom Drip, After Hours) go straight to the date picker.
  - Text scraping reads the menu behind the modal, so check-links has to read the modal heading.
- Not verified: that Deanna or her medical director has approved the answer-to-IV map.
- Known copy leftovers using "drip" in visitor-facing text:
  - The result title "Here is the drip that fits you best", in both the engine default and dripit.json.
  - "drip finder" in the Text-the-clinic SMS body.
- The Drip It homepage rewrite (docs/dripit-homepage-storybrand-seo-oct28.md) is GHL builder work for Muhammad, not code in this repo.

## Oct 28, 2026: v0.3.0 (Phase 1, repo + safety net)
- Turned the single paste-in block into a real repo: git, npm, build/validate/test/check-links, GitHub Actions. Repo stays private (it exposes the client list).
- Engine is now industry-neutral so it can serve funeral homes and senior living later. No IV words in src/. Every visitor-facing string is a config value with a neutral default. The IV safety rules switch on with `"vertical": "iv"`.
- Config key `drips` became `items`; the analytics event detail `drip` became `item`. Product identifiers (`window.DripFinder`, `data-dripfinder`, `dripfinder_*` events) are unchanged.
- Each config now carries `"approved": {by, date}`. Deploys (Phase 2) skip configs with an empty `approved`. dripit is NOT approved yet (Deanna / medical director still need to sign off on the answer-to-IV map).
- Build regenerates embeds from config, including a new no-JS crawlable block whose feeling-to-IV table and FAQ are computed from the same scoring the quiz uses (so SEO copy can never contradict the quiz).
- Matching logic is unchanged: all 9 legacy paths still recommend the same IV, asserted in tests.
- check-links confirmed all 8 GlossGenius links live on Oct 28, 2026 (5 `/services` modals + 3 `/book` pages).
- Filenames in embeds/dripit/ were standardized to `dripit-*` (old names homepage-hero-chips.html, drip-finder-strip.html, dripit-drip-finder-all-snippets.html are gone; build owns these files now).
- Copy pass on dripit.json: result title "Here's the IV that fits you best"; "drip" as a standalone noun removed from visitor copy (disclaimer, add-on, SMS); result/stop SMS now say "Help Me Choose quiz".
