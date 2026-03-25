# Frontlist — Waitlist & prelaunch pages (starter)

This repository contains the Frontlist landing page and starter scaffolding for a Waitlist SaaS (originally started as the Lowdraw example and rebranded to Frontlist). It includes static single-file pages and serverless endpoints to wire Stripe and Supabase for subscriptions and founder dashboards.

What I added in this init step
- `README.md` (this file)
- `package.json` with lightweight scripts to serve the static site locally
- `.env.example` listing required env vars for Supabase & Stripe
- `sql/schema.sql` containing the SQL table definitions described in `CLAUDE.md`
- Placeholder single-file pages: `pricing.html`, `signup.html`, `login.html`, and a `dashboard/` folder with minimal pages.

Why
- The project currently has a single `index.html`. Per `CLAUDE.md`, the next pages are needed (pricing, signup, login, dashboard) and a DB schema exists. These files are lightweight placeholders to kick off development and Vercel deployments.

Next steps (recommended)
1. Add Supabase project URL and anon key to a `.env` (never commit real keys).
2. Wire Stripe payment link and publish the `/pricing` page button.
3. Implement Supabase Auth flows on `/signup` and `/login` and create the dashboard pages.
4. Create serverless functions for Stripe webhooks (to update founder plans) and secure them with the webhook secret.
5. Add tests and CI as you expand the codebase.

How to run locally
1. Install a static server if you don't have one (eg. `npm i -g serve` or just use `npx`).
2. From the project root run:

```bash
# serve the current directory (production-like)
npx serve . -s

# or for a quick dev server with auto-reload (if you have live-server)
npx live-server --port=3000
```

Files of interest
- `index.html` — existing landing page (Frontlist)
- `CLAUDE.md` — project plan and requirements
- `sql/schema.sql` — DB migrations for founders, projects, signups, waitlist
- `pricing.html`, `signup.html`, `login.html` — placeholder single-file pages
- `checkout-success.html` — status page users land on after Checkout; polls until subscription is active
- `dashboard/` — placeholder dashboard pages

Vercel deployment and environment variables
1. Install the Vercel CLI (optional but recommended for local testing):

```bash
npm i -g vercel
```

2. Login and link your project (one-time):

```bash
vercel login
vercel link
```

3. In the Vercel dashboard for the project, add these Environment Variables (Production and Preview as needed):

- SUPABASE_URL = https://your-project.supabase.co
- SUPABASE_SERVICE_ROLE_KEY = <your supabase service role key> (server-side only)
- STRIPE_SECRET_KEY = sk_live_xxx (or sk_test_xxx for testing)
- STRIPE_PUBLISHABLE_KEY = pk_live_xxx
- STRIPE_WEBHOOK_SECRET = whsec_xxx
- STRIPE_PRICE_PRO_ID = price_xxx
- BASE_URL = https://your-vercel-project.vercel.app

Important: never commit the service role key or Stripe secret keys. Use Vercel environment variables.

4. Deploy:

```bash
vercel --prod
```

5. Configure Stripe webhooks to point to:

```
https://<your-vercel-domain>/api/stripe-webhook
```

Use the webhook secret from Stripe and add it to the `STRIPE_WEBHOOK_SECRET` env var.

What we added for Stripe flow
- `api/create-checkout-session.js` — creates a provisional founder (plan='pending'), then creates a Checkout session with `metadata.founder_id`.
- `api/stripe-webhook.js` — verifies signature and upgrades the founder to `plan='pro'` on `checkout.session.completed` (prefers metadata.founder_id).
- `api/checkout-session-status.js` — helper endpoint used by `checkout-success.html` to poll session/founder status.
- `checkout-success.html` — polls until the founder is active and redirects to `/dashboard`.

License
--
This repo init does not add a license. Add one as appropriate.
