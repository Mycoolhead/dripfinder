# Cloudflare setup (one time) - for Michael

This puts the DripFinder engine on the web so client sites load it from one place, and
gives us a free spot to collect anonymous usage numbers. You do the account steps (logins);
I run the rest. Nothing here is live for visitors until you say so.

Everything is free on Cloudflare's plan at our size.

## What we're standing up

- A **Worker** named `dripfinder` that:
  - serves the engine at `https://<host>/v0/dripfinder.min.js` (and frozen copies at `/v0.3.0/`, `/v0.4.0/`),
  - serves client configs at `https://<host>/configs/<slug>.json`,
  - receives anonymous usage events at `/e`,
  - shows a stats page at `/stats/<slug>?key=...`.
- A **D1 database** (Cloudflare's free SQL) named `dripfinder` that stores the events.
- It deploys from our **private GitHub repo** on every push to `main`.

`<host>` will be a free `dripfinder.<your-subdomain>.workers.dev` address to start. A custom
domain (like `q.michaelheadmarketing.com`) is a later step - see the end.

## Step 1 - Put the repo on GitHub (private)

The code is a local git repo right now with no remote. We need it on GitHub, private,
because a public repo would expose your client list.

1. If you don't have a GitHub account, create one at https://github.com (free).
2. Tell me your GitHub username. I'll create the private repo and push the code, OR
   you create an **empty private** repo named `dripfinder` and paste me the URL and I'll push.
   - Do **not** let GitHub add a README/.gitignore when creating it (keeps the push clean).

## Step 2 - Cloudflare account

1. Sign in or sign up at https://dash.cloudflare.com (free). Tell me when you're in.
2. We'll connect Cloudflare to GitHub so it can build and deploy from the repo.

## Step 3 - Create the database and connect the repo

I'll drive these with you watching; each needs your logged-in session:

1. **Create D1:** in the Cloudflare dashboard, Storage & Databases -> D1 -> Create, name it
   `dripfinder`. It prints a database ID. I paste that ID into `wrangler.jsonc`.
   (Or I run `npx wrangler d1 create dripfinder` once you've authorized wrangler on your machine.)
2. **Create the events table:** I run `npx wrangler d1 execute dripfinder --remote --file=worker/schema.sql`.
3. **Connect the repo (auto-deploy):** Workers & Pages -> Create -> Workers -> Import a repository
   -> pick the private `dripfinder` repo. Set the build command to:
   ```
   npm ci && npm run release
   ```
   and the deploy to `npx wrangler deploy`. From then on, every push to `main` that passes
   validate/build/test publishes automatically.
4. **Set the stats password:** I run `npx wrangler secret put STATS_KEYS` and paste the JSON
   from your secrets file (`~/dripfinder-secrets/stats-keys.txt`). This never goes in the repo.

## Step 4 - Smoke test the live host

Once deployed, I'll check:
- `https://<host>/v0/dripfinder.min.js` loads and says `v0.4.0` in the banner,
- `https://<host>/stats/dripit?key=...` opens (it'll show zeros until the quiz is live),
- a test event reaches D1.

## About the dripit config (important)

The hosted engine only publishes a client's config **after** its answer-to-IV map is approved
(the `approved` block in `configs/dripit.json` is filled in). Deanna's map is **not approved yet**,
so `configs/dripit.json` will be **skipped** on deploy and `https://<host>/configs/dripit.json`
will 404. Until then, any hosted embed for dripit shows its fallback Book button instead of the quiz.

Deanna's **current** site is unaffected - it uses the inline paste-in block, which keeps working.
We only swap her to the hosted version (see `muhammad-dripit-hosted-swap.md`) after approval + publish.

## Custom domain (later, optional)

A `workers.dev` address is fine to start. For a branded URL like `q.michaelheadmarketing.com`:
- the domain's DNS needs to be on Cloudflare (free), then add a Worker route/custom domain in the
  dashboard and point the client `<script src>` at the new host. ~15 minutes, no code change.
- Tell me when you want this and I'll walk you through it.
