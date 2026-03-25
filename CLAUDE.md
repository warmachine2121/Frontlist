# Waitlist.so — Project Context for Claude Code

## What this project is
A SaaS tool that lets startup founders create a branded waitlist page in minutes and collect email signups. Founders pay a monthly subscription to access a dashboard where they customise their page, track signups, and get email notifications.

## Business model
- Free tier: up to 100 signups
- Pro tier: $19/month — unlimited signups, custom URL slug, logo upload, brand colours, email notifications
- Growth tier: $49/month — custom domain, analytics, referral tracking

## Current state
- Landing page built and deployed on Vercel (index.html — single file, no framework)
- Supabase project connected for email collection
- Stripe account exists, payment link to be wired in
- No auth system yet
- No founder dashboard yet (mockup designed, not built)

## Tech stack
- Frontend: plain HTML/CSS/JS (no framework) — single file deployed on Vercel
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth (to be implemented)
- Payments: Stripe (subscription billing)
- Hosting: Vercel
- Domain: custom domain (to be connected)

## Supabase config
- Project URL: see .env file (never commit this)
- Anon key: see .env file (never commit this)
- Tables:
  - `waitlist` — stores emails from the Lowdraw landing page
    - id (uuid, primary key)
    - email (text, unique)
    - created_at (timestamp with time zone)

## Database tables to build next
```sql
-- Founders who sign up to use the product
create table founders (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  stripe_customer_id text,
  plan text default 'free',
  created_at timestamp with time zone default now()
);

-- Each founder's waitlist project
create table projects (
  id uuid default gen_random_uuid() primary key,
  founder_id uuid references founders(id),
  slug text unique not null,
  title text,
  description text,
  logo_url text,
  primary_color text default '#000000',
  accent_color text default '#ffffff',
  notify_every_signup boolean default true,
  notify_daily_digest boolean default false,
  notify_milestones boolean default true,
  created_at timestamp with time zone default now()
);

-- Signups on each founder's waitlist page
create table signups (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id),
  email text not null,
  referred_by uuid references signups(id),
  created_at timestamp with time zone default now(),
  unique(project_id, email)
);
```

## Pages to build
1. `/` — marketing landing page (done)
2. `/pricing` — pricing page with Stripe checkout button
3. `/signup` — founder account creation (Supabase auth)
4. `/login` — founder login
5. `/dashboard` — founder dashboard (overview, metrics)
6. `/dashboard/customise` — page customisation (logo, colours, slug, copy)
7. `/dashboard/signups` — list of signups with export
8. `/dashboard/notifications` — email notification settings
9. `/dashboard/billing` — Stripe billing portal
10. `/:slug` — public waitlist page (generated per founder)

## Dashboard features to build
- Metrics: total signups, referred signups, page views, conversion rate
- Page customisation: title, description, logo upload, brand colours, URL slug
- Email notifications: on every signup, daily digest, milestone alerts (100/500/1000)
- Signup export: CSV download
- Referral tracking: unique referral links per signup, leaderboard

## Brand (this product — Waitlist.so)
- Name: Waitlist.so
- Colours: neutral, clean, professional — not opinionated
- Tone: simple, fast, no fluff

## Example project using the product — Lowdraw
- Lowdraw is an all-terrain golf clothing startup using Waitlist.so
- British green (#1B4332) and orange (#E8622A) brand colours
- Their waitlist page is the current index.html
-- Logo: LOWDRAW_Logo.png (archived/removed; replaced by Frontlist branding)
- Supabase table: waitlist (same project, separate from founder tables)

> Side note: Lowdraw needed a product for their new startup, so Frontlist was created to provide a lightweight waitlist and prelaunch tooling. This repository has been rebranded to Frontlist; historical Lowdraw references are preserved here for provenance.

## Stripe
- Account exists
- Product: Waitlist.so Pro at $19/month
- Payment link to be added once created in Stripe dashboard
- Future: use Stripe webhooks to activate/deactivate accounts on payment events

## Key conventions
- Keep it simple — plain HTML/CSS/JS where possible, avoid over-engineering
- Single file pages preferred for now (easier Vercel deployment)
- All Supabase calls use the REST API directly (fetch), not the Supabase JS client
- Row Level Security enabled on all tables
- Never expose the Supabase service role key on the frontend

## Next immediate tasks
1. Get Stripe payment link and add pricing page to site
2. Build /signup and /login with Supabase Auth
3. Build founder dashboard (start with overview + customise page)
4. Build dynamic /:slug public waitlist page
5. Wire Stripe webhooks to update founder plan in database

## Repository
- GitHub: warmachine2121/lowdraw (or similar)
- Deployed on Vercel, auto-deploys on push to main
