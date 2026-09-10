insert into ora_coin_packs (id, name, coins, amount_cents, currency, active, sort_order) values
  ('500', '500 coins', 500, 5000, 'USD', true, 10),
  ('1000', '1,000 coins', 1000, 10000, 'USD', true, 20),
  ('2500', '2,500 coins', 2500, 25000, 'USD', true, 30),
  ('5000', '5,000 coins', 5000, 50000, 'USD', true, 40)
on conflict (id) do update
  set name = excluded.name,
      coins = excluded.coins,
      amount_cents = excluded.amount_cents,
      currency = excluded.currency,
      active = true,
      sort_order = excluded.sort_order;

update ora_coin_packs
set active = false
where id in ('10', '50', '100', '300');
