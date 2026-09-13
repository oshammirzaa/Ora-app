-- House commission is 80% (advisor 20%). Additive settings change only.
-- Does not touch wallets, readings, payouts, or historical session rows.
alter table ora_settings
  alter column platform_share set default 80;

update ora_settings
  set platform_share = 80
  where id = 'ora';
