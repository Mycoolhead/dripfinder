# Drip It - swap the quiz to the hosted version (for Muhammad)

This replaces the big pasted-in quiz block on **/find-your-drip** with a tiny hosted snippet,
so future fixes and price changes happen once on our side with no re-paste on the site.

The hosted quiz is **approved and live**. Before you swap, confirm it in a browser:
open **https://dripfinder.michael-333.workers.dev/configs/dripit.json** - you should see a page
of JSON (text starting with `{`). If it ever shows "not found" (404), stop and tell Michael.

The DripFinder host is `dripfinder.michael-333.workers.dev` (already filled into the snippet below).

## Before you touch anything

1. In GoHighLevel, open the **/find-your-drip** page builder.
2. Find the Custom Code / HTML element that holds the current DripFinder quiz
   (it starts with a comment like `<!-- DripFinder v... for Drip It IV Solutions -->` and
   contains a long `<script type="application/json">...`).
3. **Copy its entire contents into a plain text file and save it** (e.g. `dripit-find-your-drip-BACKUP.txt`).
   This is your rollback. Don't skip it.

## Swap it

4. In that same Custom Code element, delete everything and paste exactly this:

   ```html
   <div data-dripfinder
        data-client="dripit"
        data-fallback="https://dripitivsolutions.glossgenius.com/services"></div>
   <script src="https://dripfinder.michael-333.workers.dev/v0/dripfinder.min.js" defer></script>
   ```

   Leave everything exactly as shown.

5. **Paste the crawlable block underneath the quiz** (this is what Google and AI search read,
   since the quiz itself renders in a way they can't see). Add a **second** Custom Code element
   directly below the quiz element, and paste the full contents of:

   `embeds/dripit/dripit-crawlable.html`

   (Michael will send you this file, or copy it from the repo. Paste the whole file as-is.)

6. Save and **preview** the page. You should see:
   - the quiz loads and asks "What are you dealing with right now?" within a second or two;
   - below it, a plain "Which IV is right for me?" section with a table and a few Q&As.

7. Test on your phone and on desktop:
   - run the quiz once and confirm a match appears with a working **Book** button;
   - confirm the page doesn't show a blank box at any point.

8. Publish the page.

## If anything looks wrong - roll back

9. If the quiz shows only a single "Book now" button, or a blank box, or doesn't load:
   - open `https://dripfinder.michael-333.workers.dev/configs/dripit.json` - if it 404s,
     something changed on our side. Roll back and tell Michael.
10. To roll back: open the Custom Code element, delete the hosted snippet, and paste back the
    contents of your `dripit-find-your-drip-BACKUP.txt`. Remove the crawlable element you added.
    Save and publish. You're back to exactly how it was.

## Notes

- The homepage chips and the "how do you feel" strip don't change - they already point at
  /find-your-drip and keep working.
- Nothing visitors pick in the quiz is sent anywhere or stored. The only data we collect is
  anonymous counts (views, starts, book taps), which Michael can see on the stats page.
