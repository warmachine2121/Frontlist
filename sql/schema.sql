-- Schema for Waitlist.so (from CLAUDE.md)

-- Existing public waitlist table used by the Frontlist landing page (origin: Lowdraw)
create table if not exists waitlist (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  created_at timestamp with time zone default now()
);

-- Founders who sign up to use the product
create table if not exists founders (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  stripe_customer_id text,
  plan text default 'free',
  created_at timestamp with time zone default now()
);

-- Each founder's waitlist project
create table if not exists projects (
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
create table if not exists signups (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id),
  email text not null,
  referred_by uuid references signups(id),
  created_at timestamp with time zone default now(),
  unique(project_id, email)
);
