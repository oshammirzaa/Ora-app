create table if not exists ora_profiles (
  user_id text primary key,
  display_name text not null default '',
  role text not null default 'client',
  created_at timestamptz not null default now()
);

create table if not exists ora_wallets (
  user_id text primary key,
  coins integer not null default 0,
  bonus_seconds integer not null default 0,
  weekly_seconds integer not null default 0,
  subscribed boolean not null default false,
  sub_started_at timestamptz,
  week_started_at timestamptz
);

create table if not exists ora_advisors (
  id text primary key,
  user_id text not null,
  name text not null,
  slug text not null unique,
  bio text not null default '',
  experience text not null default '',
  specialties text not null default '',
  rate_coins integer not null default 20,
  photo_url text not null default '',
  video_url text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists ora_applications (
  id text primary key,
  user_id text not null,
  name text not null,
  bio text not null,
  experience text not null,
  specialties text not null,
  rate_coins integer not null,
  photo_url text not null default '',
  video_url text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists ora_readings (
  id text primary key,
  client_id text not null,
  advisor_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seconds integer not null default 0,
  coins_spent integer not null default 0,
  bonus_used integer not null default 0,
  weekly_used integer not null default 0,
  status text not null default 'live'
);

create index if not exists ora_advisors_status_idx on ora_advisors (status);
create index if not exists ora_readings_client_idx on ora_readings (client_id);
create index if not exists ora_applications_status_idx on ora_applications (status);

insert into ora_advisors (id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status)
values
  ('adv_mira', 'seed:mira', 'Mira Solane', 'mira',
   'Love, timing, and the thing you already know but want said out loud. Mira reads tarot with a quiet room and a sharp eye.',
   '12 years reading in person and online. Trained in Marseille and Rider–Waite.',
   'Love, Tarot, Timing',
   22, '/images/mira.jpg', '', 'live'),
  ('adv_rowan', 'seed:rowan', 'Rowan Hale', 'rowan',
   'Mediumship without theatrics. Rowan sits with grief and the living questions that follow it.',
   '18 years of private sittings. Former hospice volunteer.',
   'Medium, Grief, Family',
   28, '/images/rowan.jpg', '', 'live'),
  ('adv_imani', 'seed:imani', 'Imani Voss', 'imani',
   'Charts, transits, and what to do this month. Imani keeps astrology practical.',
   '9 years as a consulting astrologer. Hellenistic technique, modern language.',
   'Astrology, Career, Year ahead',
   20, '/images/imani.jpg', '', 'live'),
  ('adv_soren', 'seed:soren', 'Soren Quill', 'soren',
   'Work, money, and the next honest step. Soren is blunt, kind, and on the clock.',
   'A decade of career readings for founders and people changing jobs.',
   'Career, Decisions, Clarity',
   18, '/images/soren.jpg', '', 'live')
on conflict (id) do nothing;
