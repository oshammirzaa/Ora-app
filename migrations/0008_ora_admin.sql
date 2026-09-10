alter table ora_profiles add column if not exists status text not null default 'active';

alter table ora_reviews add column if not exists hidden boolean not null default false;

alter table ora_payouts add column if not exists decided_at timestamptz;
alter table ora_payouts add column if not exists note text not null default '';

create table if not exists ora_settings (
  id text primary key,
  name text not null default 'Ora',
  logo_url text not null default '',
  support_email text not null default '',
  currency text not null default 'USD',
  platform_share integer not null default 30,
  welcome_seconds integer not null default 180,
  weekly_seconds integer not null default 180,
  welcome_coins integer not null default 0
);
insert into ora_settings (id) values ('ora') on conflict (id) do nothing;

create table if not exists ora_categories (
  id text primary key,
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true
);
insert into ora_categories (id, name, slug, sort_order, active) values
  ('cat_love', 'Love', 'love', 1, true),
  ('cat_career', 'Career', 'career', 2, true),
  ('cat_grief', 'Grief', 'grief', 3, true),
  ('cat_astro', 'Astrology', 'astrology', 4, true),
  ('cat_medium', 'Medium', 'medium', 5, true)
on conflict (id) do nothing;

create table if not exists ora_audit (
  id text primary key,
  actor_id text not null,
  verb text not null,
  target_type text not null default '',
  target_id text not null default '',
  summary text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ora_audit_created_idx on ora_audit (created_at desc);

create table if not exists ora_promos (
  id text primary key,
  name text not null,
  kind text not null,
  amount integer not null default 0,
  active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists ora_adjustments (
  id text primary key,
  user_id text not null,
  reading_id text not null default '',
  coins integer not null,
  kind text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ora_adjustments_user_idx on ora_adjustments (user_id, created_at desc);
