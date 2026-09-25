insert into ora_coin_packs (id, name, coins, amount_cents, currency, active, sort_order) values
  ('usd2', '$2 · 20 coins', 20, 200, 'USD', true, 1),
  ('usd5', '$5 · 50 coins', 50, 500, 'USD', true, 2),
  ('usd10', '$10 · 100 coins', 100, 1000, 'USD', true, 3),
  ('usd20', '$20 · 200 coins', 200, 2000, 'USD', true, 4)
on conflict (id) do update
  set name = excluded.name,
      coins = excluded.coins,
      amount_cents = excluded.amount_cents,
      currency = excluded.currency,
      active = true,
      sort_order = excluded.sort_order;

update ora_coin_packs
set active = false
where id not in ('usd2', 'usd5', 'usd10', 'usd20', '500', '1000', '2500', '5000', 'membership', 'membership-mini');

create table if not exists ora_admin_notices (
  id text primary key,
  report_id text not null unique,
  title text not null,
  advisor_name text not null default '',
  customer_name text not null default '',
  sender text not null default '',
  platform text not null default '',
  risk text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists ora_admin_notices_created_idx on ora_admin_notices (created_at desc);
