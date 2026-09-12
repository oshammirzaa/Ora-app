-- Customer support tickets. Additive only — never drops existing tables or rows.
create table if not exists ora_tickets (
  id text primary key,
  ticket_no text not null unique,
  client_id text not null,
  reason text not null,
  status text not null default 'open',
  advisor_id text not null default '',
  reading_id text not null default '',
  last_message_at timestamptz not null default now(),
  customer_unread boolean not null default false,
  admin_unread boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ora_tickets_client_idx on ora_tickets (client_id, created_at desc);
create index if not exists ora_tickets_status_idx on ora_tickets (status, admin_unread, last_message_at desc);
create index if not exists ora_tickets_advisor_idx on ora_tickets (advisor_id);

create table if not exists ora_ticket_messages (
  id text primary key,
  ticket_id text not null,
  author_id text not null,
  role text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists ora_ticket_messages_ticket_idx
  on ora_ticket_messages (ticket_id, created_at);

create table if not exists ora_ticket_notes (
  id text primary key,
  ticket_id text not null,
  author_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists ora_ticket_notes_ticket_idx
  on ora_ticket_notes (ticket_id, created_at);
