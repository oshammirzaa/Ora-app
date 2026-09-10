create table if not exists ora_messages (
  id text primary key,
  reading_id text not null,
  role text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists ora_messages_reading_idx on ora_messages (reading_id, created_at);

update ora_advisors set video_url = '/videos/mira.mp4' where id = 'adv_mira';
update ora_advisors set video_url = '/videos/rowan.mp4' where id = 'adv_rowan';
update ora_advisors set video_url = '/videos/imani.mp4' where id = 'adv_imani';
update ora_advisors set video_url = '/videos/soren.mp4' where id = 'adv_soren';
